import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Stethoscope, Loader2, CalendarDays, ChevronDown, ChevronUp,
  Target, Trophy, Clock, CheckCircle2, MinusCircle, XCircle, MessageSquare,
  List,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  useParentPortalSummary,
  useParentSessionRecords,
  useParentMilestones,
  useMyParentCommunications,
} from "@/services/therapist.service";
import { MILESTONE_AREA_COLORS } from "@/lib/validation";
import { WeekGrid } from "@/components/agenda/WeekGrid";
import type { AgendaEventWithRelations } from "@/types/agenda";

export const Route = createFileRoute("/_auth/meu-terapeuta_/$accessId")({
  head: () => ({ meta: [{ title: "Acompanhamento — TEAmo" }] }),
  component: PortalPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";
const AMBER = "#D97706";
const AMBER_SOFT = "#FFFBEB";
const AMBER_BORDER = "#FDE68A";

const AREA_LABELS: Record<string, string> = {
  comunicacao: "Comunicação",
  socializacao: "Socialização",
  autonomia: "Autonomia",
  comportamento: "Comportamento",
  cognicao: "Cognição",
  motricidade: "Motricidade",
};

const GOAL_STATUS_ICON = {
  achieved:     CheckCircle2,
  partial:      MinusCircle,
  not_achieved: XCircle,
} as const;

const GOAL_STATUS_LABEL = {
  achieved:     "Atingido",
  partial:      "Parcial",
  not_achieved: "Não atingido",
} as const;

const GOAL_STATUS_COLOR = {
  achieved:     "#16A34A",
  partial:      "#D97706",
  not_achieved: "#DC2626",
} as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

function formatDuration(startAt?: string, endAt?: string | null) {
  if (!startAt || !endAt) return null;
  const min = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
  if (min <= 0) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// ─── Seção de sessões ─────────────────────────────────────────────────────────

function SessionCard({ session }: { session: any }) {
  const [expanded, setExpanded] = useState(false);
  const event = session;
  const record = session.record ?? {};
  const hasRecord = !!session.record;
  const date = event.start_at ? formatDate(event.start_at) : "";
  const duration = formatDuration(event.start_at, event.end_at);
  const plan = event.session_plan ?? {};
  const showPlan = event.plan_visible_to_parents && (plan.objectives || (plan.specific_objectives?.length ?? 0) > 0);
  const notableBehaviors: any[] = record.notable_behaviors ?? [];
  const conquistas = notableBehaviors.filter((b: any) => b.type === "conquista" || b.type === "regulacao");
  const goalsAchieved: any[] = record.goals_achieved ?? [];
  const hasContent = record.what_was_done || record.family_instruction || conquistas.length > 0 || showPlan || goalsAchieved.length > 0;

  // Status da sessão: agendada / realizada / aguardando registro / falta
  const isPast = new Date(event.start_at) < new Date();
  const attendance = event.session_attendance as string | null;
  let statusLabel = "Agendada", statusColor = "#6B7280", statusBg = "#F4F5FA";
  if (attendance === "missed_justified" || attendance === "missed_no_show") {
    statusLabel = "Falta"; statusColor = "#DC2626"; statusBg = "#FEF2F2";
  } else if (hasRecord) {
    statusLabel = "Registrada"; statusColor = "#16A34A"; statusBg = "#ECFDF5";
  } else if (attendance === "happened") {
    statusLabel = "Realizada"; statusColor = TEAL; statusBg = TEAL_SOFT;
  } else if (isPast) {
    statusLabel = "Aguardando registro"; statusColor = "#D97706"; statusBg = "#FEF3C7";
  }

  return (
    <div
      className="rounded-[16px] border bg-white overflow-hidden"
      style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}
    >
      {/* Header da sessão */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: TEAL_SOFT }}
        >
          <CalendarDays size={16} strokeWidth={1.8} color={TEAL} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#0F172A] leading-tight">
            {event.title ?? "Sessão"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[12px] text-[#6B7280]">{date}</p>
            {duration && (
              <>
                <span className="text-[#D1D5DB]">·</span>
                <div className="flex items-center gap-1">
                  <Clock size={10} strokeWidth={2} color="#9CA3AF" />
                  <span className="text-[11px] text-[#9CA3AF]">{duration}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <span
          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
          style={{ background: statusBg, color: statusColor }}
        >
          {statusLabel}
        </span>
        {hasContent && (
          expanded
            ? <ChevronUp size={16} strokeWidth={2} color="#9CA3AF" className="flex-shrink-0" />
            : <ChevronDown size={16} strokeWidth={2} color="#9CA3AF" className="flex-shrink-0" />
        )}
      </button>

      {/* Instrução à família — sempre visível se existir */}
      {record.family_instruction && (
        <div
          className="mx-4 mb-3 rounded-xl px-3 py-2.5"
          style={{ background: AMBER_SOFT, border: `1px solid ${AMBER_BORDER}` }}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: AMBER }}>
            Instrução da família
          </p>
          <p className="text-[13px] text-[#92400E] leading-relaxed">
            {record.family_instruction}
          </p>
        </div>
      )}

      {/* Conteúdo expandível */}
      {expanded && hasContent && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-[#F3F4F6] pt-3">

          {/* Plano da sessão */}
          {showPlan && (
            <div>
              <p className="text-[11.5px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                Plano da sessão
              </p>
              {plan.objectives && (
                <p className="text-[13px] text-[#374151] mb-1.5 leading-relaxed">{plan.objectives}</p>
              )}
              {(plan.specific_objectives?.length ?? 0) > 0 && (
                <ul className="flex flex-col gap-1">
                  {(plan.specific_objectives as string[]).map((obj, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: TEAL }} />
                      <span className="text-[13px] text-[#374151]">{obj}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* O que foi trabalhado */}
          {record.what_was_done && (
            <div>
              <p className="text-[11.5px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                O que foi trabalhado
              </p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{record.what_was_done}</p>
            </div>
          )}

          {/* Objetivos com status */}
          {goalsAchieved.length > 0 && (
            <div>
              <p className="text-[11.5px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                Objetivos da sessão
              </p>
              <div className="flex flex-col gap-1.5">
                {goalsAchieved.map((g: any, i: number) => {
                  const status = g.status as keyof typeof GOAL_STATUS_ICON;
                  const Icon = GOAL_STATUS_ICON[status] ?? MinusCircle;
                  const color = GOAL_STATUS_COLOR[status] ?? "#6B7280";
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <Icon size={14} strokeWidth={2} color={color} className="mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-[13px] text-[#374151]">{g.goal}</span>
                        {g.notes && (
                          <p className="text-[11.5px] text-[#6B7280] mt-0.5">{g.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conquistas */}
          {conquistas.length > 0 && (
            <div>
              <p className="text-[11.5px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                Conquistas 🎉
              </p>
              <div className="flex flex-col gap-1.5">
                {conquistas.map((b: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: "#16A34A" }} />
                    <p className="text-[13px] text-[#374151]">{b.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Seção de marcos ──────────────────────────────────────────────────────────

function MilestoneCard({ milestone }: { milestone: any }) {
  const [expanded, setExpanded] = useState(false);
  const color = MILESTONE_AREA_COLORS[milestone.area as keyof typeof MILESTONE_AREA_COLORS] ?? TEAL;
  const goals: any[] = milestone.goals ?? [];
  const totalGoals = goals.length;
  const achievedGoals = goals.filter((g: any) => g.status === "atingido").length;
  const isAchieved = milestone.status === "atingido";

  return (
    <div
      className="rounded-[16px] border overflow-hidden"
      style={{ borderColor: isAchieved ? color + "55" : "#E5E7EB", background: isAchieved ? color + "08" : "white" }}
    >
      <button
        type="button"
        onClick={() => goals.length > 0 && setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: color + "18" }}
        >
          {isAchieved
            ? <Trophy size={16} strokeWidth={1.8} color={color} />
            : <Target size={16} strokeWidth={1.8} color={color} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[14px] font-bold text-[#0F172A] leading-tight">{milestone.title}</p>
            {isAchieved && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: color, color: "white" }}
              >
                Atingido ✓
              </span>
            )}
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color }}>
            {AREA_LABELS[milestone.area] ?? milestone.area}
            {totalGoals > 0 ? ` · ${achievedGoals}/${totalGoals} metas` : ""}
          </p>
        </div>
        {goals.length > 0 && (
          expanded
            ? <ChevronUp size={16} strokeWidth={2} color="#9CA3AF" />
            : <ChevronDown size={16} strokeWidth={2} color="#9CA3AF" />
        )}
      </button>

      {/* Barra de progresso */}
      {totalGoals > 0 && (
        <div className="px-4 pb-3 -mt-1">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: color + "20" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(achievedGoals / totalGoals) * 100}%`, background: color }}
            />
          </div>
        </div>
      )}

      {/* Metas */}
      {expanded && goals.length > 0 && (
        <div className="px-4 pb-4 flex flex-col gap-1.5 border-t border-[#F3F4F6] pt-3">
          {goals.map((g: any) => (
            <div key={g.id} className="flex items-center gap-2.5">
              <div
                className="h-2 w-2 flex-shrink-0 rounded-full"
                style={{ background: g.status === "atingido" ? color : "#D1D5DB" }}
              />
              <span className="text-[13px] text-[#374151] flex-1">{g.title}</span>
              {g.status === "atingido" && (
                <span className="text-[10px] font-semibold" style={{ color }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

// Converte sessão do portal para o shape mínimo que o WeekGrid aceita
function toAgendaEvent(s: any): AgendaEventWithRelations {
  return {
    id: s.event_id,
    user_id: "",
    child_id: "",
    type: "terapia" as const,
    title: s.title ?? "Sessão",
    professional_id: null,
    professional_name_raw: null,
    start_at: s.start_at,
    end_at: s.end_at ?? null,
    locale: null,
    recurrence: { freq: "none" } as any,
    reminders: { oneDayBefore: false, oneHourBefore: false } as any,
    status: (s.session_attendance === "happened" ? "happened" : "upcoming") as any,
    type_data: {},
    linked_event_id: null,
    created_at: s.start_at,
    updated_at: s.start_at,
    child: null,
    professional: null,
  } as AgendaEventWithRelations;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function PortalPage() {
  const navigate = useNavigate();
  const { accessId } = (Route as any).useParams();

  const summaryQ    = useParentPortalSummary(accessId);
  const sessionsQ   = useParentSessionRecords(accessId);
  const milestonesQ = useParentMilestones(accessId);
  const commsQ      = useMyParentCommunications(accessId);

  const summary      = summaryQ.data;
  const sessions     = sessionsQ.data?.sessions ?? [];
  const milestones   = milestonesQ.data?.milestones ?? [];
  const comms        = (commsQ.data?.communications ?? []) as Array<{ id: string; content: string; created_at: string }>;
  const isLoading    = summaryQ.isLoading || sessionsQ.isLoading || milestonesQ.isLoading;

  // ── Agrupamento de sessões ──────────────────────────────────────────────────
  const now = new Date();

  const sessionsWithContent = useMemo(
    () => (sessions as any[]).filter((s) =>
      s.record !== null ||
      s.session_attendance === "happened" ||
      s.session_attendance === "missed_justified" ||
      s.session_attendance === "missed_no_show"
    ),
    [sessions],
  );

  const upcomingSessions = useMemo(
    () => (sessions as any[])
      .filter((s) => !s.record && !s.session_attendance && new Date(s.start_at) > now)
      .sort((a, b) => a.start_at.localeCompare(b.start_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions],
  );

  const nextSession = upcomingSessions[0] ?? null;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [sessionView, setSessionView] = useState<"lista" | "semana">("lista");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const HISTORY_LIMIT = 4;

  // Inicializa na semana da próxima sessão (ou hoje)
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(nextSession ? new Date(nextSession.start_at) : new Date())
  );

  const allAgendaEvents = useMemo(
    () => (sessions as any[]).map(toAgendaEvent),
    [sessions],
  );

  const milestonesByArea = milestones.reduce((acc: Record<string, any[]>, m: any) => {
    if (!acc[m.area]) acc[m.area] = [];
    acc[m.area].push(m);
    return acc;
  }, {});

  return (
    <AppShell
      onBack={() => navigate({ to: "/meu-terapeuta" as any })}
    >
      <div className="mx-auto max-w-[520px] px-4 py-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" color={TEAL} />
          </div>
        ) : (
          <>
            {/* Header card */}
            <div
              className="rounded-[16px] border px-4 py-4 mb-6"
              style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[20px] font-extrabold"
                  style={{ background: TEAL_BORDER, color: TEAL }}
                >
                  {summary?.child?.name.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div>
                  <h1 className="text-[18px] font-extrabold text-[#0F172A] leading-tight">
                    {summary?.child?.name ?? "Paciente"}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Stethoscope size={12} strokeWidth={2} color={TEAL} />
                    <p className="text-[13px] text-[#0F766E]">
                      <span className="font-semibold">{summary?.therapistName}</span>
                      {summary?.therapistSpecialty ? ` · ${summary.therapistSpecialty}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Sessões ═══ */}
            <div className="mb-8">
              {/* Cabeçalho + toggle */}
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays size={18} strokeWidth={1.8} color={TEAL} />
                <h2 className="text-[16px] font-extrabold text-[#0F172A] flex-1">
                  Sessões
                </h2>
                {sessionsWithContent.length > 0 && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: TEAL_SOFT, color: TEAL, border: `1px solid ${TEAL_BORDER}` }}
                  >
                    {sessionsWithContent.length}
                  </span>
                )}
                {/* Toggle Lista / Semana */}
                {sessions.length > 0 && (
                  <div
                    className="flex rounded-[10px] p-0.5 ml-1"
                    style={{ background: "#F1F5F9" }}
                  >
                    {(["lista", "semana"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setSessionView(mode)}
                        className="flex items-center gap-1 h-7 px-2.5 rounded-[8px] text-[11.5px] font-semibold transition-all"
                        style={
                          sessionView === mode
                            ? { background: "#fff", color: TEAL, boxShadow: "0 1px 3px rgba(13,148,136,0.15)" }
                            : { color: "#6B7280" }
                        }
                      >
                        {mode === "lista"
                          ? <><List size={11} strokeWidth={2.2} />Lista</>
                          : <><CalendarDays size={11} strokeWidth={2.2} />Semana</>
                        }
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {sessions.length === 0 ? (
                <div
                  className="rounded-[14px] border px-4 py-8 text-center"
                  style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
                >
                  <p className="text-[13px] text-[#9CA3AF]">Nenhuma sessão agendada ainda.</p>
                </div>
              ) : sessionView === "semana" ? (
                /* ── Visão Semana ── */
                <div>
                  <WeekGrid
                    weekStart={weekStart}
                    onPrev={() => {
                      const d = new Date(weekStart);
                      d.setDate(d.getDate() - 7);
                      setWeekStart(d);
                    }}
                    onNext={() => {
                      const d = new Date(weekStart);
                      d.setDate(d.getDate() + 7);
                      setWeekStart(d);
                    }}
                    events={allAgendaEvents}
                    onSelectEvent={() => {}}
                    getEventColor={() => ({ col: TEAL, label: "S" })}
                  />
                  <p className="mt-2 text-center text-[11px] text-[#9CA3AF]">
                    Toque em "Lista" para ver os detalhes das sessões realizadas.
                  </p>
                </div>
              ) : (
                /* ── Visão Lista ── */
                <div className="flex flex-col gap-4">

                  {/* Próxima sessão */}
                  {nextSession && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#9CA3AF" }}>
                        Próxima sessão
                      </p>
                      <div
                        className="flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3"
                        style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
                      >
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                          style={{ background: TEAL_BORDER }}
                        >
                          <CalendarDays size={16} strokeWidth={1.8} color={TEAL} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-[#0F172A] leading-tight">
                            {formatDate(nextSession.start_at)}
                          </p>
                          {formatDuration(nextSession.start_at, nextSession.end_at) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock size={10} strokeWidth={2} color="#9CA3AF" />
                              <span className="text-[11px] text-[#9CA3AF]">
                                {formatDuration(nextSession.start_at, nextSession.end_at)}
                              </span>
                            </div>
                          )}
                        </div>
                        <span
                          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                          style={{ background: "#F4F5FA", color: "#6B7280" }}
                        >
                          Agendada
                        </span>
                      </div>

                      {/* Demais próximas */}
                      {upcomingSessions.length > 1 && (
                        <div className="mt-1.5">
                          {showAllUpcoming && (
                            <div className="flex flex-col gap-1.5 mb-1.5">
                              {upcomingSessions.slice(1).map((s: any) => {
                                const d = new Date(s.start_at);
                                const dateShort = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
                                const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                                return (
                                  <div
                                    key={s.event_id}
                                    className="flex items-center gap-2 rounded-[10px] border px-3 py-2"
                                    style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
                                  >
                                    <span className="text-[12.5px] text-[#374151] flex-1">{dateShort} · {hm}</span>
                                    <span className="text-[10px] font-semibold" style={{ color: "#9CA3AF" }}>Agendada</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowAllUpcoming((v) => !v)}
                            className="flex items-center gap-1 text-[12px] font-semibold"
                            style={{ color: TEAL }}
                          >
                            {showAllUpcoming
                              ? <><ChevronUp size={13} strokeWidth={2.5} /> Ocultar próximas</>
                              : <><ChevronDown size={13} strokeWidth={2.5} /> Ver todas as próximas ({upcomingSessions.length - 1})</>
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Histórico com registros */}
                  <div>
                    {sessionsWithContent.length > 0 && (
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#9CA3AF" }}>
                        Histórico de sessões
                      </p>
                    )}
                    {sessionsWithContent.length === 0 ? (
                      !nextSession && (
                        <div
                          className="rounded-[14px] border px-4 py-6 text-center"
                          style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
                        >
                          <p className="text-[13px] text-[#9CA3AF]">Nenhum registro publicado ainda.</p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col gap-3">
                        {(showAllHistory
                          ? sessionsWithContent
                          : sessionsWithContent.slice(0, HISTORY_LIMIT)
                        ).map((s: any) => (
                          <SessionCard key={s.event_id} session={s} />
                        ))}
                        {sessionsWithContent.length > HISTORY_LIMIT && (
                          <button
                            type="button"
                            onClick={() => setShowAllHistory((v) => !v)}
                            className="flex items-center justify-center gap-1 text-[12px] font-semibold py-2"
                            style={{ color: TEAL }}
                          >
                            {showAllHistory ? (
                              <><ChevronUp size={13} strokeWidth={2.5} /> Mostrar menos</>
                            ) : (
                              <><ChevronDown size={13} strokeWidth={2.5} /> Ver sessões anteriores ({sessionsWithContent.length - HISTORY_LIMIT})</>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ Recados do terapeuta ═══ */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={18} strokeWidth={1.8} color="#D97706" />
                <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                  Recados do terapeuta
                </h2>
                {comms.length > 0 && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER_BORDER}` }}
                  >
                    {comms.length}
                  </span>
                )}
              </div>

              {commsQ.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin" color={AMBER} />
                </div>
              ) : comms.length === 0 ? (
                <div
                  className="rounded-[14px] border px-4 py-6 text-center"
                  style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
                >
                  <p className="text-[13px] text-[#9CA3AF]">
                    Nenhum recado enviado ainda.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {comms.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-[14px] border px-4 py-3.5"
                      style={{ borderColor: AMBER_BORDER, background: AMBER_SOFT }}
                    >
                      <p className="text-[13px] text-[#92400E] leading-relaxed whitespace-pre-line">
                        {c.content}
                      </p>
                      <p className="mt-2 text-[11px]" style={{ color: AMBER }}>
                        {new Date(c.created_at).toLocaleDateString("pt-BR", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ═══ Marcos ═══ */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Target size={18} strokeWidth={1.8} color="#7C3AED" />
                <h2 className="text-[16px] font-extrabold text-[#0F172A]">
                  Marcos e evolução
                </h2>
                {milestones.length > 0 && (
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#F3E8FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}
                  >
                    {milestones.length}
                  </span>
                )}
              </div>

              {milestones.length === 0 ? (
                <div
                  className="rounded-[14px] border px-4 py-8 text-center"
                  style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
                >
                  <p className="text-[13px] text-[#9CA3AF]">
                    Nenhum marco compartilhado ainda.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {Object.entries(milestonesByArea).map(([area, items]) => {
                    const color = MILESTONE_AREA_COLORS[area as keyof typeof MILESTONE_AREA_COLORS] ?? TEAL;
                    return (
                      <div key={area}>
                        <p
                          className="text-[11.5px] font-bold uppercase tracking-wide mb-2"
                          style={{ color }}
                        >
                          {AREA_LABELS[area] ?? area}
                        </p>
                        <div className="flex flex-col gap-2">
                          {(items as any[]).map((m: any) => (
                            <MilestoneCard key={m.id} milestone={m} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
