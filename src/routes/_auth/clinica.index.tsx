import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users, ClipboardCheck, Calendar, AlertCircle, RefreshCw,
  Clock, CheckCircle2, XCircle, ChevronRight, ArrowRight, Users2,
  Link2, Copy, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { getAuthorizationAlertsServer } from "@/lib/clinic-financial.functions";
import { listGroupsServer } from "@/lib/clinic-groups.functions";
import { listQueueEntriesServer } from "@/lib/queue.functions";
import { listClinicSessionsServer } from "@/lib/clinic-agenda.functions";
import { authHeaders } from "@/lib/auth-headers";
import { useServerFn } from "@tanstack/react-start";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { formatAge } from "@/lib/formatters";

export const Route = createFileRoute("/_auth/clinica/")({
  head: () => ({
    meta: [{ title: "Home — Clínica TEAmo" }],
  }),
  component: ClinicDashboard,
});

// Mock data structure — will be replaced by real queries in Phase 2+
interface QueueSummary {
  total: number;
  alta: number;
  moderada: number;
  rotina: number;
}

interface TodaySession {
  id:            string;
  patientName:   string;
  therapistName?: string;
  room?:         string;
  time:          string;
  status:        "realizada" | "confirmada" | "aguardando" | "falta";
}

interface PriorityQueueEntry {
  id:         string;
  name:       string;
  ageText:    string;
  tier:       "alta" | "moderada" | "rotina";
  daysInQueue: number;
}

interface PendingAction {
  id:      string;
  type:    "evaluation" | "authorization" | "replacement" | "absence";
  message: string;
  cta:     string;
  ctaTo:   string;
  urgent:  boolean;
}

const STATUS_CONFIG = {
  realizada:  { label: "Realizada",  bg: "#DCFCE7", color: "#16A34A" },
  confirmada: { label: "Confirmada", bg: "#DBEAFE", color: "#2563EB" },
  aguardando: { label: "Aguardando", bg: "#FEF9C3", color: "#CA8A04" },
  falta:      { label: "Falta",      bg: "#FEE2E2", color: "#DC2626" },
};

const TIER_CONFIG = {
  alta:     { label: "Alta",     bg: "#FEE2E2", color: "#EF4444" },
  moderada: { label: "Moderada", bg: "#FEF9C3", color: "#EAB308" },
  rotina:   { label: "Rotina",   bg: "#DCFCE7", color: "#22C55E" },
};

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  badge,
}: {
  title:      string;
  value:      string | number;
  subtitle?:  React.ReactNode;
  icon:       React.FC<{ size: number; color: string }>;
  iconColor:  string;
  iconBg:     string;
  badge?:     React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-3"
      style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</span>
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={16} color={iconColor} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {badge}
      </div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  );
}

function TierBadge({ tier }: { tier: "alta" | "moderada" | "rotina" }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

function EmptyState({ message, cta, ctaTo }: { message: string; cta?: string; ctaTo?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
        <CheckCircle2 size={20} className="text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{message}</p>
      {cta && ctaTo && (
        <Link
          to={ctaTo as "/clinica"}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
        >
          {cta} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

function ClinicDashboard() {
  const { user } = useAuth();
  const [linkCopied, setLinkCopied] = useState(false);
  const getClinic = useServerFn(getMyClinicServer);
  const getAlerts = useServerFn(getAuthorizationAlertsServer);
  const listGroups = useServerFn(listGroupsServer);

  const listQueue = useServerFn(listQueueEntriesServer);
  const listSessions = useServerFn(listClinicSessionsServer);

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const clinicId = clinicQuery.data?.clinic?.id ?? "";

  const alertsQuery = useQuery({
    queryKey: ["authorizationAlerts", clinicId],
    queryFn: async () => getAlerts({ data: { clinicId }, headers: await authHeaders() }),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const groupsQuery = useQuery({
    queryKey: ["clinicGroupsDashboard", clinicId],
    queryFn: async () => listGroups({ data: { clinicId, status: "ativo" }, headers: await authHeaders() }),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const queueQuery = useQuery({
    queryKey: ["dashboardQueue", clinicId],
    queryFn: async () => listQueue({ data: { clinicId }, headers: await authHeaders() }),
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const sessionsQuery = useQuery({
    queryKey: ["dashboardSessionsToday", clinicId, todayStr],
    queryFn: async () => listSessions({ data: { clinicId, weekStart: todayStr }, headers: await authHeaders() }),
    enabled: !!clinicId,
    staleTime: 30_000,
  });

  if (clinicQuery.isLoading) {
    return <LoadingSpinner label="Carregando dashboard..." />;
  }

  const clinic = clinicQuery.data?.clinic;
  if (!clinic) return null;

  const displayName = (() => {
    const meta = user?.user_metadata as { display_name?: string } | undefined;
    return meta?.display_name?.trim() ?? user?.email?.split("@")[0] ?? "Coordenador";
  })();

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // Real queue metrics
  const allQueueEntries = Array.isArray(queueQuery.data) ? queueQuery.data : [];
  const activeQueueEntries = allQueueEntries.filter(
    (e) => e.status === "aguardando" || e.status === "em_avaliacao",
  );
  const queueSummary: QueueSummary = {
    total: activeQueueEntries.length,
    alta:     activeQueueEntries.filter((e) => e.priority_tier === "alta").length,
    moderada: activeQueueEntries.filter((e) => e.priority_tier === "moderada").length,
    rotina:   activeQueueEntries.filter((e) => e.priority_tier === "rotina").length,
  };

  const avaliacoesCount = allQueueEntries.filter((e) => e.status === "em_avaliacao").length;

  const priorityQueue: PriorityQueueEntry[] = activeQueueEntries.slice(0, 5).map((e) => ({
    id:          e.id,
    name:        e.child_name,
    ageText:     formatAge(e.child_birthdate),
    tier:        e.priority_tier === "triagem" ? "rotina" : e.priority_tier,
    daysInQueue: Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86_400_000),
  }));

  // Real sessions today
  const rawSessions =
    sessionsQuery.data?.ok
      ? sessionsQuery.data.sessions.filter((s) => s.session_date === todayStr)
      : [];

  const SESSION_STATUS_MAP: Record<string, TodaySession["status"]> = {
    realizada:               "realizada",
    agendada:                "confirmada",
    falta_justificada:       "falta",
    falta_nao_justificada:   "falta",
    cancelada_clinica:       "falta",
  };

  const todaySessions: TodaySession[] = rawSessions.map((s) => ({
    id:          s.id,
    patientName: s.patient_name,
    time:        s.start_time.slice(0, 5),
    status:      SESSION_STATUS_MAP[s.status] ?? "aguardando",
  }));

  const authAlerts = alertsQuery.data?.ok ? alertsQuery.data.alerts : [];
  const authorizationsExpiringCount = authAlerts.filter((a) => a.daysUntilExpiry <= 30).length;
  const renewalsDue = authAlerts.filter((a) => a.daysUntilExpiry <= 60).length;

  const publicLink = clinic?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : "https://teamotech.online"}/fila-espera/${clinic.slug}`
    : null;

  const handleCopyLink = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const activeGroups = groupsQuery.data?.ok ? groupsQuery.data.groups : [];
  const groupsWithVacancy = activeGroups.filter(
    (g) => (g.member_count ?? 0) < g.capacity_max
  );

  // Build pending actions from real authorization alerts
  const pendingActions: PendingAction[] = [
    ...authAlerts
      .filter((a) => a.daysUntilExpiry <= 30 || a.sessionsRemaining <= 10)
      .slice(0, 3)
      .map((a) => ({
        id:      a.authorizationId,
        type:    "authorization" as const,
        message: a.sessionsRemaining <= 10
          ? `Cota crítica — ${a.patientName}, ${a.sessionsRemaining} sessões restantes`
          : `Autorização vencendo — ${a.patientName}, ${a.daysUntilExpiry}d restantes`,
        cta:     "Renovar",
        ctaTo:   "/clinica/financeiro",
        urgent:  a.alertLevel === "critical",
      })),
    ...groupsWithVacancy.slice(0, 2).map((g) => ({
      id:      g.id,
      type:    "evaluation" as const,
      message: `Vaga disponível em ${g.name} — ${g.capacity_max - (g.member_count ?? 0)} candidato${g.capacity_max - (g.member_count ?? 0) > 1 ? "s" : ""} elegível${g.capacity_max - (g.member_count ?? 0) > 1 ? "is" : ""}`,
      cta:     "Ver candidatos",
      ctaTo:   `/clinica/grupos/${g.id}`,
      urgent:  false,
    })),
  ];

  return (
    <div className="px-6 py-6 max-w-[1440px] mx-auto flex flex-col gap-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {displayName}.
        </h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">
          {today} · {clinic.name}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Fila de espera"
          value={queueSummary.total}
          subtitle={
            queueSummary.total > 0 ? (
              <div className="flex gap-2 flex-wrap">
                <TierBadge tier="alta" />
                <span className="text-gray-400">{queueSummary.alta}</span>
                <TierBadge tier="moderada" />
                <span className="text-gray-400">{queueSummary.moderada}</span>
                <TierBadge tier="rotina" />
                <span className="text-gray-400">{queueSummary.rotina}</span>
              </div>
            ) : "Nenhum caso em espera"
          }
          icon={Users}
          iconColor="#4F46E5"
          iconBg="#EEF2FF"
        />
        <MetricCard
          title="Avaliações"
          value={avaliacoesCount}
          subtitle="Em sessão ou aguardando relatório"
          icon={ClipboardCheck}
          iconColor="#7C3AED"
          iconBg="#F5F3FF"
        />
        <MetricCard
          title="Sessões hoje"
          value={todaySessions.length}
          subtitle={
            todaySessions.length > 0 ? (
              <span className="flex gap-1.5 items-center">
                <CheckCircle2 size={12} className="text-green-500" />
                <span>{todaySessions.filter(s => s.status === "realizada").length} realizadas</span>
                <XCircle size={12} className="text-red-500 ml-1" />
                <span>{todaySessions.filter(s => s.status === "falta").length} faltas</span>
              </span>
            ) : "Nenhuma sessão hoje"
          }
          icon={Calendar}
          iconColor="#EC4899"
          iconBg="#FDF2F8"
        />
        <MetricCard
          title="Autorizações"
          value={authorizationsExpiringCount}
          subtitle="Vencendo em menos de 30 dias"
          icon={AlertCircle}
          iconColor="#EF4444"
          iconBg="#FEF2F2"
        />
        <MetricCard
          title="Renovações"
          value={renewalsDue}
          subtitle="Próximos 60 dias"
          icon={RefreshCw}
          iconColor="#F59E0B"
          iconBg="#FFFBEB"
        />
      </div>

      {/* Card de formulários */}
      <div
        className="bg-white rounded-xl p-5 flex flex-col gap-4"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
              <Link2 size={14} color="#16A34A" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Formulários públicos</h2>
          </div>
          <Link
            to="/clinica/configuracoes"
            className="text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            Configurar →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Form 1 */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{
              border: `1px solid ${publicLink ? "#BBF7D0" : "#FDE68A"}`,
              background: publicLink ? "#F0FDF4" : "#FFFBEB",
            }}
          >
            <div>
              <p className="text-xs font-bold text-gray-700">Form 1 — Fila de espera</p>
              <p className="text-xs text-gray-500 mt-0.5">Link público para famílias solicitarem vaga</p>
            </div>
            {publicLink ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: linkCopied ? "#16A34A" : "white",
                    color: linkCopied ? "white" : "#16A34A",
                    border: "1px solid #86EFAC",
                  }}
                >
                  {linkCopied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
                  {linkCopied ? "Copiado!" : "Copiar link"}
                </button>
                <a
                  href={publicLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-green-700 font-medium hover:underline"
                >
                  <ExternalLink size={11} /> Abrir
                </a>
              </div>
            ) : (
              <Link
                to="/clinica/configuracoes"
                className="text-xs text-amber-700 font-semibold hover:underline"
              >
                Configurar slug →
              </Link>
            )}
          </div>

          {/* Form 2 */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid #E0E7FF", background: "#EEF2FF" }}
          >
            <div>
              <p className="text-xs font-bold text-gray-700">Form 2 — Confirmação de horário</p>
              <p className="text-xs text-gray-500 mt-0.5">Gerado por caso na Fila de Espera</p>
            </div>
            <Link
              to="/clinica/fila"
              className="flex items-center gap-1 text-xs text-indigo-700 font-semibold hover:underline"
            >
              <ChevronRight size={11} /> Ir para a Fila
            </Link>
          </div>

          {/* Form 3 */}
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid #D1FAE5", background: "#ECFDF5" }}
          >
            <div>
              <p className="text-xs font-bold text-gray-700">Form 3 — Cadastro completo</p>
              <p className="text-xs text-gray-500 mt-0.5">Gerado após finalização do relatório</p>
            </div>
            <Link
              to="/clinica/avaliacoes"
              className="flex items-center gap-1 text-xs text-emerald-700 font-semibold hover:underline"
            >
              <ChevronRight size={11} /> Ir para Avaliações
            </Link>
          </div>
        </div>
      </div>

      {/* Central panels */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Agenda do dia (50%) */}
        <div
          className="lg:col-span-2 bg-white rounded-xl p-5 flex flex-col gap-4"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Agenda de hoje</h2>
            <Link
              to="/clinica/agenda"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Ver agenda completa <ChevronRight size={12} />
            </Link>
          </div>

          {todaySessions.length === 0 ? (
            <EmptyState
              message="Nenhuma sessão agendada para hoje."
              cta="Ir para a agenda"
              ctaTo="/clinica/agenda"
            />
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {todaySessions.map((session) => (
                <div key={session.id} className="flex items-center gap-4 py-3">
                  <span className="text-xs font-mono text-gray-400 w-12 shrink-0">{session.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{session.patientName}</p>
                    {(session.therapistName || session.room) && (
                      <p className="text-xs text-gray-500 truncate">
                        {[session.therapistName, session.room].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={session.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fila prioritária (25%) */}
        <div
          className="bg-white rounded-xl p-5 flex flex-col gap-4"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Maior prioridade</h2>
            <Link
              to="/clinica/fila"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Ver fila <ChevronRight size={12} />
            </Link>
          </div>

          {priorityQueue.length === 0 ? (
            <EmptyState
              message="Fila de espera vazia."
              cta="Configurar fila"
              ctaTo="/clinica/fila"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {priorityQueue.slice(0, 5).map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.name}</p>
                    <p className="text-xs text-gray-500">{entry.ageText}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <TierBadge tier={entry.tier} />
                    <span className="text-xs text-gray-400">{entry.daysInQueue}d</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reposições (25%) */}
        <div
          className="bg-white rounded-xl p-5 flex flex-col gap-4"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Reposições em aberto</h2>
            <Link
              to="/clinica/agenda"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Ver todas <ChevronRight size={12} />
            </Link>
          </div>

          <EmptyState
            message="Nenhuma reposição pendente."
          />
        </div>
      </div>

      {/* Ações pendentes */}
      {pendingActions.length > 0 && (
        <div
          className="bg-white rounded-xl p-5 flex flex-col gap-4"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <h2 className="text-sm font-semibold text-gray-900">Requer atenção</h2>
          <div className="flex flex-wrap gap-3">
            {pendingActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center gap-3 rounded-lg px-4 py-3 flex-1 min-w-[280px]"
                style={{
                  background: action.urgent ? "#FEF2F2" : "#FAFAFA",
                  border: `0.5px solid ${action.urgent ? "#FCA5A5" : "#E5E7EB"}`,
                }}
              >
                {action.type === "evaluation" ? (
                  <Users2 size={16} color="#4F46E5" />
                ) : (
                  <AlertCircle
                    size={16}
                    color={action.urgent ? "#EF4444" : "#9CA3AF"}
                  />
                )}
                <p className="text-sm text-gray-700 flex-1">{action.message}</p>
                <a
                  href={action.ctaTo}
                  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 shrink-0"
                >
                  {action.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for first-time users */}
      {pendingActions.length === 0 && todaySessions.length === 0 && (
        <div
          className="bg-white rounded-xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: "#EEF2FF" }}
          >
            <Clock size={24} color="#4F46E5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Clínica configurada com sucesso!
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md">
              Agora configure sua equipe e comece a receber pacientes na fila de espera.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link
              to="/clinica/equipe"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
            >
              <Users size={15} />
              Convidar equipe
            </Link>
            <Link
              to="/clinica/fila"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold transition-colors"
            >
              Ver fila de espera
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
