import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Clock, Calendar, ChevronLeft, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/auth-headers";
import {
  listClinicReplacementsServer,
  proposeReplacementSlotServer,
  listClinicRoomsServer,
} from "@/lib/clinic-agenda.functions";
import { getMyClinicServer } from "@/lib/clinic.functions";
import type { ClinicReplacement, ReplacementStatus } from "@/types/clinic-agenda";
import {
  REPLACEMENT_STATUS_LABELS,
  REPLACEMENT_EVENT_TYPE_LABELS,
} from "@/types/clinic-agenda";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/clinica/agenda/reposicoes")({
  head: () => ({ meta: [{ title: "Reposições — Agenda Clínica TEAmo" }] }),
  component: ClinicReposicoesPage,
});

const STATUS_COLORS: Record<ReplacementStatus, { bg: string; border: string; text: string }> = {
  pendente:  { bg: "#FEF9C3", border: "#EAB308", text: "#92400E" },
  agendada:  { bg: "#EEF2FF", border: "#4F46E5", text: "#3730A3" },
  realizada: { bg: "#DCFCE7", border: "#16A34A", text: "#14532D" },
  expirada:  { bg: "#F3F4F6", border: "#9CA3AF", text: "#6B7280" },
};

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  if (days < 0) {
    return (
      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
        <AlertCircle size={12} /> Expirada
      </span>
    );
  }
  if (days <= 10) {
    return (
      <span className="text-xs font-bold text-red-500 flex items-center gap-1">
        <Clock size={12} /> {days} dias
      </span>
    );
  }
  if (days <= 20) {
    return (
      <span className="text-xs font-medium text-yellow-600 flex items-center gap-1">
        <Clock size={12} /> {days} dias
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-500 flex items-center gap-1">
      <Calendar size={12} /> {days} dias
    </span>
  );
}

export default function ClinicReposicoesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ReplacementStatus | "todos">("todos");
  const [proposeTarget, setProposeTarget] = useState<ClinicReplacement | null>(null);

  const getClinic = useServerFn(getMyClinicServer);
  const listReplacements = useServerFn(listClinicReplacementsServer);

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
    enabled: !!user,
    staleTime: 30_000,
  });

  const clinicId = clinicQuery.data?.clinic?.id ?? "";

  const replacementsQuery = useQuery({
    queryKey: ["clinicReplacements", clinicId, statusFilter],
    queryFn: async () =>
      listReplacements({
        data: {
          clinicId,
          status: statusFilter !== "todos" ? statusFilter : null,
        },
        headers: await authHeaders(),
      }),
    enabled: !!clinicId,
    staleTime: 30_000,
  });

  const replacements: ClinicReplacement[] = replacementsQuery.data?.ok
    ? replacementsQuery.data.replacements
    : [];

  const pendingCount = replacements.filter((r) => r.status === "pendente").length;
  const expiringCount = replacements.filter(
    (r) => r.status === "pendente" && daysUntil(r.deadline_date) <= 10,
  ).length;

  const active = replacements.filter((r) => r.status !== "expirada");
  const expired = replacements.filter((r) => r.status === "expirada");

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/clinica/agenda"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ChevronLeft size={15} /> Agenda
        </Link>
        <span className="text-gray-300">/</span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Reposições em aberto{" "}
            {pendingCount > 0 && (
              <span className="text-base font-normal text-gray-500">· {pendingCount} pendente{pendingCount > 1 ? "s" : ""}</span>
            )}
          </h1>
          {expiringCount > 0 && (
            <p className="text-sm font-medium text-red-500 mt-0.5">
              {expiringCount} expirando em menos de 10 dias
            </p>
          )}
        </div>
      </div>

      {/* Filters + action */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(["todos", "pendente", "agendada", "expirada"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={[
                "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                statusFilter === s
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {s === "todos" ? "Todos os terapeutas" : REPLACEMENT_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #E5E7EB" }}>
        {replacementsQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">Carregando reposições…</div>
        ) : active.length === 0 && expired.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <Calendar size={24} color="#22C55E" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Nenhuma reposição em aberto</p>
            <p className="text-sm text-gray-400">Todas as reposições foram realizadas ou não há eventos geradores.</p>
          </div>
        ) : (
          <>
            {/* Active rows */}
            <div>
              <div
                className="grid grid-cols-[1fr_1fr_120px_130px_80px_100px_100px] px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100"
              >
                <span>Paciente</span>
                <span>Terapeuta</span>
                <span>Sessão original</span>
                <span>Tipo</span>
                <span>Prazo</span>
                <span>Status</span>
                <span>Ação</span>
              </div>
              {active.map((r) => {
                const colors = STATUS_COLORS[r.status];
                const days = daysUntil(r.deadline_date);
                const isUrgent = r.status === "pendente" && days <= 10;
                const isWarning = r.status === "pendente" && days > 10 && days <= 20;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_1fr_120px_130px_80px_100px_100px] px-4 py-3 border-b border-gray-50 items-center text-sm"
                    style={{
                      background: isUrgent ? "#FFF1F2" : isWarning ? "#FEFCE8" : undefined,
                    }}
                  >
                    <span className="font-medium text-gray-900 truncate">{r.patient_name}</span>
                    <span className="text-gray-500 truncate">{r.therapist_name || r.therapist_user_id.slice(0, 8)}</span>
                    <span className="text-gray-500 text-xs">{formatDate(r.created_at.slice(0, 10))}</span>
                    <span className="text-xs">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: "#FEE2E2", color: "#991B1B" }}
                      >
                        {REPLACEMENT_EVENT_TYPE_LABELS[r.event_type]}
                      </span>
                    </span>
                    <span>
                      <DeadlineBadge deadline={r.deadline_date} />
                    </span>
                    <span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: colors.bg, color: colors.text, border: `0.5px solid ${colors.border}` }}
                      >
                        {REPLACEMENT_STATUS_LABELS[r.status]}
                      </span>
                    </span>
                    <span>
                      {r.status === "pendente" && (
                        <button
                          type="button"
                          onClick={() => setProposeTarget(r)}
                          className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200 transition-colors"
                        >
                          Propor horário
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Expired section */}
            {expired.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                  Expiradas (últimos 30 dias)
                </div>
                {expired.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_1fr_120px_130px_80px_100px_100px] px-4 py-3 border-b border-gray-50 items-center text-sm text-gray-400"
                  >
                    <span className="truncate">{r.patient_name}</span>
                    <span className="truncate">{r.therapist_user_id.slice(0, 8)}…</span>
                    <span className="text-xs">{formatDate(r.created_at.slice(0, 10))}</span>
                    <span className="text-xs">{REPLACEMENT_EVENT_TYPE_LABELS[r.event_type]}</span>
                    <span>—</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs w-fit"
                      style={{ background: "#F3F4F6", color: "#6B7280" }}
                    >
                      Expirada
                    </span>
                    <span>—</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Propose slot modal */}
      {proposeTarget && (
        <ProposeSlotModal
          replacement={proposeTarget}
          clinicId={clinicId}
          onClose={() => setProposeTarget(null)}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["clinicReplacements"] });
            toast.success("Reposição agendada com sucesso.");
            setProposeTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ─── ProposeSlotModal ─────────────────────────────────────────────────────────

function ProposeSlotModal({
  replacement,
  clinicId,
  onClose,
  onSuccess,
}: {
  replacement: ClinicReplacement;
  clinicId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const listRooms = useServerFn(listClinicRoomsServer);
  const proposeSlot = useServerFn(proposeReplacementSlotServer);

  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);

  const roomsQuery = useQuery({
    queryKey: ["clinicRooms", clinicId],
    queryFn: async () => listRooms({ data: { clinicId }, headers: await authHeaders() }),
    staleTime: 60_000,
  });
  const rooms = roomsQuery.data?.ok ? roomsQuery.data.rooms : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedDate || !proposedTime || !roomId) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    try {
      const res = await proposeSlot({
        data: {
          replacementId: replacement.id,
          proposedDate,
          proposedTime,
          roomId,
        },
        headers: await authHeaders(),
      });
      if (!res.ok) { toast.error(res.error || "Erro ao propor horário."); return; }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-2xl"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Propor horário de reposição</h2>
            <p className="text-xs text-gray-500 mt-0.5">{replacement.patient_name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="propDate">
              Data da reposição
            </label>
            <input
              id="propDate"
              type="date"
              value={proposedDate}
              onChange={(e) => setProposedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="propTime">
              Horário
            </label>
            <input
              id="propTime"
              type="time"
              value={proposedTime}
              onChange={(e) => setProposedTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="propRoom">
              Sala
            </label>
            <select
              id="propRoom"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              required
            >
              <option value="">Selecionar sala…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div
            className="rounded-lg px-4 py-3 text-sm text-indigo-700"
            style={{ background: "#EEF2FF", border: "0.5px solid #C7D2FE" }}
          >
            Prazo para reposição: <strong>{replacement.deadline_date}</strong>
            {" "}({daysUntil(replacement.deadline_date)} dias restantes)
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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
            >
              {loading ? "Agendando…" : "Confirmar horário"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
