import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, User, Phone, Mail, Calendar, ClipboardList,
  BarChart3, Clock, AlertTriangle, Loader2, CheckCircle2,
  History,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getQueueEntryServer, adjustQueueTierServer } from "@/lib/queue.functions";
import { authHeaders } from "@/lib/auth-headers";
import {
  QUEUE_TIER_LABELS,
  QUEUE_MODALIDADE_LABELS,
  QUEUE_STATUS_LABELS,
  type QueueTier,
  type QueueModalidade,
} from "@/types/queue";

export const Route = createFileRoute("/_auth/clinica/fila/$entryId")({
  head: () => ({
    meta: [{ title: "Ficha do Caso — Clínica TEAmo" }],
  }),
  component: FilaCasoPage,
});

// ─── Badges ───────────────────────────────────────────────────────────────────

function TierBadge({ tier, large }: { tier: QueueTier; large?: boolean }) {
  const styles: Record<QueueTier, { bg: string; text: string; border: string }> = {
    alta:     { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
    moderada: { bg: "#FEFCE8", text: "#92400E", border: "#FDE68A" },
    rotina:   { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
    triagem:  { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
  };
  const s = styles[tier];
  return (
    <span
      className={`inline-flex items-center ${large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"} rounded-full font-semibold`}
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {QUEUE_TIER_LABELS[tier]}
    </span>
  );
}

// ─── Score breakdown ──────────────────────────────────────────────────────────

function ScoreBar({ label, value, max = 100, color }: {
  label: string; value: number; max?: number; color: string;
}) {
  const pct = Math.min(value / max * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-medium">{value.toFixed(0)} pts</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Modal de ajuste de faixa ─────────────────────────────────────────────────

function AjustarFaixaModal({
  entry,
  onClose,
  onSuccess,
}: {
  entry: { id: string; priority_tier: QueueTier; child_name: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [newTier, setNewTier] = useState<"alta" | "moderada" | "rotina">(
    entry.priority_tier === "triagem" ? "rotina" : (entry.priority_tier as "alta" | "moderada" | "rotina"),
  );
  const [justificativa, setJustificativa] = useState("");

  const adjustTier = useServerFn(adjustQueueTierServer);
  const mutation = useMutation({
    mutationFn: async () =>
      adjustTier({
        data: { entryId: entry.id, newTier, justificativa },
        headers: await authHeaders(),
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Faixa ajustada com sucesso.");
        onSuccess();
      } else {
        toast.error(res.error || "Erro ao ajustar faixa.");
      }
    },
  });

  const tierOptions: { value: "alta" | "moderada" | "rotina"; label: string }[] = [
    { value: "alta",     label: "Alta prioridade" },
    { value: "moderada", label: "Moderada" },
    { value: "rotina",   label: "Rotina" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900">Ajustar prioridade</h2>
          <p className="text-sm text-gray-500 mt-0.5">{entry.child_name}</p>
        </div>

        <div className="px-6 pb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Faixa atual (somente leitura)</p>
          <div
            className="rounded-lg px-3 py-2 text-sm font-medium mb-5"
            style={{ background: "#F3F4F6", color: "#374151" }}
          >
            <TierBadge tier={entry.priority_tier} />
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nova faixa</p>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {tierOptions.map((t) => {
              const colors: Record<string, { bg: string; border: string; text: string }> = {
                alta:     { bg: "#FEF2F2", border: "#EF4444", text: "#B91C1C" },
                moderada: { bg: "#FEFCE8", border: "#EAB308", text: "#92400E" },
                rotina:   { bg: "#F0FDF4", border: "#22C55E", text: "#166534" },
              };
              const s = colors[t.value];
              const active = newTier === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNewTier(t.value)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all text-sm font-medium"
                  style={{
                    border: `1.5px solid ${active ? s.border : "#E5E7EB"}`,
                    background: active ? s.bg : "white",
                    color: active ? s.text : "#374151",
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: active ? s.border : "#D1D5DB" }}
                  />
                  {t.label}
                </button>
              );
            })}
          </div>

          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Justificativa <span className="text-red-500">*</span>
          </p>
          <p className="text-xs text-gray-400 mb-2">{justificativa.length} / 20 min.</p>
          <textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Descreva o motivo do ajuste clínico..."
            rows={4}
            maxLength={1000}
            className="w-full px-3 py-2.5 rounded-lg text-sm text-gray-900 outline-none resize-none"
            style={{ border: "1.5px solid #E5E7EB" }}
          />
          <p
            className="mt-2 flex items-center gap-1.5 text-xs text-gray-400"
          >
            <AlertTriangle size={12} />
            Este registro ficará no histórico permanente do caso para fins de auditoria.
          </p>
        </div>

        <div
          className="px-6 py-4 flex gap-3"
          style={{ borderTop: "0.5px solid #E5E7EB" }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-700 bg-white"
            style={{ border: "1.5px solid #E5E7EB" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={justificativa.length < 20 || mutation.isPending}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED)" }}
          >
            {mutation.isPending ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Confirmar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function FilaCasoPage() {
  const { entryId } = Route.useParams();
  const queryClient = useQueryClient();
  const [showAjustar, setShowAjustar] = useState(false);

  const getEntry = useServerFn(getQueueEntryServer);

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ["queue-entry", entryId],
    queryFn: async () => getEntry({ data: { entryId }, headers: await authHeaders() }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: "0.5px solid #E5E7EB" }}>
          <AlertTriangle size={28} className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Caso não encontrado ou sem acesso.</p>
          <Link to="/clinica/fila" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 font-medium">
            <ArrowLeft size={14} /> Voltar à fila
          </Link>
        </div>
      </div>
    );
  }

  // Calcular breakdown do score
  const factorA = (entry.factor_a ?? {}) as Record<string, unknown>;
  const factorB = (entry.factor_b ?? {}) as Record<string, unknown>;
  const factorC = (entry.factor_c ?? {}) as Record<string, unknown>;

  const scoreA =
    (factorA.sem_servico_atual ? 40 : 0) +
    (factorA.diagnose_recente ? 35 : 0) +
    (factorA.idade_critica ? 25 : 0);

  const scoreB = factorB.comportamento_desafio
    ? factorB.gravidade === "grave" ? 100 : factorB.gravidade === "moderado" ? 66 : 33
    : 0;

  const scoreC =
    (factorC.renda_baixa ? 50 : 0) +
    (factorC.responsavel_solo ? 30 : 0) +
    (Number(factorC.distancia_km ?? 0) > 30 ? 20 : 0);

  const dias = Math.floor((Date.now() - new Date(entry.created_at).getTime()) / 86_400_000);
  const scoreTime = Math.min(dias / 180 * 100, 100);

  const age = (() => {
    const birth = new Date(entry.child_birthdate);
    const now = new Date();
    const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    return m > 0 ? `${y} anos e ${m} meses` : `${y} anos`;
  })();

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/clinica/fila" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={14} /> Fila de Espera
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">{entry.child_name}</span>
      </div>

      {/* Header do caso */}
      <div className="bg-white rounded-xl p-5 flex items-start justify-between gap-4" style={{ border: "0.5px solid #E5E7EB" }}>
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-indigo-700 text-xl font-bold"
            style={{ background: "#EEF2FF" }}
          >
            {entry.child_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{entry.child_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{age} · {dias === 0 ? "Entrou hoje" : `${dias} dias na fila`}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <TierBadge tier={entry.priority_tier} large />
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "#EEF2FF", color: "#4338CA" }}
              >
                {QUEUE_STATUS_LABELS[entry.status]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 min-w-max">
          <button
            onClick={() => setShowAjustar(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
            style={{ border: "1px solid #C7D2FE" }}
          >
            Ajustar faixa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Breakdown do score */}
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Score de priorização</h2>
              <span
                className="ml-auto text-2xl font-bold"
                style={{ color: entry.priority_tier === "alta" ? "#B91C1C" : entry.priority_tier === "moderada" ? "#92400E" : "#166534" }}
              >
                {entry.priority_score.toFixed(0)}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <ScoreBar label="Fator A — Urgência clínica (peso 40%)" value={scoreA} color="#4F46E5" />
              <ScoreBar label="Fator B — Comportamento desafiador (peso 35%)" value={scoreB} color="#7C3AED" />
              <ScoreBar label="Fator C — Vulnerabilidade socioeconômica (peso 15%)" value={scoreC} color="#EC4899" />
              <ScoreBar label="Modificador de tempo (peso 10%)" value={scoreTime} color="#6B7280" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-center">
              <div className="rounded-lg p-2" style={{ background: "#F3F4F6" }}>
                <div className="font-semibold text-gray-900">{scoreA.toFixed(0)}/100</div>
                <div className="text-gray-500">Fator A</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "#F3F4F6" }}>
                <div className="font-semibold text-gray-900">{scoreB.toFixed(0)}/100</div>
                <div className="text-gray-500">Fator B</div>
              </div>
              <div className="rounded-lg p-2" style={{ background: "#F3F4F6" }}>
                <div className="font-semibold text-gray-900">{scoreC.toFixed(0)}/100</div>
                <div className="text-gray-500">Fator C</div>
              </div>
            </div>
          </div>

          {/* Contexto clínico */}
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList size={16} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Contexto clínico</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Fator A — Urgência</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${factorA.sem_servico_atual ? "bg-red-400" : "bg-gray-200"}`} />
                    <span className={factorA.sem_servico_atual ? "text-gray-900" : "text-gray-400"}>Sem serviço atual</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${factorA.diagnose_recente ? "bg-red-400" : "bg-gray-200"}`} />
                    <span className={factorA.diagnose_recente ? "text-gray-900" : "text-gray-400"}>Diagnóstico recente</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${factorA.idade_critica ? "bg-red-400" : "bg-gray-200"}`} />
                    <span className={factorA.idade_critica ? "text-gray-900" : "text-gray-400"}>Menos de 6 anos</span>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Fator B — Comportamento</p>
                {factorB.comportamento_desafio ? (
                  <div>
                    <p className="text-gray-900">Comportamento desafiador ativo</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">Intensidade: {String(factorB.gravidade ?? "leve")}</p>
                    {factorB.descricao && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{String(factorB.descricao)}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400">Sem comportamento desafiador relatado</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Fator C — Vulnerabilidade</p>
                <ul className="space-y-1">
                  <li className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${factorC.renda_baixa ? "bg-amber-400" : "bg-gray-200"}`} />
                    <span className={factorC.renda_baixa ? "text-gray-900" : "text-gray-400"}>Baixa renda</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${factorC.responsavel_solo ? "bg-amber-400" : "bg-gray-200"}`} />
                    <span className={factorC.responsavel_solo ? "text-gray-900" : "text-gray-400"}>Responsável único</span>
                  </li>
                  {Number(factorC.distancia_km ?? 0) > 0 && (
                    <li className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${Number(factorC.distancia_km) > 30 ? "bg-amber-400" : "bg-gray-200"}`} />
                      <span className="text-gray-700">{String(factorC.distancia_km)} km da clínica</span>
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Modalidades de interesse</p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.modalidades.map((m) => (
                    <span
                      key={m}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#EEF2FF", color: "#4338CA" }}
                    >
                      {QUEUE_MODALIDADE_LABELS[m as QueueModalidade]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de avaliações — placeholder Fase 4 */}
          <div
            className="bg-white rounded-xl p-5"
            style={{ border: "1.5px dashed #C4B5FD" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <History size={16} className="text-violet-500" />
              <h2 className="font-semibold text-gray-700">Histórico de avaliações</h2>
            </div>
            <p className="text-sm text-gray-500">Nenhuma avaliação registrada.</p>
            <button
              disabled
              className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-indigo-600 bg-indigo-50 opacity-50 cursor-not-allowed"
              style={{ border: "1px solid #C7D2FE" }}
              title="Disponível na Fase 3"
            >
              Agendar avaliação (Fase 3)
            </button>
          </div>
        </div>

        {/* Coluna lateral — contato e disponibilidade */}
        <div className="flex flex-col gap-4">
          {/* Contato */}
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="flex items-center gap-2 mb-4">
              <User size={15} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Contato do responsável</h2>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Nome</p>
                <p className="font-medium text-gray-900">{entry.responsavel_nome}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">E-mail</p>
                <a href={`mailto:${entry.responsavel_email}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                  <Mail size={12} /> {entry.responsavel_email}
                </a>
              </div>
              {entry.responsavel_telefone && (
                <div>
                  <p className="text-xs text-gray-400">Telefone</p>
                  <a href={`tel:${entry.responsavel_telefone}`} className="flex items-center gap-1 text-gray-900">
                    <Phone size={12} /> {entry.responsavel_telefone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Diagnóstico */}
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList size={15} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Diagnóstico</h2>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              {entry.child_diagnosis && (
                <div>
                  <p className="text-xs text-gray-400">Diagnóstico</p>
                  <p className="text-gray-800">{entry.child_diagnosis}</p>
                </div>
              )}
              {entry.child_cid && (
                <div>
                  <p className="text-xs text-gray-400">CID</p>
                  <p className="font-mono text-gray-800">{entry.child_cid}</p>
                </div>
              )}
              {!entry.child_diagnosis && !entry.child_cid && (
                <p className="text-gray-400 text-xs">Não informado</p>
              )}
            </div>
          </div>

          {/* Disponibilidade */}
          <div className="bg-white rounded-xl p-5" style={{ border: "0.5px solid #E5E7EB" }}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Disponibilidade</h2>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-1">Dias</p>
                {(entry.disponibilidade?.dias ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(entry.disponibilidade.dias ?? []).map((d) => (
                      <span key={d} className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 capitalize">{d}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Não informado</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Turnos</p>
                {(entry.disponibilidade?.turnos ?? []).length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {(entry.disponibilidade.turnos ?? []).map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 capitalize">{t}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-xs">Não informado</p>
                )}
              </div>
            </div>
          </div>

          {/* Data de entrada */}
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm"
            style={{ background: "#F3F4F6" }}
          >
            <Clock size={14} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Entrou na fila em</p>
              <p className="font-medium text-gray-700">
                {new Date(entry.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de ajuste */}
      {showAjustar && (
        <AjustarFaixaModal
          entry={{ id: entry.id, priority_tier: entry.priority_tier, child_name: entry.child_name }}
          onClose={() => setShowAjustar(false)}
          onSuccess={() => {
            setShowAjustar(false);
            queryClient.invalidateQueries({ queryKey: ["queue-entry", entryId] });
            queryClient.invalidateQueries({ queryKey: ["queue-entries"] });
          }}
        />
      )}
    </div>
  );
}
