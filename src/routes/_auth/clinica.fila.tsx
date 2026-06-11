import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Clock, Filter, ArrowUpDown, ExternalLink,
  AlertTriangle, ChevronRight, Copy, CheckCircle2, Loader2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listQueueEntriesServer } from "@/lib/queue.functions";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { authHeaders } from "@/lib/auth-headers";
import { supabase } from "@/integrations/supabase/client";
import {
  QUEUE_MODALIDADE_LABELS,
  QUEUE_TIER_LABELS,
  QUEUE_STATUS_LABELS,
  type QueueEntry,
  type QueueModalidade,
  type QueueTier,
  type QueueStatus,
} from "@/types/queue";

export const Route = createFileRoute("/_auth/clinica/fila")({
  head: () => ({
    meta: [{ title: "Fila de Espera — Clínica TEAmo" }],
  }),
  component: ClinicFilaPage,
});

// ─── Badges ───────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: QueueTier }) {
  const styles: Record<QueueTier, { bg: string; text: string; border: string }> = {
    alta:     { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
    moderada: { bg: "#FEFCE8", text: "#92400E", border: "#FDE68A" },
    rotina:   { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
    triagem:  { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
  };
  const s = styles[tier];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    >
      {QUEUE_TIER_LABELS[tier]}
    </span>
  );
}

function StatusBadge({ status }: { status: QueueStatus }) {
  const styles: Record<QueueStatus, { bg: string; text: string }> = {
    aguardando:   { bg: "#EEF2FF", text: "#4338CA" },
    em_avaliacao: { bg: "#EDE9FE", text: "#6D28D9" },
    agendado:     { bg: "#F0FDF4", text: "#166534" },
    inativo:      { bg: "#F3F4F6", text: "#6B7280" },
  };
  const s = styles[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {QUEUE_STATUS_LABELS[status]}
    </span>
  );
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function calcAge(birthdate: string): string {
  const birth = new Date(birthdate);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths}m`;
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return m > 0 ? `${y}a ${m}m` : `${y}a`;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// ─── Abas de modalidade ───────────────────────────────────────────────────────

const ABAS: { value: QueueModalidade | "todas"; label: string }[] = [
  { value: "todas",          label: "Todas" },
  { value: "avaliacao",      label: "Avaliação inicial" },
  { value: "aba_individual", label: "ABA Individual" },
  { value: "aba_grupo",      label: "ABA em grupo" },
  { value: "orientacao_pais",label: "Orientação de pais" },
];

// ─── Linha da tabela ──────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: QueueEntry }) {
  const dias = daysAgo(entry.created_at);
  return (
    <tr className="group hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 text-sm">{entry.child_name}</div>
        <div className="text-xs text-gray-500">{calcAge(entry.child_birthdate)}</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        <div className="flex flex-wrap gap-1">
          {entry.modalidades.map((m) => (
            <span
              key={m}
              className="inline-block px-1.5 py-0.5 rounded text-xs"
              style={{ background: "#EEF2FF", color: "#4338CA" }}
            >
              {QUEUE_MODALIDADE_LABELS[m as QueueModalidade]}
            </span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <TierBadge tier={entry.priority_tier} />
        <div className="text-xs text-gray-400 mt-0.5">{entry.priority_score.toFixed(0)} pts</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={entry.status} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {dias === 0 ? "Hoje" : `${dias}d`}
      </td>
      <td className="px-4 py-3">
        <Link
          to="/clinica/fila/$entryId"
          params={{ entryId: entry.id }}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Analisar <ChevronRight size={13} />
        </Link>
      </td>
    </tr>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function ClinicFilaPage() {
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<QueueModalidade | "todas">("todas");
  const [filterTier, setFilterTier] = useState<QueueTier | "todas">("todas");
  const [filterStatus, setFilterStatus] = useState<QueueStatus | "todas">("aguardando");
  const [sortMode, setSortMode] = useState<"prioridade" | "cronologico">("prioridade");
  const [linkCopied, setLinkCopied] = useState(false);

  const getClinic = useServerFn(getMyClinicServer);
  const listEntries = useServerFn(listQueueEntriesServer);

  const clinicQuery = useQuery({
    queryKey: ["my-clinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
  });

  const clinic = clinicQuery.data?.clinic;

  const entriesQuery = useQuery({
    queryKey: ["queue-entries", clinic?.id, aba, filterTier, filterStatus],
    queryFn: async () => {
      if (!clinic?.id) return [];
      return listEntries({
        data: {
          clinicId:   clinic.id,
          modalidade: aba === "todas" ? undefined : aba,
          tier:       filterTier === "todas" ? undefined : filterTier,
          status:     filterStatus === "todas" ? undefined : filterStatus,
        },
        headers: await authHeaders(),
      });
    },
    enabled: !!clinic?.id,
  });

  // Realtime: escutar INSERT/UPDATE em queue_entries da clínica
  useEffect(() => {
    if (!clinic?.id) return;
    const channel = supabase
      .channel(`queue_entries:${clinic.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `clinic_id=eq.${clinic.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["queue-entries"] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id, queryClient]);

  const entries = entriesQuery.data ?? [];

  // Ordenação
  const sorted = [...entries].sort((a, b) => {
    if (sortMode === "prioridade") {
      const tierOrder: Record<QueueTier, number> = { alta: 0, moderada: 1, rotina: 2, triagem: 3 };
      const td = tierOrder[a.priority_tier] - tierOrder[b.priority_tier];
      if (td !== 0) return td;
      return b.priority_score - a.priority_score;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Contagens por tier
  const counts = entries.reduce(
    (acc, e) => { acc[e.priority_tier] = (acc[e.priority_tier] ?? 0) + 1; return acc; },
    {} as Record<QueueTier, number>,
  );

  const publicLink = clinic?.slug
    ? `${window.location.origin}/fila-espera/${clinic.slug}`
    : null;

  const handleCopyLink = () => {
    if (!publicLink) return;
    navigator.clipboard.writeText(publicLink).then(() => {
      setLinkCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  if (clinicQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div
          className="bg-white rounded-xl p-12 flex flex-col items-center gap-3 text-center"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <AlertTriangle size={28} className="text-amber-400" />
          <p className="text-sm text-gray-600">Clínica não encontrada. Conclua o onboarding primeiro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fila de Espera</h1>
          <p className="text-sm text-gray-500 mt-0.5">{entries.length} casos · priorização automática por score clínico</p>
        </div>
        <div className="flex items-center gap-2">
          {publicLink && (
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              style={{ border: "1px solid #C7D2FE" }}
            >
              {linkCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {linkCopied ? "Copiado!" : "Link do Form 1"}
            </button>
          )}
          {publicLink && (
            <a
              href={publicLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED)" }}
            >
              <ExternalLink size={14} /> Ver Form 1
            </a>
          )}
          {!clinic.slug && (
            <Link
              to="/clinica/configuracoes"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-700 hover:bg-amber-100 transition-colors"
              style={{ background: "#FEF9C3", border: "1px solid #FDE68A" }}
            >
              <AlertTriangle size={14} className="shrink-0" />
              Configure um slug para ativar o Form 1 público
              <span className="ml-auto font-semibold underline whitespace-nowrap">→ Configurações</span>
            </Link>
          )}
        </div>
      </div>

      {/* Cards de resumo por tier */}
      <div className="grid grid-cols-4 gap-4">
        {(["alta","moderada","rotina","triagem"] as QueueTier[]).map((tier) => {
          const styles: Record<QueueTier, { bg: string; text: string; border: string }> = {
            alta:     { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
            moderada: { bg: "#FEFCE8", text: "#92400E", border: "#FDE68A" },
            rotina:   { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
            triagem:  { bg: "#F3F4F6", text: "#6B7280", border: "#E5E7EB" },
          };
          const s = styles[tier];
          return (
            <div
              key={tier}
              className="bg-white rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ border: "0.5px solid #E5E7EB" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
              >
                <Users size={14} style={{ color: s.text }} />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">{counts[tier] ?? 0}</div>
                <div className="text-xs" style={{ color: s.text }}>{QUEUE_TIER_LABELS[tier]}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Abas de modalidade */}
      <div className="flex items-center gap-1 flex-wrap">
        {ABAS.map((a) => {
          const count = a.value === "todas"
            ? entries.length
            : entries.filter((e) => e.modalidades.includes(a.value as QueueModalidade)).length;
          return (
            <button
              key={a.value}
              onClick={() => setAba(a.value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: aba === a.value ? "#4F46E5" : "white",
                color: aba === a.value ? "white" : "#374151",
                border: `1.5px solid ${aba === a.value ? "#4F46E5" : "#E5E7EB"}`,
              }}
            >
              {a.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{
                  background: aba === a.value ? "rgba(255,255,255,0.25)" : "#F3F4F6",
                  color: aba === a.value ? "white" : "#6B7280",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros e ordenação */}
      <div
        className="bg-white rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter size={14} />
          <span>Filtros:</span>
        </div>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value as QueueTier | "todas")}
          className="text-sm px-2 py-1.5 rounded-lg text-gray-700 outline-none"
          style={{ border: "1px solid #E5E7EB" }}
        >
          <option value="todas">Todas as faixas</option>
          <option value="alta">Alta prioridade</option>
          <option value="moderada">Moderada</option>
          <option value="rotina">Rotina</option>
          <option value="triagem">Triagem pendente</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as QueueStatus | "todas")}
          className="text-sm px-2 py-1.5 rounded-lg text-gray-700 outline-none"
          style={{ border: "1px solid #E5E7EB" }}
        >
          <option value="todas">Todos os status</option>
          <option value="aguardando">Aguardando</option>
          <option value="em_avaliacao">Em avaliação</option>
          <option value="agendado">Agendado</option>
          <option value="inativo">Inativo</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown size={14} className="text-gray-400" />
          <button
            onClick={() => setSortMode("prioridade")}
            className="text-sm px-2 py-1 rounded font-medium transition-colors"
            style={{ color: sortMode === "prioridade" ? "#4F46E5" : "#6B7280" }}
          >
            Por prioridade
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setSortMode("cronologico")}
            className="text-sm px-2 py-1 rounded font-medium transition-colors"
            style={{ color: sortMode === "cronologico" ? "#4F46E5" : "#6B7280" }}
          >
            Cronológico
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #E5E7EB" }}>
        {entriesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-indigo-600" size={24} />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center">
              <Users size={24} className="text-indigo-400" />
            </div>
            <p className="font-medium text-gray-900">Nenhum caso encontrado</p>
            <p className="text-sm text-gray-500 max-w-sm">
              {entries.length === 0
                ? "Compartilhe o link do Form 1 com as famílias para receber solicitações de vaga."
                : "Tente ajustar os filtros para ver mais casos."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Paciente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Modalidades</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Faixa</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tempo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#F3F4F6" }}>
                {sorted.map((e) => <EntryRow key={e.id} entry={e} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
