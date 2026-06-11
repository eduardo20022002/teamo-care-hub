import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, UserPlus, UserMinus, AlertTriangle, CheckCircle2,
  Users2, Clock, MapPin, ChevronRight, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { authHeaders } from "@/lib/auth-headers";
import {
  getGroupDetailServer,
  getSuggestedCandidatesServer,
  addGroupMemberServer,
  removeGroupMemberServer,
  updateGroupStatusServer,
} from "@/lib/clinic-groups.functions";
import type { ClinicGroupMember, GroupCandidate, CompatibilityAlert } from "@/types/clinic-groups";
import { GROUP_STATUS_LABELS, GROUP_STATUS_COLORS, DAY_NAMES_SHORT } from "@/types/clinic-groups";

export const Route = createFileRoute("/_auth/clinica/grupos/$groupId")({
  head: () => ({ meta: [{ title: "Detalhe do Grupo — Clínica TEAmo" }] }),
  component: GroupDetailPage,
});

function ageText(birthdate: string): string {
  if (!birthdate) return "—";
  const birth = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return `${age}a`;
}

function AlertBadge({ alert }: { alert: CompatibilityAlert }) {
  const isBlock = alert.severity === "block";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{
        background: isBlock ? "#FEE2E2" : "#FEF9C3",
        color: isBlock ? "#DC2626" : "#CA8A04",
      }}
    >
      <AlertTriangle size={9} />
      {alert.criterion}
    </span>
  );
}

function MemberRow({
  member,
  onRemove,
}: {
  member: ClinicGroupMember;
  onRemove: (memberId: string, reason: string) => void;
}) {
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");

  const name = member.patient?.child_full_name ?? "—";
  const initials = name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const level = (member.patient as Record<string, unknown>)?.vbmapp_level as number | null | undefined;
  const birthdate = member.patient?.child_birthdate ?? "";

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">{name}</div>
          <div className="text-xs text-gray-400">
            {ageText(birthdate)} · No grupo há{" "}
            {Math.floor((Date.now() - new Date(member.joined_at).getTime()) / (1000 * 60 * 60 * 24 * 30))} meses
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {level !== null && level !== undefined && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
            Nível {level}
          </span>
        )}
        <button
          type="button"
          onClick={() => setShowRemoveModal(true)}
          className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
        >
          <UserMinus size={13} />
          Registrar saída
        </button>
      </div>

      {showRemoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4" style={{ border: "0.5px solid #E5E7EB" }}>
            <h3 className="text-sm font-semibold text-gray-900">Registrar saída de {name}</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Motivo da saída</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                rows={3}
                placeholder="Ex: Alta terapêutica, mudança de modalidade..."
                className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRemoveModal(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!leaveReason.trim()}
                onClick={() => { onRemove(member.id, leaveReason); setShowRemoveModal(false); }}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar saída
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  candidate,
  onAdd,
}: {
  candidate: GroupCandidate;
  onAdd: (candidate: GroupCandidate, justification?: string) => void;
}) {
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [justification, setJustification] = useState("");

  const hasAlerts = candidate.matchingResult.alerts.length > 0;
  const hasBlock = candidate.matchingResult.alerts.some((a) => a.severity === "block");
  const scoreColor = candidate.score >= 80 ? "text-green-600" : candidate.score >= 60 ? "text-yellow-600" : "text-red-500";

  const handleAddClick = () => {
    if (hasAlerts) {
      setShowAlertModal(true);
    } else {
      onAdd(candidate);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-gray-50" style={{ border: "0.5px solid #E5E7EB" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-900">{candidate.child_name}</div>
          <div className="text-xs text-gray-400">{ageText(candidate.child_birthdate)} · Nível {candidate.vbmapp_level ?? "—"}</div>
        </div>
        <span className={`text-sm font-bold ${scoreColor}`}>{candidate.score}%</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {candidate.matchingResult.alerts.length === 0 ? (
          <>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700">
              <CheckCircle2 size={9} /> Nível ✓
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700">
              <CheckCircle2 size={9} /> Idade ✓
            </span>
            {!candidate.factor_b && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700">
                <CheckCircle2 size={9} /> Fator B ✓
              </span>
            )}
          </>
        ) : (
          candidate.matchingResult.alerts.map((alert, i) => (
            <AlertBadge key={i} alert={alert} />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={handleAddClick}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
        style={{ border: "1px solid #C7D2FE" }}
      >
        <UserPlus size={12} />
        Convidar para o grupo
      </button>

      {showAlertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={16} color="#CA8A04" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Incompatibilidade detectada</h3>
                <p className="text-xs text-gray-500 mt-0.5">{candidate.child_name}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {candidate.matchingResult.alerts.map((alert, i) => (
                <div key={i} className="flex flex-col gap-0.5 px-3 py-2 rounded-lg bg-gray-50">
                  <div className="text-xs font-medium text-gray-700">{alert.criterion}</div>
                  <div className="text-[11px] text-gray-500">Esperado: {alert.expected}</div>
                  <div className="text-[11px] text-gray-500">Atual: {alert.actual}</div>
                </div>
              ))}
            </div>

            {hasBlock && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700">
                  Justificativa clínica obrigatória
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  placeholder="Descreva a razão clínica para incluir este candidato..."
                  className="px-3 py-2 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAlertModal(false)}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={hasBlock && !justification.trim()}
                onClick={() => {
                  onAdd(candidate, justification || undefined);
                  setShowAlertModal(false);
                }}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirmar inclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"composicao" | "sessoes" | "historico">("composicao");

  const getGroup = useServerFn(getGroupDetailServer);
  const getCandidates = useServerFn(getSuggestedCandidatesServer);
  const addMember = useServerFn(addGroupMemberServer);
  const removeMember = useServerFn(removeGroupMemberServer);
  const updateStatus = useServerFn(updateGroupStatusServer);

  const groupQuery = useQuery({
    queryKey: ["groupDetail", groupId],
    queryFn: async () => getGroup({ data: { groupId }, headers: await authHeaders() }),
    enabled: !!user && !!groupId,
    staleTime: 15_000,
  });

  const candidatesQuery = useQuery({
    queryKey: ["groupCandidates", groupId],
    queryFn: async () => getCandidates({ data: { groupId }, headers: await authHeaders() }),
    enabled: !!user && !!groupId,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: async ({ profileId, justification }: { profileId: string; justification?: string }) =>
      addMember({
        data: { groupId, patientProfileId: profileId, exceptionJustification: justification },
        headers: await authHeaders(),
      }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error((res as { ok: false; error: string }).error || "Erro ao adicionar membro"); return; }
      toast.success("Membro adicionado ao grupo!");
      void queryClient.invalidateQueries({ queryKey: ["groupDetail", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["groupCandidates", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["clinicGroups"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ memberId, reason }: { memberId: string; reason: string }) =>
      removeMember({ data: { memberId, leaveReason: reason }, headers: await authHeaders() }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error || "Erro ao remover membro"); return; }
      toast.success("Saída registrada com sucesso.");
      void queryClient.invalidateQueries({ queryKey: ["groupDetail", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["groupCandidates", groupId] });
      void queryClient.invalidateQueries({ queryKey: ["clinicGroups"] });
    },
  });

  const group = groupQuery.data?.ok ? groupQuery.data.group : null;
  const candidates = candidatesQuery.data?.ok ? candidatesQuery.data.candidates : [];

  const statusColor = group ? GROUP_STATUS_COLORS[group.status] : GROUP_STATUS_COLORS.formando;
  const activeCount = group?.member_count ?? 0;
  const vacancies = group ? group.capacity_max - activeCount : 0;

  if (groupQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Carregando grupo...
      </div>
    );
  }

  if (!group) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <p className="text-sm text-gray-500">Grupo não encontrado.</p>
        <Link to="/clinica/grupos" className="text-indigo-600 text-sm mt-2 inline-flex items-center gap-1">
          <ArrowLeft size={13} /> Voltar para grupos
        </Link>
      </div>
    );
  }

  const scheduleText = `${DAY_NAMES_SHORT[group.day_of_week]} · ${group.start_time.slice(0, 5)}h`;
  const durationH = `${group.start_time.slice(0, 5)}–${(() => {
    const [h, m] = group.start_time.split(":").map(Number);
    const endMin = h * 60 + m + group.duration_minutes;
    return `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
  })()}h`;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/clinica/grupos" className="text-gray-500 hover:text-indigo-600 flex items-center gap-1">
          <ArrowLeft size={13} />
          Grupos ABA
        </Link>
        <ChevronRight size={13} className="text-gray-300" />
        <span className="font-medium text-gray-900">{group.name}</span>
        <span
          className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: statusColor.bg, color: statusColor.color, border: `1px solid ${statusColor.border}` }}
        >
          {GROUP_STATUS_LABELS[group.status]}
        </span>
      </div>

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-gray-100">
            {(["composicao", "sessoes", "historico"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  tab === t
                    ? "text-indigo-600 border-indigo-600"
                    : "text-gray-500 border-transparent hover:text-gray-700",
                ].join(" ")}
              >
                {t === "composicao" ? "Composição" : t === "sessoes" ? "Sessões" : "Histórico"}
              </button>
            ))}
          </div>

          {tab === "composicao" && (
            <div className="flex flex-col gap-3">
              {/* Membros ativos */}
              <div className="bg-white rounded-xl" style={{ border: "0.5px solid #E5E7EB" }}>
                <div className="px-4 py-3 border-b border-gray-50">
                  <span className="text-sm font-semibold text-gray-900">
                    Membros ativos ({activeCount}/{group.capacity_max})
                  </span>
                </div>
                {(group.members ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    Nenhum membro no grupo ainda
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {(group.members ?? []).map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        onRemove={(id, reason) => removeMutation.mutate({ memberId: id, reason })}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Vaga disponível */}
              {vacancies > 0 && (
                <div
                  className="p-4 rounded-xl flex items-center justify-between"
                  style={{ background: "#EEF2FF", border: "1px dashed #4F46E5" }}
                >
                  <div>
                    <div className="text-sm font-medium text-indigo-700">
                      {vacancies} vaga{vacancies > 1 ? "s" : ""} disponível{vacancies > 1 ? "is" : ""}
                    </div>
                    <div className="text-xs text-indigo-500 mt-0.5">
                      {candidatesQuery.isLoading
                        ? "Buscando candidatos..."
                        : `${candidates.length} candidato${candidates.length !== 1 ? "s" : ""} elegível${candidates.length !== 1 ? "is" : ""} na fila`}
                    </div>
                  </div>
                  <Users2 size={20} className="text-indigo-400" />
                </div>
              )}
            </div>
          )}

          {tab === "sessoes" && (
            <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3 text-center" style={{ border: "0.5px solid #E5E7EB" }}>
              <Clock size={24} className="text-gray-300" />
              <p className="text-sm text-gray-500">
                As sessões do grupo aparecem na agenda na aba "Por grupo".
              </p>
              <Link
                to="/clinica/agenda"
                className="text-indigo-600 text-sm font-medium hover:underline"
              >
                Ver agenda →
              </Link>
            </div>
          )}

          {tab === "historico" && (
            <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-3 text-center" style={{ border: "0.5px solid #E5E7EB" }}>
              <Info size={24} className="text-gray-300" />
              <p className="text-sm text-gray-500">Histórico de entradas e saídas será exibido aqui.</p>
            </div>
          )}
        </div>

        {/* Sidebar: definições + candidatos */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4">
          {/* Definições do grupo */}
          <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid #E5E7EB" }}>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Definições do grupo</h3>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Terapeuta</span>
                <span className="font-medium text-gray-900">{group.therapist_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sala</span>
                <span className="font-medium text-gray-900">{group.room_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Horário</span>
                <span className="font-medium text-gray-900">{scheduleText}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duração</span>
                <span className="font-medium text-gray-900">{durationH}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Capacidade</span>
                <span className="font-medium text-gray-900">{group.capacity_max} membros</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-50">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Critérios de admissão</h4>
              <div className="flex flex-col gap-1.5 text-xs text-gray-700">
                <span>
                  Nível {group.matching_criteria.vbmapp_level_min}–{group.matching_criteria.vbmapp_level_max} VB-MAPP
                </span>
                <span>
                  {group.matching_criteria.age_min}–{group.matching_criteria.age_max} anos
                </span>
                <span className={group.matching_criteria.allow_factor_b ? "text-green-600" : "text-gray-500"}>
                  Fator B {group.matching_criteria.allow_factor_b ? "permitido" : "não permitido"}
                </span>
              </div>
            </div>
          </div>

          {/* Candidatos elegíveis */}
          {vacancies > 0 && (
            <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid #E5E7EB" }}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Candidatos elegíveis ({candidates.length})
              </h3>
              {candidatesQuery.isLoading ? (
                <p className="text-xs text-gray-400">Buscando candidatos...</p>
              ) : candidates.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Nenhum candidato na fila de ABA em grupo com os critérios deste grupo.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {candidates.slice(0, 5).map((c) => (
                    <CandidateRow
                      key={c.entry_id}
                      candidate={c}
                      onAdd={(cand, justification) =>
                        addMutation.mutate({ profileId: cand.patient_profile_id, justification })
                      }
                    />
                  ))}
                  {candidates.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">
                      +{candidates.length - 5} candidato{candidates.length - 5 !== 1 ? "s" : ""} adicionais
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
