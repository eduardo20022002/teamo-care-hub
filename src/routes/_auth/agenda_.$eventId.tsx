import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  ClipboardCheck,
  ClipboardEdit,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { TypeChip } from "@/components/agenda/TypeChip";
import { DetailRow } from "@/components/agenda/DetailRow";
import { NoteCard } from "@/components/agenda/NoteCard";
import { AfterAppointmentActions } from "@/components/agenda/AfterAppointmentActions";
import { PendingObservationsBanner } from "@/components/agenda/PendingObservationsBanner";
import { ObservationFormSheet } from "@/components/agenda/ObservationFormSheet";
import {
  listAgendaEvents,
  updateAgendaEventStatus,
  getParentEventReminder,
  upsertParentEventReminder,
  rescheduleAgendaEvent,
  deleteAgendaEvent,
  deleteAgendaSeries,
} from "@/services/agenda/events.service";
import { getProfile } from "@/services/profile.service";
import { getRole } from "@/lib/roles";
import { useGetSessionRecord } from "@/services/therapist.service";
import { getPatientColor } from "@/lib/agenda/tokens";
import {
  listObservationsByEvent,
  listPendingObservationsByEvent,
  createObservation,
  updateObservation,
} from "@/services/agenda/observations.service";
import {
  listObservationAttachments,
  uploadObservationAttachment,
} from "@/services/agenda/attachments.service";
import { listProfessionals } from "@/services/professionals.service";
import { useAuth } from "@/hooks/useAuth";
import {
  AGENDA_BRAND,
  BRAND_GRADIENT,
  BRAND_SHADOW,
} from "@/lib/agenda/tokens";
import { formatEventTimeRange, combineDateTime } from "@/lib/agenda/format";
import type { AgendaEventStatus } from "@/types/agenda";
import type { AgendaObservationInput } from "@/lib/agenda/validation";

export const Route = createFileRoute("/_auth/agenda_/$eventId")({
  head: () => ({
    meta: [{ title: "Compromisso — TEAmo" }],
  }),
  component: AgendaEventDetailPage,
});

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const WEEKDAYS_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function formatWhenLine(startAt: string, endAt: string | null): string {
  const d = new Date(startAt);
  const wd = WEEKDAYS_PT[d.getDay()];
  const datePart = `${wd}, ${d.getDate()} de ${MONTHS_PT[d.getMonth()]}`;
  // "14:00 – 15:00" → "14h00 – 15h00" para casar com o design
  const pretty = formatEventTimeRange(startAt, endAt).replace(
    /(\d{2}):(\d{2})/g,
    "$1h$2",
  );
  return `${datePart} · ${pretty}`;
}

function formatRecurrenceLabel(recurrence: {
  freq: string;
  daysOfWeek?: number[];
}): string | null {
  switch (recurrence.freq) {
    case "weekly": {
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length === 1) {
        return `Toda ${WEEKDAYS_PT[recurrence.daysOfWeek[0]].toLowerCase()}`;
      }
      return "Toda semana";
    }
    case "biweekly":
      return "A cada 15 dias";
    case "monthly":
      return "Todo mês";
    case "daily":
      return "Diariamente";
    case "custom":
      return "Personalizada";
    default:
      return null;
  }
}

function formatRemindersLabel(reminders: {
  oneDayBefore: boolean;
  oneHourBefore: boolean;
}): string | null {
  const parts: string[] = [];
  if (reminders.oneDayBefore) parts.push("1 dia antes");
  if (reminders.oneHourBefore) parts.push("1 hora antes");
  return parts.length ? parts.join(" · ") : null;
}

function AgendaEventDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { eventId } = Route.useParams();
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reDate, setReDate] = useState("");
  const [reTime, setReTime] = useState("");
  const [editingObs, setEditingObs] = useState<{ id: string; text: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const TEAL = "#0D9488";

  // Papel do usuário
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const isTherapist = profileQuery.data
    ? getRole(profileQuery.data) === "therapist"
    : false;

  // Registro de sessão (só para terapeuta)
  const sessionRecordQuery = useGetSessionRecord(isTherapist ? eventId : undefined);
  const sessionRecord = sessionRecordQuery.data?.sessionRecord as any;

  // Pegamos o evento do listAgendaEvents (com relations já carregadas).
  // Numa fase posterior podemos ter um getAgendaEvent(id) dedicado.
  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: () => listAgendaEvents(),
    enabled: !!user,
  });

  const observationsQuery = useQuery({
    queryKey: ["agenda-observations", eventId],
    queryFn: () => listObservationsByEvent(eventId),
    enabled: !!user,
  });

  const pendingQuery = useQuery({
    queryKey: ["agenda-pending-obs", eventId],
    queryFn: () => listPendingObservationsByEvent(eventId),
    enabled: !!user,
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });

  const event = useMemo(
    () => eventsQuery.data?.find((e) => e.id === eventId),
    [eventsQuery.data, eventId],
  );

  // Evento é uma sessão criada por um terapeuta (tem therapist_id)
  const isTherapistEvent = !!(event as any)?.therapist_id;
  // Pai visualizando sessão do terapeuta → pode ativar lembrete próprio
  const canSetParentReminder = !isTherapist && isTherapistEvent;

  const reminderQuery = useQuery({
    queryKey: ["parent-event-reminder", eventId],
    queryFn: () => getParentEventReminder(eventId),
    enabled: !!user && canSetParentReminder,
    staleTime: 30_000,
  });

  const reminderMutation = useMutation({
    mutationFn: (next: { oneDayBefore: boolean; oneHourBefore: boolean }) =>
      upsertParentEventReminder(user!.id, eventId, next),
    onSuccess: (_data, next) => {
      qc.setQueryData(["parent-event-reminder", eventId], next);
      qc.invalidateQueries({ queryKey: ["parent-event-reminder", eventId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: AgendaEventStatus }) =>
      updateAgendaEventStatus(eventId, status),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      if (vars.status === "happened") {
        toast.success("Marcado como aconteceu. Quer registrar?", {
          action: {
            label: "Registrar",
            onClick: () => navigate({ to: "/registros" }),
          },
        });
      } else {
        toast.success("Marcado como não fui.");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ start, end }: { start: string; end: string | null }) =>
      rescheduleAgendaEvent(eventId, start, end),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      setRescheduleOpen(false);
      toast.success("Compromisso reagendado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateObsMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updateObservation(id, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda-observations", eventId] });
      setEditingObs(null);
      toast.success("Observação atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ scope }: { scope: "single" | "series" }) =>
      scope === "series" && event?.series_id
        ? deleteAgendaSeries(event.series_id, event.start_at)
        : deleteAgendaEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      setDeleteOpen(false);
      toast.success("Compromisso excluído.");
      navigate({ to: "/agenda" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createObsMutation = useMutation({
    mutationFn: async (vars: {
      data: AgendaObservationInput;
      pendingFiles?: File[];
    }) => {
      const obs = await createObservation(user!.id, vars.data);
      const files = vars.pendingFiles ?? [];
      let success = 0;
      const failed: string[] = [];
      for (const file of files) {
        try {
          await uploadObservationAttachment(user!.id, obs.id, file);
          success++;
        } catch (e) {
          failed.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      return { attachmentSuccess: success, attachmentFailed: failed };
    },
    onSuccess: ({ attachmentSuccess, attachmentFailed }) => {
      toast.success("Observação salva.");
      if (attachmentSuccess > 0) {
        toast.success(
          attachmentSuccess === 1
            ? "Anexo enviado."
            : `${attachmentSuccess} anexos enviados.`,
        );
      }
      for (const msg of attachmentFailed) toast.error(msg);
      qc.invalidateQueries({ queryKey: ["agenda-observations", eventId] });
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (eventsQuery.isLoading) {
    return (
      <AppShell hideMenu>
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!event) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => navigate({ to: "/agenda" })}
            className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
            style={{ color: "#6B7280" }}
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
            Agenda
          </button>
          <div className="mt-5 rounded-xl border bg-white p-6 text-center text-sm text-[#6B7280]">
            Esse compromisso não existe ou foi removido.
          </div>
        </div>
      </AppShell>
    );
  }

  const profName =
    event.professional?.name ?? event.professional_name_raw ?? null;
  const childName = event.child?.name ?? "";
  const heroSubtitle = [childName, profName ? `com ${profName}` : null]
    .filter(Boolean)
    .join(" · ");
  const isPast = new Date(event.start_at) < new Date();
  // Sessão pertencente ao próprio terapeuta logado
  const isOwnSession = isTherapist && (event as any).therapist_id === user?.id;
  const observations = observationsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];
  const recurrenceLabel = formatRecurrenceLabel(event.recurrence);
  const remindersLabel = formatRemindersLabel(event.reminders);

  const handleStatus = (status: AgendaEventStatus) => {
    if (status === "rescheduled") {
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date(event.start_at);
      setReDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setReTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      setRescheduleOpen(true);
      return;
    }
    statusMutation.mutate({ status });
  };

  const submitReschedule = () => {
    if (!reDate || !reTime) {
      toast.error("Escolha a nova data e hora.");
      return;
    }
    const newStart = combineDateTime(reDate, reTime);
    // preserva a duração, se houver
    let newEnd: string | null = null;
    if (event.end_at) {
      const dur = new Date(event.end_at).getTime() - new Date(event.start_at).getTime();
      if (dur > 0) newEnd = new Date(new Date(newStart).getTime() + dur).toISOString();
    }
    rescheduleMutation.mutate({ start: newStart, end: newEnd });
  };

  const promoteToRegistro = (obsId: string) => {
    navigate({
      to: "/registros",
      search: { prefillFromEvent: eventId, prefillObsId: obsId },
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/agenda" })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Agenda
        </button>

        {/* Hero */}
        <div className="pb-3 pt-1">
          <TypeChip type={event.type} size="lg" />
          <h1
            className="mt-3 text-[26px] font-extrabold leading-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
          >
            {event.title}
          </h1>
          {heroSubtitle && (
            <div className="mt-1 text-sm" style={{ color: "#6B7280" }}>
              {heroSubtitle}
            </div>
          )}
        </div>

        {/* Banner de pendentes (Tela 12) */}
        {pending.length > 0 && profName && (
          <PendingObservationsBanner
            professionalName={profName.split(" ").slice(0, 2).join(" ")}
            observations={pending}
            onOpenAll={() => {
              toast.message("Abrindo todas — em breve com leitor sequencial.");
            }}
          />
        )}

        {/* Card "Detalhes" */}
        <div
          className="mt-4 rounded-2xl border bg-white px-3.5 py-1"
          style={{ borderColor: "#EEF0F4" }}
        >
          <DetailRow
            icon={<Calendar size={18} strokeWidth={1.7} color={AGENDA_BRAND.col} />}
            label="Quando"
            value={formatWhenLine(event.start_at, event.end_at)}
          />
          {event.locale && (
            <DetailRow
              icon={<MapPin size={18} strokeWidth={1.7} color={AGENDA_BRAND.col} />}
              label="Onde"
              value={event.locale}
            />
          )}
          {recurrenceLabel && (
            <DetailRow
              icon={<Repeat size={18} strokeWidth={1.7} color={AGENDA_BRAND.col} />}
              label="Recorrência"
              value={recurrenceLabel}
            />
          )}
          <DetailRow
            icon={<Bell size={18} strokeWidth={1.7} color={AGENDA_BRAND.col} />}
            label="Lembretes"
            value={remindersLabel ?? "Sem lembretes"}
            isLast
          />
        </div>

        {/* Módulo de lembrete do RESPONSÁVEL (sessões do terapeuta, futuras) */}
        {canSetParentReminder && !isPast && (
          <ParentReminderCard
            value={reminderQuery.data ?? { oneDayBefore: false, oneHourBefore: false }}
            loading={reminderQuery.isLoading}
            saving={reminderMutation.isPending}
            onChange={(next) => reminderMutation.mutate(next)}
          />
        )}

        {/* Observações — apenas para pais/responsáveis (não para sessões do terapeuta) */}
        {!isOwnSession && (
          <>
            <div className="mt-6 mb-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <h2
                  className="text-base font-extrabold"
                  style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
                >
                  Observações
                </h2>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "#9CA3AF" }}
                >
                  {observations.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="inline-flex h-8 items-center gap-1 rounded-[9px] px-3 text-[12.5px] font-bold text-white transition-transform hover:-translate-y-px"
                style={{
                  background: AGENDA_BRAND.col,
                  boxShadow: "0 8px 18px -8px rgba(124,58,237,0.35)",
                }}
              >
                <Plus size={14} strokeWidth={2.2} />
                Anotar
              </button>
            </div>
            {observations.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm"
                style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
              >
                Sem observações por enquanto. Toque em "Anotar" pra registrar a primeira.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {observations.map((obs) => (
                  <NoteCardWithAttachments
                    key={obs.id}
                    observationId={obs.id}
                    observation={obs}
                    reminderLabel={
                      obs.reminder_enabled && obs.reminder_fire_at
                        ? `Lembrar na próxima consulta com ${
                            professionalsQuery.data?.find(
                              (p) => p.id === obs.reminder_target_professional_id,
                            )?.name ?? "o profissional"
                          }`
                        : null
                    }
                    onPromote={() => promoteToRegistro(obs.id)}
                    onEdit={() => setEditingObs({ id: obs.id, text: obs.text })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Lembrete da sessão anterior — propagado via pointsToContinue do registro anterior */}
        {isOwnSession && (event as any).session_plan?.objectives_from_previous && (
          <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Bell size={14} color="#D97706" />
              <span className="text-xs font-semibold text-amber-700">Lembrete da sessão anterior</span>
            </div>
            <p className="text-sm text-amber-800 whitespace-pre-wrap leading-relaxed">
              {(event as any).session_plan.objectives_from_previous}
            </p>
          </div>
        )}

        {/* ── Ações de sessão para TERAPEUTA ──────────────────────────── */}
        {isTherapist && (() => {
          if (!isOwnSession) return null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const evAny = event as any;

          const attendance = evAny.session_attendance as string | null;
          const hasDraft    = sessionRecord && sessionRecord.is_draft === true;
          const hasPublished = sessionRecord && sessionRecord.is_draft === false;

          let primaryCTA: React.ReactNode = null;
          let secondaryCTA: React.ReactNode = null;

          if (hasPublished) {
            // Registro publicado — ver apenas
            primaryCTA = (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/agenda/sessao/$eventId/registro" as any, params: { eventId } as any })
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white"
                style={{ background: TEAL }}
              >
                <Eye size={16} strokeWidth={2} />
                Ver registro publicado
              </button>
            );
          } else if (hasDraft) {
            // Rascunho — continuar
            primaryCTA = (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/agenda/sessao/$eventId/registro" as any, params: { eventId } as any })
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white"
                style={{ background: TEAL }}
              >
                <ClipboardEdit size={16} strokeWidth={2} />
                Continuar registro
              </button>
            );
          } else if (attendance === "happened" || (isPast && !attendance)) {
            // Sessão passada sem registro — Registrar em destaque, Planejar como secundário
            primaryCTA = (
              <button
                type="button"
                onClick={() =>
                  attendance === "happened"
                    ? navigate({ to: "/agenda/sessao/$eventId/registro" as any, params: { eventId } as any })
                    : navigate({ to: "/agenda/sessao/$eventId/confirmacao" as any, params: { eventId } as any })
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white"
                style={{ background: TEAL }}
              >
                <ClipboardCheck size={16} strokeWidth={2} />
                Registrar sessão
              </button>
            );
            // Permite preencher o plano retroativamente (caso não tenha planejado antes)
            secondaryCTA = (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/agenda/sessao/$eventId/plano" as any, params: { eventId } as any })
                }
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border bg-white text-[14px] font-bold transition-colors hover:bg-[#F4F5FA]"
                style={{ borderColor: "#E5E7EB", color: "#0F172A" }}
              >
                <ClipboardEdit size={16} strokeWidth={2} />
                Planejar sessão
              </button>
            );
          } else if (!isPast) {
            // Futura — planejar
            primaryCTA = (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/agenda/sessao/$eventId/plano" as any, params: { eventId } as any })
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white"
                style={{ background: TEAL }}
              >
                <ClipboardEdit size={16} strokeWidth={2} />
                Planejar sessão
              </button>
            );
            secondaryCTA = (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/agenda/sessao/$eventId/confirmacao" as any, params: { eventId } as any })
                }
                className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border bg-white text-[14px] font-bold transition-colors hover:bg-[#F4F5FA]"
                style={{ borderColor: "#E5E7EB", color: "#0F172A" }}
              >
                <ClipboardCheck size={16} strokeWidth={2} />
                Confirmar comparecimento
              </button>
            );
          }

          if (!primaryCTA && !secondaryCTA) return null;

          return (
            <div className="mt-6 flex flex-col gap-2">
              {primaryCTA}
              {secondaryCTA}
            </div>
          );
        })()}

        {/* Após o compromisso (só para PAIS — e NÃO em sessões do terapeuta:
            quem confirma o comparecimento de uma sessão é o próprio terapeuta) */}
        {!isTherapist && isPast && !isTherapistEvent && (
          <div className="mt-6">
            <AfterAppointmentActions
              currentStatus={event.status}
              onChoose={handleStatus}
            />
          </div>
        )}

        {/* Aviso: sessão do terapeuta — confirmação é do profissional */}
        {!isTherapist && isTherapistEvent && isPast && (
          <div
            className="mt-6 rounded-xl border px-4 py-3 flex items-start gap-2"
            style={{ borderColor: "#CCFBF1", background: "#F0FDFA" }}
          >
            <ClipboardCheck size={16} strokeWidth={1.8} color={TEAL} className="flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] leading-relaxed" style={{ color: "#0F766E" }}>
              O comparecimento desta sessão é confirmado pelo terapeuta. Você pode
              registrar suas observações abaixo.
            </p>
          </div>
        )}

        {/* Ações primárias (só para PAIS) */}
        {!isTherapist && (
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/registros",
                  search: { prefillFromEvent: eventId },
                })
              }
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white transition-transform hover:-translate-y-px"
              style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
            >
              Registrar atendimento
              <ArrowRight size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/compartilhamentos",
                  search: { prefillEventId: eventId },
                })
              }
              className="flex h-[46px] items-center justify-center gap-2 rounded-xl border bg-white text-[14px] font-bold transition-colors hover:bg-[#F4F5FA]"
              style={{ borderColor: "#E5E7EB", color: "#0F172A" }}
            >
              Compartilhar evento via link
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Excluir — só compromissos do próprio pai (não sessões do terapeuta) */}
        {!isTherapist && !isTherapistEvent && (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[13.5px] font-bold transition-colors hover:bg-red-50"
            style={{ borderColor: "#FECACA", color: "#DC2626" }}
          >
            <Trash2 size={16} strokeWidth={2} />
            Excluir compromisso
          </button>
        )}

        <div className="h-8" />
      </div>

      {!isOwnSession && (
        <ObservationFormSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSubmit={async (data, pendingFiles) => {
            await createObsMutation.mutateAsync({ data, pendingFiles });
          }}
          submitting={createObsMutation.isPending}
          eventId={eventId}
          professionals={professionalsQuery.data ?? []}
          currentEventProfessional={
            event.professional
              ? { id: event.professional.id, name: event.professional.name }
              : null
          }
        />
      )}

      {/* Reagendar */}
      {rescheduleOpen && (
        <CenterModal onClose={() => setRescheduleOpen(false)} title="Reagendar compromisso">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-[#4B5563]">Nova data</label>
              <input
                type="date"
                value={reDate}
                onChange={(e) => setReDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F6F7FB] px-3 text-[14px] outline-none focus:border-[#7C3AED]"
                style={{ colorScheme: "light" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-[#4B5563]">Nova hora</label>
              <input
                type="time"
                value={reTime}
                onChange={(e) => setReTime(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F6F7FB] px-3 text-[14px] outline-none focus:border-[#7C3AED]"
                style={{ colorScheme: "light" }}
              />
            </div>
          </div>
          {event.series_id && (
            <p className="mt-2 text-[12px] leading-snug text-[#9CA3AF]">
              Isto move apenas esta ocorrência da série.
            </p>
          )}
          <button
            type="button"
            disabled={rescheduleMutation.isPending}
            onClick={submitReschedule}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            {rescheduleMutation.isPending && <Loader2 size={15} className="animate-spin" />}
            Salvar nova data
          </button>
        </CenterModal>
      )}

      {/* Editar observação */}
      {editingObs && (
        <CenterModal onClose={() => setEditingObs(null)} title="Editar observação">
          <textarea
            value={editingObs.text}
            onChange={(e) => setEditingObs((p) => (p ? { ...p, text: e.target.value } : p))}
            rows={5}
            maxLength={5000}
            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F6F7FB] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#7C3AED]"
            style={{ color: "#0F172A", resize: "vertical" }}
          />
          <button
            type="button"
            disabled={updateObsMutation.isPending || !editingObs.text.trim()}
            onClick={() => updateObsMutation.mutate({ id: editingObs.id, text: editingObs.text })}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            {updateObsMutation.isPending && <Loader2 size={15} className="animate-spin" />}
            Salvar
          </button>
        </CenterModal>
      )}

      {/* Excluir (com opção de série) */}
      {deleteOpen && (
        <CenterModal onClose={() => setDeleteOpen(false)} title="Excluir compromisso">
          <p className="text-[13.5px] leading-relaxed text-[#4B5563]">
            {event.series_id
              ? "Este compromisso faz parte de uma série recorrente. O que deseja excluir?"
              : "Tem certeza que deseja excluir este compromisso?"}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ scope: "single" })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white disabled:opacity-60"
              style={{ background: "#DC2626" }}
            >
              {deleteMutation.isPending && <Loader2 size={15} className="animate-spin" />}
              {event.series_id ? "Excluir só este" : "Excluir"}
            </button>
            {event.series_id && (
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ scope: "series" })}
                className="flex h-11 w-full items-center justify-center rounded-xl border text-[14px] font-bold disabled:opacity-60"
                style={{ borderColor: "#FECACA", color: "#DC2626" }}
              >
                Excluir esta e as próximas
              </button>
            )}
          </div>
        </CenterModal>
      )}
    </AppShell>
  );
}

/** Modal centralizado simples reutilizado nas ações do detalhe. */
function CenterModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full rounded-t-3xl bg-white px-5 pb-6 pt-4 shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:max-w-sm sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold tracking-tight text-[#0F172A]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[15px] text-[#9CA3AF] hover:bg-[#E5E7EB]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ParentReminderCard({
  value,
  loading,
  saving,
  onChange,
}: {
  value: { oneDayBefore: boolean; oneHourBefore: boolean };
  loading: boolean;
  saving: boolean;
  onChange: (next: { oneDayBefore: boolean; oneHourBefore: boolean }) => void;
}) {
  const TEAL = "#0D9488";
  const rows: { key: "oneDayBefore" | "oneHourBefore"; label: string }[] = [
    { key: "oneDayBefore", label: "1 dia antes" },
    { key: "oneHourBefore", label: "1 hora antes" },
  ];
  return (
    <div
      className="mt-4 rounded-2xl border bg-white px-4 py-3.5"
      style={{ borderColor: "#CCFBF1" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Bell size={16} strokeWidth={1.8} color={TEAL} />
        <span className="text-[14px] font-bold" style={{ color: "#0F172A" }}>
          Meu lembrete
        </span>
        {saving && <span className="text-[11px] text-[#9CA3AF]">salvando…</span>}
      </div>
      <p className="text-[12px] text-[#6B7280] mb-2 leading-relaxed">
        Receba um aviso antes desta sessão. O lembrete é só seu.
      </p>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ key, label }) => {
          const active = value[key];
          return (
            <button
              key={key}
              type="button"
              disabled={loading || saving}
              onClick={() => onChange({ ...value, [key]: !active })}
              className="flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-60"
              style={
                active
                  ? { borderColor: TEAL, background: "#F0FDFA" }
                  : { borderColor: "#E5E7EB", background: "white" }
              }
            >
              <span
                className="text-[13.5px] font-semibold"
                style={{ color: active ? TEAL : "#374151" }}
              >
                {label}
              </span>
              <span
                className="ml-auto flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors"
                style={{ background: active ? TEAL : "#D1D5DB" }}
              >
                <span
                  className="h-4 w-4 rounded-full bg-white shadow transition-transform"
                  style={{ transform: active ? "translateX(18px)" : "translateX(2px)" }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NoteCardWithAttachments({
  observationId,
  observation,
  reminderLabel,
  onPromote,
  onEdit,
}: {
  observationId: string;
  observation: Parameters<typeof NoteCard>[0]["observation"];
  reminderLabel: string | null;
  onPromote: () => void;
  onEdit: () => void;
}) {
  const attsQuery = useQuery({
    queryKey: ["agenda-obs-attachments", observationId],
    queryFn: () => listObservationAttachments(observationId),
  });
  const attachments = (attsQuery.data ?? []).map((a) => ({
    filename: a.filename,
    kind: a.kind,
    durationSeconds: a.duration_seconds,
    sizeBytes: a.size_bytes,
  }));
  return (
    <NoteCard
      observation={observation}
      attachments={attachments}
      reminderLabel={reminderLabel}
      onPromote={onPromote}
      onEdit={onEdit}
    />
  );
}
