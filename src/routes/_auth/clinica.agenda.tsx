import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Plus, CheckCircle, AlertCircle, XCircle, UserMinus, Users2, Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { ModalCloseButton } from "@/components/ui/ModalCloseButton";
import { authHeaders } from "@/lib/auth-headers";
import { useClinicPlan } from "@/services/subscription.service";
import { useUpgrade } from "@/components/premium/PremiumGate";
import {
  listClinicSessionsServer,
  updateSessionStatusServer,
  registerTherapistAbsenceServer,
} from "@/lib/clinic-agenda.functions";
import { listGroupsServer } from "@/lib/clinic-groups.functions";
import { getMyClinicServer } from "@/lib/clinic.functions";
import type { ClinicSession, SessionStatus, AbsenceType } from "@/types/clinic-agenda";
import {
  SESSION_TYPE_LABELS,
  SESSION_STATUS_LABELS,
  DAY_NAMES,
  DAY_NAMES_FULL,
  ABSENCE_TYPE_LABELS,
} from "@/types/clinic-agenda";
import type { ClinicGroup } from "@/types/clinic-groups";
import { GROUP_STATUS_COLORS, DAY_NAMES_SHORT } from "@/types/clinic-groups";

export const Route = createFileRoute("/_auth/clinica/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Clínica TEAmo" }] }),
  component: ClinicAgendaPage,
});

type ViewMode = "profissional" | "sala" | "grupo";

const SESSION_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  terapeutica:     { bg: "#EEF2FF", border: "#4F46E5", text: "#3730A3" },
  avaliacao:       { bg: "#EDE9FE", border: "#7C3AED", text: "#5B21B6" },
  devolutiva:      { bg: "#FEF3C7", border: "#D97706", text: "#92400E" },
  reposicao:       { bg: "#EEF2FF", border: "#4F46E5", text: "#3730A3" },
  orientacao_pais: { bg: "#DCFCE7", border: "#16A34A", text: "#14532D" },
};

const STATUS_ICONS: Record<SessionStatus, React.ReactNode> = {
  agendada:              <CheckCircle size={12} className="text-indigo-500" />,
  realizada:             <CheckCircle size={12} className="text-green-500" />,
  falta_justificada:     <AlertCircle size={12} className="text-yellow-500" />,
  falta_nao_justificada: <AlertCircle size={12} className="text-red-400" />,
  cancelada_clinica:     <XCircle size={12} className="text-gray-400" />,
};

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function ClinicAgendaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openUpgrade } = useUpgrade();
  const isMobile = useIsMobile();

  const [viewMode, setViewMode] = useState<ViewMode>("profissional");
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [selectedSession, setSelectedSession] = useState<ClinicSession | null>(null);
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);

  const getClinic  = useServerFn(getMyClinicServer);
  const listSessions = useServerFn(listClinicSessionsServer);
  const updateStatus = useServerFn(updateSessionStatusServer);
  const registerAbsence = useServerFn(registerTherapistAbsenceServer);
  const listGroups = useServerFn(listGroupsServer);

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const clinicId = clinicQuery.data?.clinic?.id ?? "";
  const { isClinicPremium } = useClinicPlan(clinicId || undefined);

  const sessionsQuery = useQuery({
    queryKey: ["clinicSessions", clinicId, toISO(weekStart)],
    queryFn: async () =>
      listSessions({
        data: { clinicId, weekStart: toISO(weekStart) },
        headers: await authHeaders(),
      }),
    enabled: !!clinicId,
    staleTime: 30_000,
  });

  const groupsQuery = useQuery({
    queryKey: ["clinicGroupsAgenda", clinicId],
    queryFn: async () => listGroups({ data: { clinicId, status: "ativo" }, headers: await authHeaders() }),
    enabled: !!clinicId && viewMode === "grupo",
    staleTime: 30_000,
  });

  const sessions: ClinicSession[] = sessionsQuery.data?.ok ? sessionsQuery.data.sessions : [];
  const groups: ClinicGroup[] = groupsQuery.data?.ok ? groupsQuery.data.groups : [];

  const weekDays = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ClinicSession[]>();
    for (const d of weekDays) {
      map.set(toISO(d), []);
    }
    for (const s of sessions) {
      const arr = map.get(s.session_date);
      if (arr) arr.push(s);
    }
    return map;
  }, [sessions, weekDays]);

  const statusMutation = useMutation({
    mutationFn: async ({ sessionId, status, notes }: { sessionId: string; status: SessionStatus; notes?: string }) =>
      updateStatus({ data: { sessionId, status, notes }, headers: await authHeaders() }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error || "Erro ao atualizar status."); return; }
      toast.success("Status atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["clinicSessions"] });
      setSelectedSession(null);
    },
  });

  const weekLabel = (() => {
    const end = addDays(weekStart, 5);
    return `Semana de ${formatDate(toISO(weekStart))} a ${formatDate(toISO(end))}`;
  })();

  const today = toISO(new Date());

  return (
    <div className="px-6 py-6 max-w-[1400px] mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 mt-0.5">Grade semanal de sessões</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => isClinicPremium ? setAbsenceModalOpen(true) : openUpgrade("clinica-sessoes")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            style={{ border: "0.5px solid #E5E7EB" }}
          >
            <UserMinus size={15} />
            Registrar ausência
          </button>
          <Link
            to="/clinica/agenda/reposicoes"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            style={{ border: "0.5px solid #E5E7EB" }}
          >
            Reposições
          </Link>
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Plus size={15} />
            Novo agendamento
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-4" style={{ border: "0.5px solid #E5E7EB" }}>
        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">{weekLabel}</span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(["profissional", "sala", "grupo"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={[
                "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                viewMode === mode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {mode === "profissional" ? "Por profissional" : mode === "sala" ? "Por sala" : "Por grupo"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid — Por grupo */}
      {viewMode === "grupo" && (
        <div className="flex flex-col gap-4">
          {groupsQuery.isLoading ? (
            <div className="text-center py-12 text-sm text-gray-400">Carregando grupos...</div>
          ) : groups.length === 0 ? (
            <div
              className="bg-white rounded-xl p-10 flex flex-col items-center gap-3 text-center"
              style={{ border: "0.5px solid #E5E7EB" }}
            >
              <Users2 size={24} className="text-gray-300" />
              <p className="text-sm text-gray-500">Nenhum grupo ativo encontrado.</p>
              <Link to="/clinica/grupos" className="text-indigo-600 text-sm font-medium hover:underline">
                Gerenciar grupos →
              </Link>
            </div>
          ) : (
            groups.map((group) => {
              const statusColor = GROUP_STATUS_COLORS[group.status];
              const scheduleText = `${DAY_NAMES_SHORT[group.day_of_week]} · ${group.start_time.slice(0, 5)}h`;
              const activeCount = group.member_count ?? 0;
              const memberColors = ["bg-indigo-100 text-indigo-700","bg-pink-100 text-pink-700","bg-green-100 text-green-700","bg-amber-100 text-amber-700"];
              return (
                <div key={group.id} className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #E5E7EB" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}` }}
                      >
                        {activeCount}/{group.capacity_max}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={11} /> {scheduleText}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} /> {group.room_name}</span>
                      <Link
                        to="/clinica/grupos/$groupId"
                        params={{ groupId: group.id }}
                        className="text-indigo-600 hover:underline"
                      >
                        Ver grupo →
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{group.therapist_name}</span>
                    <div className="flex -space-x-1.5 ml-2">
                      {Array.from({ length: activeCount }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${memberColors[i % memberColors.length]} ring-2 ring-white`}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                      ))}
                    </div>
                    {activeCount === 0 && (
                      <span className="text-xs text-gray-400 italic">Sem membros ativos</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Grid — Por profissional / sala */}
      {viewMode !== "grupo" && (
        isMobile ? (
          <AgendaMobileList
            weekDays={weekDays}
            sessionsByDay={sessionsByDay}
            isLoading={sessionsQuery.isLoading}
            today={today}
            onSelect={setSelectedSession}
          />
        ) : (
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #E5E7EB" }}>
        {/* Day headers */}
        <div className="grid grid-cols-6 border-b border-gray-100">
          {weekDays.map((d, i) => {
            const iso = toISO(d);
            const isToday = iso === today;
            return (
              <div key={iso} className={["px-3 py-2 text-center", i > 0 ? "border-l border-gray-100" : ""].join(" ")}>
                <div className={["text-xs font-medium", isToday ? "text-indigo-600" : "text-gray-500"].join(" ")}>
                  {DAY_NAMES[d.getDay()]}
                </div>
                <div
                  className={[
                    "text-lg font-bold mt-0.5 w-8 h-8 rounded-full flex items-center justify-center mx-auto",
                    isToday ? "bg-indigo-600 text-white" : "text-gray-900",
                  ].join(" ")}
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sessions area */}
        <div className="grid grid-cols-6 min-h-[400px]">
          {weekDays.map((d, i) => {
            const iso = toISO(d);
            const daySessions = sessionsByDay.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={["p-2 flex flex-col gap-1.5 min-h-[320px]", i > 0 ? "border-l border-gray-100" : ""].join(" ")}
              >
                {sessionsQuery.isLoading ? (
                  <div className="text-xs text-gray-300 text-center mt-4">Carregando…</div>
                ) : daySessions.length === 0 ? (
                  <div className="text-xs text-gray-300 text-center mt-6">Sem sessões</div>
                ) : (
                  daySessions.map((s) => {
                    const colors = SESSION_TYPE_COLORS[s.session_type] ?? SESSION_TYPE_COLORS.terapeutica;
                    const isReplacement = s.session_type === "reposicao";
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSession(s)}
                        className="w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all hover:shadow-sm"
                        style={{
                          background: colors.bg,
                          border: isReplacement
                            ? `1.5px dashed ${colors.border}`
                            : `0.5px solid ${colors.border}`,
                        }}
                      >
                        <div className="flex items-center gap-1">
                          {STATUS_ICONS[s.status]}
                          <span className="font-semibold truncate" style={{ color: colors.text }}>
                            {s.patient_name}
                          </span>
                          {isReplacement && (
                            <span
                              className="ml-auto text-[10px] font-bold px-1 rounded"
                              style={{ background: colors.border, color: "white" }}
                            >
                              R
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500 mt-0.5 truncate">
                          {s.start_time.slice(0, 5)} · {s.duration_minutes}min
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>
        )
      )}

      {/* Session detail panel */}
      {selectedSession && (
        <SessionPanel
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onStatusChange={(status) =>
            statusMutation.mutate({ sessionId: selectedSession.id, status })
          }
          isUpdating={statusMutation.isPending}
        />
      )}

      {/* Absence modal */}
      {absenceModalOpen && (
        <AbsenceModal
          clinicId={clinicId}
          onClose={() => setAbsenceModalOpen(false)}
          registerAbsence={registerAbsence}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["clinicSessions"] });
            toast.success("Ausência registrada. Sessões canceladas e reposições criadas.");
            setAbsenceModalOpen(false);
            void navigate({ to: "/clinica/agenda/reposicoes" });
          }}
        />
      )}
    </div>
  );
}

// ─── AgendaMobileList ─────────────────────────────────────────────────────────

function AgendaMobileList({
  weekDays,
  sessionsByDay,
  isLoading,
  today,
  onSelect,
}: {
  weekDays: Date[];
  sessionsByDay: Map<string, ClinicSession[]>;
  isLoading: boolean;
  today: string;
  onSelect: (s: ClinicSession) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {weekDays.map((d) => {
        const iso = toISO(d);
        const daySessions = sessionsByDay.get(iso) ?? [];
        const isToday = iso === today;
        return (
          <div key={iso} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <span className={["text-sm font-bold", isToday ? "text-indigo-600" : "text-gray-900"].join(" ")}>
                {DAY_NAMES_FULL[d.getDay()]} · {d.getDate()}
              </span>
              {isToday && (
                <span className="text-[10px] font-bold text-white bg-indigo-600 px-1.5 py-0.5 rounded-full">
                  HOJE
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="text-xs text-gray-300 px-1">Carregando…</div>
            ) : daySessions.length === 0 ? (
              <div className="text-xs text-gray-300 px-1">Sem sessões</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {daySessions.map((s) => {
                  const colors = SESSION_TYPE_COLORS[s.session_type] ?? SESSION_TYPE_COLORS.terapeutica;
                  const isReplacement = s.session_type === "reposicao";
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s)}
                      className="w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-2"
                      style={{
                        background: colors.bg,
                        border: isReplacement
                          ? `1.5px dashed ${colors.border}`
                          : `0.5px solid ${colors.border}`,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {STATUS_ICONS[s.status]}
                        <span className="font-semibold text-sm truncate" style={{ color: colors.text }}>
                          {s.patient_name}
                        </span>
                        {isReplacement && (
                          <span
                            className="text-[10px] font-bold px-1 rounded shrink-0"
                            style={{ background: colors.border, color: "white" }}
                          >
                            R
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 shrink-0">
                        {s.start_time.slice(0, 5)} · {s.duration_minutes}min
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── SessionPanel ─────────────────────────────────────────────────────────────

function SessionPanel({
  session,
  onClose,
  onStatusChange,
  isUpdating,
}: {
  session: ClinicSession;
  onClose: () => void;
  onStatusChange: (s: SessionStatus) => void;
  isUpdating: boolean;
}) {
  return (
    <div
      className="fixed inset-x-4 top-20 sm:inset-x-auto sm:right-6 w-auto sm:w-80 bg-white rounded-xl shadow-xl z-40 flex flex-col"
      style={{ border: "0.5px solid #E5E7EB" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div>
          <p className="text-sm font-bold text-gray-900">{session.patient_name}</p>
          <p className="text-xs text-gray-500">
            {SESSION_TYPE_LABELS[session.session_type]} · {DAY_NAMES_FULL[new Date(session.session_date + "T00:00:00").getDay()]}
          </p>
        </div>
        <ModalCloseButton onClick={onClose} />
      </div>

      <div className="px-4 py-3 flex flex-col gap-2 text-sm">
        <Row label="Sala"      value={session.room_id} />
        <Row label="Duração"   value={`${session.duration_minutes} minutos`} />
        <Row label="Status"    value={SESSION_STATUS_LABELS[session.status]} />
        {session.notes && <Row label="Notas" value={session.notes} />}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex flex-col gap-2">
        <button
          type="button"
          disabled={isUpdating || session.status === "realizada"}
          onClick={() => onStatusChange("realizada")}
          className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg transition-colors"
        >
          Confirmar presença
        </button>
        <button
          type="button"
          disabled={isUpdating || session.status === "falta_justificada"}
          onClick={() => onStatusChange("falta_justificada")}
          className="w-full px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          Falta justificada
        </button>
        <button
          type="button"
          disabled={isUpdating || session.status === "cancelada_clinica"}
          onClick={() => onStatusChange("cancelada_clinica")}
          className="w-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          style={{ border: "0.5px solid #FECACA" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-400 shrink-0 w-20">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

// ─── AbsenceModal ─────────────────────────────────────────────────────────────

function AbsenceModal({
  clinicId,
  onClose,
  registerAbsence,
  onSuccess,
}: {
  clinicId: string;
  onClose: () => void;
  registerAbsence: ReturnType<typeof useServerFn<typeof registerTherapistAbsenceServer>>;
  onSuccess: () => void;
}) {
  const [therapistId, setTherapistId] = useState("");
  const [therapistName, setTherapistName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [absenceType, setAbsenceType] = useState<AbsenceType>("doenca");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!therapistId.trim()) { toast.error("Informe o ID do terapeuta."); return; }
    setLoading(true);
    try {
      const res = await registerAbsence({
        data: {
          clinicId,
          therapistUserId: therapistId.trim(),
          absenceType,
          startsOn: date,
          endsOn:   date,
          notes:    notes || null,
        },
        headers: await authHeaders(),
      });
      if (!res.ok) {
        if (res.error?.includes("PREMIUM_REQUIRED")) {
          toast.error("Registrar ausências requer o plano Premium da clínica.");
        } else {
          toast.error(res.error || "Erro ao registrar ausência.");
        }
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl w-full max-w-lg shadow-2xl"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            Registrar ausência{therapistName ? ` — ${therapistName}` : ""}
          </h2>
          <ModalCloseButton onClick={onClose} />
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="therapistId">
              ID do terapeuta
            </label>
            <input
              id="therapistId"
              type="text"
              value={therapistId}
              onChange={(e) => setTherapistId(e.target.value)}
              placeholder="UUID do membro da clínica"
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="absenceDate">
              Data(s) afetada(s)
            </label>
            <input
              id="absenceDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-gray-700">Tipo de ausência</span>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ABSENCE_TYPE_LABELS) as AbsenceType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAbsenceType(t)}
                  className={[
                    "px-2 py-2 text-xs font-medium rounded-lg border transition-colors text-center",
                    absenceType === t
                      ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {ABSENCE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="absenceNotes">
              Observação interna (não compartilhada com famílias)
            </label>
            <textarea
              id="absenceNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Contexto interno da ausência…"
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
          </div>

          <div
            className="rounded-lg px-4 py-3 text-sm text-amber-700"
            style={{ background: "#FEF9C3", border: "0.5px solid #FDE68A" }}
          >
            Todas as sessões agendadas do terapeuta na(s) data(s) selecionada(s) serão
            canceladas e reposições serão criadas automaticamente.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {loading ? "Processando…" : "Confirmar e notificar famílias"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
