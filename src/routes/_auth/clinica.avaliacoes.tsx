import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, Plus, Clock, CheckCircle2, FileText, Loader2, AlertTriangle } from "lucide-react";
import { listEvaluationReportsServer } from "@/lib/clinic-evaluation.functions";
import { listQueueEntriesServer } from "@/lib/queue.functions";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { authHeaders } from "@/lib/auth-headers";
import { EVALUATION_INSTRUMENTS, type EvaluationReport } from "@/types/clinic-evaluation";
import { useClinicPlan } from "@/services/subscription.service";
import { useUpgrade } from "@/components/premium/PremiumGate";
import { UsageBar } from "@/components/premium/UsageBar";

export const Route = createFileRoute("/_auth/clinica/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações — Clínica TEAmo" }] }),
  component: ClinicAvaliacoesPage,
});

function statusBadge(status: EvaluationReport["status"]) {
  if (status === "finalizado") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: "#DCFCE7", color: "#16A34A", border: "0.5px solid #86EFAC" }}>
        <CheckCircle2 size={11} /> Finalizado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: "#FEF9C3", color: "#A16207", border: "0.5px solid #FDE68A" }}>
      <Clock size={11} /> Rascunho
    </span>
  );
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function ClinicAvaliacoesPage() {
  const [tab, setTab] = useState<"em_sessao" | "aguardando_relatorio" | "concluidas">("em_sessao");
  const { openUpgrade } = useUpgrade();

  const getClinic = useServerFn(getMyClinicServer);
  const listReports = useServerFn(listEvaluationReportsServer);
  const listQueue = useServerFn(listQueueEntriesServer);

  const clinicQuery = useQuery({
    queryKey: ["my-clinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
  });
  const clinicId = clinicQuery.data?.clinic?.id;
  const { isClinicPremium, limits } = useClinicPlan(clinicId);

  const reportsQuery = useQuery({
    queryKey: ["evaluation-reports", clinicId],
    enabled: !!clinicId,
    queryFn: async () => listReports({ data: { clinicId: clinicId! }, headers: await authHeaders() }),
  });

  const queueQuery = useQuery({
    queryKey: ["queue-em-avaliacao", clinicId],
    enabled: !!clinicId,
    queryFn: async () =>
      listQueue({ data: { clinicId: clinicId!, status: "em_avaliacao" }, headers: await authHeaders() }),
  });

  const reportsResult = reportsQuery.data;
  const reports: EvaluationReport[] = (reportsResult && "reports" in reportsResult && reportsResult.ok)
    ? reportsResult.reports
    : [];

  const queueEntries = (Array.isArray(queueQuery.data) ? queueQuery.data : []);
  const reportsByEntry = new Map(reports.map((r) => [r.queue_entry_id, r]));

  const emSessao = queueEntries.filter((e) => {
    const r = reportsByEntry.get(e.id);
    return !r || r.status !== "finalizado";
  });

  const aguardandoRelatorio = queueEntries.filter((e) => {
    const r = reportsByEntry.get(e.id);
    return r && r.status === "rascunho";
  });

  const concluidas = reports.filter((r) => r.status === "finalizado");

  const loading = clinicQuery.isLoading || reportsQuery.isLoading || queueQuery.isLoading;

  const tabs = [
    { id: "em_sessao", label: "Em sessão", count: emSessao.length },
    { id: "aguardando_relatorio", label: "Aguardando relatório", count: aguardandoRelatorio.length },
    { id: "concluidas", label: "Concluídas — últimos 30 dias", count: concluidas.length },
  ] as const;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      {!isClinicPremium && !!clinicId && (
        <UsageBar
          used={reports.length}
          total={limits.avaliacoes}
          noun={["avaliação", "avaliações"]}
          onUpgrade={() => openUpgrade("clinica-avaliacoes")}
          accentColor="#2563EB"
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Avaliações</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {emSessao.length + aguardandoRelatorio.length} ativas · {concluidas.length} concluídas nos últimos 30 dias
          </p>
        </div>
        {clinicId && (
          <Link
            to="/clinica/fila"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: "#4F46E5" }}
          >
            <Plus size={15} /> Nova avaliação (via fila)
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: tab === t.id ? "#EDE9FE" : "#F3F4F6", color: tab === t.id ? "#7C3AED" : "#6B7280" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" /> Carregando...
        </div>
      ) : (
        <>
          {tab === "em_sessao" && (
            <div className="flex flex-col gap-3">
              {emSessao.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck size={28} color="#7C3AED" />}
                  title="Nenhuma avaliação em andamento"
                  desc="Quando um caso for chamado para avaliação inicial, ele aparecerá aqui."
                />
              ) : (
                emSessao.map((entry) => {
                  const report = reportsByEntry.get(entry.id);
                  return (
                    <div key={entry.id} className="bg-white rounded-xl p-5 flex items-center gap-4"
                      style={{ border: "0.5px solid #E5E7EB" }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{entry.child_name}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-sm text-gray-500">{entry.responsavel_nome}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">
                            Sessões registradas: {report?.sessions_count ?? 0}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            Progresso:
                            <div className="w-24 h-1.5 rounded-full bg-gray-100 ml-1">
                              <div className="h-1.5 rounded-full bg-indigo-500"
                                style={{ width: report ? "33%" : "0%" }} />
                            </div>
                            <span className="text-indigo-600 font-medium">
                              {report ? "1/3" : "0/3"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/clinica/avaliacoes/$entryId"
                        params={{ entryId: entry.id }}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                        style={{ border: "1px solid #4F46E5" }}
                      >
                        Ver avaliação
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "aguardando_relatorio" && (
            <div className="flex flex-col gap-3">
              {aguardandoRelatorio.length === 0 ? (
                <EmptyState
                  icon={<FileText size={28} color="#7C3AED" />}
                  title="Nenhum relatório pendente"
                  desc="Avaliações finalizadas aguardando relatório aparecerão aqui."
                />
              ) : (
                aguardandoRelatorio.map((entry) => {
                  const days = daysSince(entry.updated_at);
                  const urgent = days >= 5;
                  return (
                    <div key={entry.id} className="bg-white rounded-xl p-5 flex items-center gap-4"
                      style={{ border: `0.5px solid ${urgent ? "#EF4444" : "#7C3AED"}`, background: urgent ? "#FFF5F5" : "#FAFAF9" }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{entry.child_name}</span>
                          {urgent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                              style={{ background: "#FEE2E2", color: "#DC2626" }}>
                              <AlertTriangle size={10} /> +{days}d aguardando
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{entry.responsavel_nome}</p>
                        <p className="text-xs text-gray-400 mt-1">Última atualização: {entry.updated_at.slice(0, 10)}</p>
                      </div>
                      <Link
                        to="/clinica/avaliacoes/$entryId"
                        params={{ entryId: entry.id }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                        style={{ background: "#4F46E5" }}
                      >
                        Registrar relatório
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "concluidas" && (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid #E5E7EB" }}>
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-500 font-medium"
                style={{ background: "#F9FAFB", borderBottom: "0.5px solid #E5E7EB" }}>
                <span className="flex-1">Paciente</span>
                <span className="w-24 text-center">Instrumento</span>
                <span className="w-20 text-center">Resultado</span>
                <span className="w-20 text-center">Data</span>
                <span className="w-24 text-center">Status</span>
                <span className="w-24 text-center">Ação</span>
              </div>
              {concluidas.length === 0 ? (
                <div className="px-6 py-10 text-center text-sm text-gray-400">
                  Nenhuma avaliação concluída nos últimos 30 dias.
                </div>
              ) : (
                concluidas.map((report) => {
                  const entry = queueEntries.find((e) => e.id === report.queue_entry_id);
                  const instrument = EVALUATION_INSTRUMENTS.find(
                    (i) => report.instruments.includes(i.value)
                  );
                  return (
                    <div key={report.id} className="px-4 py-3 flex items-center gap-2 hover:bg-gray-50"
                      style={{ borderBottom: "0.5px solid #F3F4F6" }}>
                      <span className="flex-1 font-medium text-sm text-gray-900">
                        {entry?.child_name ?? "—"}
                      </span>
                      <span className="w-24 text-center text-xs text-gray-500">
                        {instrument?.label ?? report.instruments[0] ?? "—"}
                      </span>
                      <span className="w-20 text-center">
                        {report.vbmapp_level ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: "#EDE9FE", color: "#7C3AED" }}>
                            Nível {report.vbmapp_level}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </span>
                      <span className="w-20 text-center text-xs text-gray-500">
                        {report.finalized_at?.slice(0, 10) ?? "—"}
                      </span>
                      <span className="w-24 text-center">{statusBadge(report.status)}</span>
                      <span className="w-24 text-center">
                        <Link
                          to="/clinica/avaliacoes/$entryId"
                          params={{ entryId: report.queue_entry_id }}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Ver relatório
                        </Link>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
      style={{ border: "0.5px solid #E5E7EB" }}>
      <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">{icon}</div>
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-md">{desc}</p>
      </div>
    </div>
  );
}
