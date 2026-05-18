import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bell, Calendar, FileImage, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { listProfessionals } from "@/services/professionals.service";
import { listAttendanceRecords } from "@/services/attendance.service";
import { listAgendaEvents } from "@/services/agenda/events.service";
import {
  dismissAllByProfessional,
  listPendingObservationsByProfessional,
} from "@/services/agenda/observations.service";
import { AGENDA_BRAND, ALERT_TONE } from "@/lib/agenda/tokens";
import { getInitial } from "@/lib/formatters";
import type { AgendaObservation } from "@/types/agenda";
import { MOCK_EVENT_ORIGIN } from "@/services/agenda/observations.service";

export const Route = createFileRoute("/_auth/profissionais_/$professionalId")({
  head: () => ({ meta: [{ title: "Profissional — TEAmo" }] }),
  component: ProfessionalDetailPage,
});

type TabKey = "dados" | "historico" | "pendentes";

const MONTHS_PT_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function formatNextConsultDate(d: Date): string {
  return `quarta, ${d.getDate()} de ${MONTHS_PT_SHORT[d.getMonth()]}`;
}

function ProfessionalDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { professionalId } = Route.useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("pendentes");

  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });

  const pendingQuery = useQuery({
    queryKey: ["agenda-pending-by-prof", professionalId],
    queryFn: () => listPendingObservationsByProfessional(professionalId),
    enabled: !!user,
  });

  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: listAgendaEvents,
    enabled: !!user,
  });

  const recordsQuery = useQuery({
    queryKey: ["attendance-records"],
    queryFn: listAttendanceRecords,
    enabled: !!user && tab === "historico",
  });

  const dismissAllMutation = useMutation({
    mutationFn: () => dismissAllByProfessional(professionalId),
    onSuccess: () => {
      toast.success("Observações marcadas como vistas.");
      qc.invalidateQueries({ queryKey: ["agenda-pending-by-prof"] });
      qc.invalidateQueries({ queryKey: ["agenda-pending-obs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (professionalsQuery.isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const professional = professionalsQuery.data?.find(
    (p) => p.id === professionalId,
  );
  if (!professional) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => navigate({ to: "/profissionais" })}
            className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
            style={{ color: "#6B7280" }}
          >
            <ArrowLeft size={18} strokeWidth={1.8} />
            Profissionais
          </button>
          <div className="mt-5 rounded-xl border bg-white p-6 text-center text-sm text-[#6B7280]">
            Profissional não encontrado.
          </div>
        </div>
      </AppShell>
    );
  }

  const pending = pendingQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const records = recordsQuery.data ?? [];

  // Calcula próximo evento desse profissional (futuro mais próximo)
  const now = new Date();
  const nextEvent = events
    .filter(
      (e) =>
        e.professional?.id === professionalId &&
        new Date(e.start_at) > now &&
        e.status === "upcoming",
    )
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];

  const proConsultaText = nextEvent
    ? `próxima consulta em ${
        Math.ceil(
          (new Date(nextEvent.start_at).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        )
      } dia${
        Math.ceil(
          (new Date(nextEvent.start_at).getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        ) !== 1
          ? "s"
          : ""
      }`
    : "sem próxima consulta marcada";

  const recordsByProf = records.filter((r) => r.professional?.id === professionalId);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/profissionais" })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Profissionais
        </button>

        {/* Hero do profissional */}
        <div className="mt-1 mb-4 flex items-center gap-3.5">
          <div
            className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold"
            style={{
              background:
                "linear-gradient(135deg, #FDF2F8 0%, #FBD9EC 100%)",
              color: "#EC4899",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.7)",
            }}
          >
            {getInitial(professional.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="text-xl font-extrabold leading-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              {professional.name}
            </h1>
            <div className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
              {professional.specialty} · {proConsultaText}
            </div>
          </div>
        </div>

        {/* Abas */}
        <div
          className="flex gap-0 border-b"
          style={{ borderColor: "#EEF0F4" }}
        >
          <TabBtn
            label="Dados"
            active={tab === "dados"}
            onClick={() => setTab("dados")}
          />
          <TabBtn
            label="Histórico"
            active={tab === "historico"}
            onClick={() => setTab("historico")}
          />
          <TabBtn
            label="Observações pendentes"
            active={tab === "pendentes"}
            onClick={() => setTab("pendentes")}
            badge={pending.length > 0 ? pending.length : undefined}
          />
        </div>

        <div className="mt-4">
          {tab === "dados" && (
            <DadosTab
              email={professional.email}
              phone={professional.phone}
            />
          )}
          {tab === "historico" && (
            <HistoricoTab
              records={recordsByProf}
              loading={recordsQuery.isLoading}
            />
          )}
          {tab === "pendentes" && (
            <PendentesTab
              observations={pending}
              nextEventDate={nextEvent ? new Date(nextEvent.start_at) : null}
              onMarkAll={() => dismissAllMutation.mutate()}
              onOpenObs={(obs) =>
                navigate({
                  to: "/agenda/$eventId",
                  params: { eventId: obs.event_id },
                })
              }
            />
          )}
        </div>

        <div className="h-10" />
      </div>
    </AppShell>
  );
}

function TabBtn({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-bold transition-colors"
      style={{
        color: active ? "#0F172A" : "#9CA3AF",
        borderBottom: active
          ? `2.5px solid ${AGENDA_BRAND.col}`
          : "2.5px solid transparent",
        marginBottom: -1,
      }}
    >
      {label}
      {badge !== undefined && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-white"
          style={{ background: AGENDA_BRAND.col }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function DadosTab({
  email,
  phone,
}: {
  email: string;
  phone: string | null;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: "#EEF0F4" }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[10px]"
          style={{ background: "#F4F5FA" }}
        >
          <Mail size={16} strokeWidth={1.7} color="#6B7280" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[11.5px] font-bold uppercase tracking-[0.04em]"
            style={{ color: "#9CA3AF" }}
          >
            E-mail
          </div>
          <div className="truncate text-sm font-semibold" style={{ color: "#0F172A" }}>
            {email}
          </div>
        </div>
      </div>
      {phone && (
        <>
          <div className="h-px bg-[#F1F2F6]" />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px]"
              style={{ background: "#F4F5FA" }}
            >
              <Phone size={16} strokeWidth={1.7} color="#6B7280" />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="text-[11.5px] font-bold uppercase tracking-[0.04em]"
                style={{ color: "#9CA3AF" }}
              >
                Telefone
              </div>
              <div className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                {phone}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HistoricoTab({
  records,
  loading,
}: {
  records: Array<{ id: string; record_date: string; content: string; child: { name: string } | null }>;
  loading: boolean;
}) {
  if (loading) return <LoadingSpinner />;
  if (records.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
        style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
      >
        Nenhum registro vinculado a este profissional ainda.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {records.map((r) => (
        <div
          key={r.id}
          className="rounded-2xl border bg-white p-3.5"
          style={{ borderColor: "#EEF0F4" }}
        >
          <div
            className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.04em]"
            style={{ color: "#9CA3AF" }}
          >
            {new Date(r.record_date).toLocaleDateString("pt-BR")}
            {r.child?.name ? ` · ${r.child.name}` : ""}
          </div>
          <div
            className="line-clamp-3 text-[13.5px] leading-relaxed"
            style={{ color: "#0F172A" }}
          >
            {r.content}
          </div>
        </div>
      ))}
    </div>
  );
}

function PendentesTab({
  observations,
  nextEventDate,
  onMarkAll,
  onOpenObs,
}: {
  observations: AgendaObservation[];
  nextEventDate: Date | null;
  onMarkAll: () => void;
  onOpenObs: (obs: AgendaObservation) => void;
}) {
  if (observations.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm"
        style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
      >
        Sem observações pendentes para mencionar a este profissional.
      </div>
    );
  }
  return (
    <>
      {/* Card laranja resumo */}
      <div
        className="mb-4 flex items-center gap-3 rounded-2xl px-3.5 py-3"
        style={{
          background: ALERT_TONE.background,
          border: `1px solid ${ALERT_TONE.border}`,
        }}
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] bg-white">
          <Bell size={18} strokeWidth={1.7} color={ALERT_TONE.bodyColor} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[13.5px] font-extrabold"
            style={{ color: ALERT_TONE.titleColor, letterSpacing: "-0.005em" }}
          >
            {observations.length === 1
              ? "1 coisa pra mencionar"
              : `${observations.length} coisas pra mencionar`}
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: ALERT_TONE.bodyColor }}>
            {nextEventDate
              ? `Na próxima consulta · ${formatNextConsultDate(nextEventDate)}`
              : "Sem consulta futura agendada"}
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "#9CA3AF" }}
        >
          Anotações
        </div>
        <button
          type="button"
          onClick={onMarkAll}
          className="bg-transparent text-[12px] font-bold transition-colors hover:underline"
          style={{ color: AGENDA_BRAND.col }}
        >
          Marcar todas como vistas
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        {observations.map((o) => {
          const origin = MOCK_EVENT_ORIGIN[o.event_id];
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onOpenObs(o)}
              className="relative rounded-2xl border bg-white p-3.5 text-left transition-shadow hover:shadow-md"
              style={{ borderColor: "#EEF0F4" }}
            >
              <span
                className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-full"
                style={{ background: AGENDA_BRAND.col }}
              />
              <div className="pl-2">
                {origin && (
                  <div
                    className="mb-1.5 inline-flex items-center gap-1.5 text-[11.5px] font-bold"
                    style={{ color: AGENDA_BRAND.col }}
                  >
                    <Calendar size={13} strokeWidth={1.7} color={AGENDA_BRAND.col} />
                    {origin.title} · {origin.dateLabel}
                  </div>
                )}
                <div
                  className="text-[13.5px] leading-relaxed"
                  style={{ color: "#0F172A" }}
                >
                  {o.text}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
