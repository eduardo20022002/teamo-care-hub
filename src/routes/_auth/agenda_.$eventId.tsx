import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  ClipboardCheck,
  ClipboardEdit,
  Eye,
  MapPin,
  Plus,
  Repeat,
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
} from "@/services/agenda/events.service";
import { getProfile } from "@/services/profile.service";
import { getRole } from "@/lib/roles";
import { useGetSessionRecord } from "@/services/therapist.service";
import { getPatientColor } from "@/lib/agenda/tokens";
import {
  listObservationsByEvent,
  listPendingObservationsByEvent,
  createObservation,
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
import { formatEventTimeRange } from "@/lib/agenda/format";
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
    queryFn: listAgendaEvents,
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
      } else if (vars.status === "rescheduled") {
        toast.message("Reagendamento em breve. Por ora, edite o compromisso.");
      } else {
        toast.success("Marcado como não fui.");
      }
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
    statusMutation.mutate({ status });
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
                    onEdit={() =>
                      toast.message("Edição de observação — em breve.")
                    }
                  />
                ))}
              </div>
            )}
          </>
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
            // Sessão passada sem registro
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

        {/* Após o compromisso (só para PAIS) */}
        {!isTherapist && isPast && (
          <div className="mt-6">
            <AfterAppointmentActions
              currentStatus={event.status}
              onChoose={handleStatus}
            />
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
    </AppShell>
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
