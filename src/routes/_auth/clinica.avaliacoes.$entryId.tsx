import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft, ChevronRight, Save, CheckCircle2, Loader2, FileText,
  Download, Send, Plus, Trash2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getEvaluationReportServer,
  createEvaluationReportServer,
  updateEvaluationReportServer,
  finalizeEvaluationReportServer,
  generateEvaluationPdfServer,
  sendForm3Server,
} from "@/lib/clinic-evaluation.functions";
import { getQueueEntryServer } from "@/lib/queue.functions";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { authHeaders } from "@/lib/auth-headers";
import {
  EVALUATION_INSTRUMENTS,
  VBMAPP_DOMAINS_LABELS,
  VBMAPP_DOMAIN_MAX,
  BEHAVIOR_FUNCTIONS,
  RECOMMENDED_MODALITIES,
  type EvaluationReport,
  type EvaluationGoalData,
  type BehaviorChallenge,
} from "@/types/clinic-evaluation";

export const Route = createFileRoute("/_auth/clinica/avaliacoes/$entryId")({
  head: () => ({ meta: [{ title: "Relatório de Avaliação — TEAmo" }] }),
  component: ClinicAvaliacoesEntryPage,
});

const SECTIONS = [
  "Dados da avaliação",
  "Resultados VB-MAPP",
  "Perfil funcional",
  "Comportamentos-desafio",
  "Recomendação",
  "Plano inicial",
];

function ClinicAvaliacoesEntryPage() {
  const { entryId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [section, setSection] = useState(0);
  const [reportId, setReportId] = useState<string | null>(null);

  const getClinic = useServerFn(getMyClinicServer);
  const getEntry = useServerFn(getQueueEntryServer);
  const getReport = useServerFn(getEvaluationReportServer);
  const createReport = useServerFn(createEvaluationReportServer);
  const updateReport = useServerFn(updateEvaluationReportServer);
  const finalizeReport = useServerFn(finalizeEvaluationReportServer);
  const generatePdf = useServerFn(generateEvaluationPdfServer);
  const sendForm3 = useServerFn(sendForm3Server);

  const clinicQuery = useQuery({
    queryKey: ["my-clinic"],
    queryFn: async () => getClinic({ headers: await authHeaders() }),
  });
  const clinicId = clinicQuery.data?.clinic?.id;

  const entryQuery = useQuery({
    queryKey: ["queue-entry", entryId],
    enabled: entryId !== "novo" && !!entryId,
    queryFn: async () => getEntry({ data: { entryId }, headers: await authHeaders() }),
  });
  const entry = entryQuery.data ?? null;

  const reportQuery = useQuery({
    queryKey: ["evaluation-report-by-entry", entryId, reportId],
    enabled: !!reportId,
    queryFn: async () => getReport({ data: { reportId: reportId! }, headers: await authHeaders() }),
  });
  const reportResult = reportQuery.data;
  const report = (reportResult && "report" in reportResult && reportResult.ok) ? reportResult.report : null;

  // Form state
  const [evaluationDates, setEvaluationDates] = useState<string[]>([""]);
  const [instruments, setInstruments] = useState<string[]>(["vbmapp"]);
  const [sessionsCount, setSessionsCount] = useState(1);
  const [vbmappLevel, setVbmappLevel] = useState<number | null>(null);
  const [vbmappDomains, setVbmappDomains] = useState<Record<string, number>>({});
  const [barriers, setBarriers] = useState<{ barrier: string; description: string }[]>([]);
  const [functionalProfile, setFunctionalProfile] = useState<Record<string, string>>({
    comunicacao: "", sensibilidades: "", autonomia_avds: "", interesses: "",
  });
  const [behaviorChallenges, setBehaviorChallenges] = useState<BehaviorChallenge[]>([]);
  const [fbaConducted, setFbaConducted] = useState(false);
  const [recommendedModality, setRecommendedModality] = useState<string[]>([]);
  const [recommendedHours, setRecommendedHours] = useState<number | "">("");
  const [justification, setJustification] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState<number | "">("");
  const [sessionDuration, setSessionDuration] = useState(60);
  const [goals, setGoals] = useState<EvaluationGoalData[]>([
    { domain: "", objective: "", mastery_criterion: "" },
  ]);

  // Preenche form quando relatório já existe
  useEffect(() => {
    if (!report) return;
    setEvaluationDates(report.evaluation_dates?.length ? report.evaluation_dates : [""]);
    setInstruments(report.instruments);
    setSessionsCount(report.sessions_count);
    if (report.vbmapp_level) setVbmappLevel(report.vbmapp_level);
    if (Object.keys(report.vbmapp_domains).length) setVbmappDomains(report.vbmapp_domains as Record<string, number>);
    if (report.vbmapp_barriers?.length) setBarriers(report.vbmapp_barriers);
    if (Object.keys(report.functional_profile).length) setFunctionalProfile(report.functional_profile as Record<string, string>);
    if (report.behavior_challenges?.length) setBehaviorChallenges(report.behavior_challenges);
    setFbaConducted(report.fba_conducted);
    if (report.recommended_modality?.length) setRecommendedModality(report.recommended_modality);
    if (report.recommended_hours_per_week) setRecommendedHours(report.recommended_hours_per_week);
    if (report.clinical_justification) setJustification(report.clinical_justification);
    if (report.sessions_per_week) setSessionsPerWeek(report.sessions_per_week);
    setSessionDuration(report.session_duration_minutes ?? 60);
    if (report.initial_goals?.length) setGoals(report.initial_goals);
  }, [report]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId || !entryId || entryId === "novo") throw new Error("Parâmetros inválidos");
      return createReport({ data: { clinicId, queueEntryId: entryId, instruments }, headers: await authHeaders() });
    },
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error || "Erro ao criar relatório"); return; }
      setReportId(res.reportId);
    },
    onError: () => toast.error("Erro ao criar relatório"),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) return;
      return updateReport({
        data: {
          reportId,
          evaluationDates: evaluationDates.filter(Boolean),
          instruments,
          sessionsCount,
          vbmappLevel,
          vbmappDomains,
          vbmappBarriers: barriers,
          functionalProfile,
          behaviorChallenges,
          fbaConducted,
          recommendedModality,
          recommendedHoursPerWeek: recommendedHours === "" ? null : Number(recommendedHours),
          clinicalJustification: justification || null,
          sessionsPerWeek: sessionsPerWeek === "" ? null : Number(sessionsPerWeek),
          sessionDurationMinutes: sessionDuration,
          initialGoals: goals.filter((g) => g.domain && g.objective),
        },
        headers: await authHeaders(),
      });
    },
    onSuccess: (res) => {
      if (res && !res.ok) { toast.error((res as { error: string }).error || "Erro ao salvar"); return; }
      toast.success("Rascunho salvo");
      queryClient.invalidateQueries({ queryKey: ["evaluation-report-by-entry", entryId] });
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const finalizeMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) return;
      return finalizeReport({ data: { reportId }, headers: await authHeaders() });
    },
    onSuccess: (res) => {
      if (res && !res.ok) { toast.error((res as { error: string }).error || "Erro ao finalizar"); return; }
      toast.success("Relatório finalizado!");
      queryClient.invalidateQueries({ queryKey: ["evaluation-reports", clinicId] });
      navigate({ to: "/clinica/avaliacoes" });
    },
    onError: () => toast.error("Erro ao finalizar relatório"),
  });

  const pdfMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) return;
      return generatePdf({ data: { reportId }, headers: await authHeaders() });
    },
    onSuccess: (res) => {
      if (!res?.ok) { toast.error((res as unknown as { error: string })?.error || "Erro ao gerar PDF"); return; }
      const win = window.open("", "_blank");
      if (win) { win.document.write((res as { ok: true; html: string }).html); win.document.close(); win.print(); }
    },
    onError: () => toast.error("Erro ao gerar documento"),
  });

  const isLoading = clinicQuery.isLoading || entryQuery.isLoading;
  const isFinalized = report?.status === "finalizado";
  const progress = ((section + 1) / SECTIONS.length) * 100;

  // Se entry não existe ainda, inicializar relatório
  const handleNextSection = async () => {
    if (!reportId && clinicId && entryId && entryId !== "novo") {
      const res = await createMutation.mutateAsync();
      if (!res?.ok) return;
    }
    if (reportId) await saveMutation.mutateAsync();
    if (section < SECTIONS.length - 1) setSection((s) => s + 1);
  };

  const vbmappLevelHint: Record<number, string> = {
    1: "0–18 meses — habilidades básicas: mando, tato e ouvinte inicial",
    2: "18–30 meses — habilidades intermediárias e linguagem emergente",
    3: "30–48 meses — habilidades avançadas e pré-linguagem acadêmica",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-gray-400">
        <Loader2 size={20} className="animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link to="/clinica/avaliacoes" className="text-indigo-600 hover:underline flex items-center gap-1">
          <ChevronLeft size={14} /> Avaliações
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">
          Relatório de avaliação — {entry?.child_name ?? entryId}
        </span>
        {isFinalized && (
          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: "#DCFCE7", color: "#16A34A" }}>
            Finalizado
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Dra. Fernanda — {new Date().toLocaleDateString("pt-BR")}</span>
        {reportId && !isFinalized && (
          <button
            onClick={() => pdfMutation.mutate()}
            disabled={pdfMutation.isPending}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs hover:bg-gray-100 transition-colors"
            style={{ border: "0.5px solid #E5E7EB" }}
          >
            {pdfMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            Gerar PDF (convênio)
          </button>
        )}
        {isFinalized && (
          <button
            onClick={() => pdfMutation.mutate()}
            disabled={pdfMutation.isPending}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
            style={{ border: "1px solid #4F46E5" }}
          >
            {pdfMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            Gerar PDF (convênio)
          </button>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid #E5E7EB" }}>
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3">
          {SECTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => { if (i <= section || reportId) setSection(i); }}
              className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors truncate px-1 ${
                i === section
                  ? "bg-indigo-600 text-white"
                  : i < section
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              <span className="sm:hidden">{i + 1}</span>
              <span className="hidden sm:inline">{i + 1}. {s}</span>
            </button>
          ))}
        </div>
        <div className="h-1 bg-gray-100 rounded-full">
          <div className="h-1 bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Conteúdo da seção */}
      <div className="bg-white rounded-xl p-6" style={{ border: "0.5px solid #E5E7EB" }}>
        {section === 0 && (
          <Section1
            evaluationDates={evaluationDates}
            setEvaluationDates={setEvaluationDates}
            instruments={instruments}
            setInstruments={setInstruments}
            sessionsCount={sessionsCount}
            setSessionsCount={setSessionsCount}
          />
        )}
        {section === 1 && (
          <Section2
            vbmappLevel={vbmappLevel}
            setVbmappLevel={setVbmappLevel}
            vbmappDomains={vbmappDomains}
            setVbmappDomains={setVbmappDomains}
            barriers={barriers}
            setBarriers={setBarriers}
            levelHint={vbmappLevelHint}
          />
        )}
        {section === 2 && (
          <Section3
            functionalProfile={functionalProfile}
            setFunctionalProfile={setFunctionalProfile}
          />
        )}
        {section === 3 && (
          <Section4
            behaviorChallenges={behaviorChallenges}
            setBehaviorChallenges={setBehaviorChallenges}
            fbaConducted={fbaConducted}
            setFbaConducted={setFbaConducted}
            entry={entry}
          />
        )}
        {section === 4 && (
          <Section5
            recommendedModality={recommendedModality}
            setRecommendedModality={setRecommendedModality}
            recommendedHours={recommendedHours}
            setRecommendedHours={setRecommendedHours}
            justification={justification}
            setJustification={setJustification}
            sessionsPerWeek={sessionsPerWeek}
            setSessionsPerWeek={setSessionsPerWeek}
            sessionDuration={sessionDuration}
            setSessionDuration={setSessionDuration}
            vbmappLevel={vbmappLevel}
          />
        )}
        {section === 5 && (
          <Section6
            goals={goals}
            setGoals={setGoals}
          />
        )}
      </div>

      {/* Ações */}
      {!isFinalized && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSection((s) => Math.max(0, s - 1))}
            disabled={section === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-100 transition-colors"
            style={{ border: "0.5px solid #E5E7EB" }}
          >
            <ChevronLeft size={15} /> Seção anterior
          </button>

          <div className="flex items-center gap-2">
            {reportId && (
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                style={{ border: "0.5px solid #E5E7EB" }}
              >
                {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar rascunho
              </button>
            )}

            {section < SECTIONS.length - 1 ? (
              <button
                onClick={handleNextSection}
                disabled={saveMutation.isPending || createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: "#4F46E5" }}
              >
                {(saveMutation.isPending || createMutation.isPending)
                  ? <Loader2 size={14} className="animate-spin" />
                  : null}
                Próxima seção <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => finalizeMutation.mutate()}
                disabled={finalizeMutation.isPending || justification.length < 100}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: "#4F46E5" }}
              >
                {finalizeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Finalizar relatório
              </button>
            )}
          </div>
        </div>
      )}

      {/* Relatório finalizado — ações adicionais */}
      {isFinalized && (
        <div className="bg-white rounded-xl p-5 flex items-center gap-4"
          style={{ border: "0.5px solid #E5E7EB", background: "#F0FDF4" }}>
          <CheckCircle2 size={20} color="#16A34A" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Relatório finalizado em {report?.finalized_at?.slice(0, 10)}</p>
            <p className="text-xs text-gray-500">Agora você pode enviar o Form 3 para a família preencher o cadastro completo.</p>
          </div>
          {clinicId && (
            <SendForm3Button
              clinicId={clinicId}
              queueEntryId={entryId}
              responsavelEmail={entry?.responsavel_email}
              childName={entry?.child_name}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Seção 1 — Dados da avaliação ─────────────────────────────────────────────
function Section1({ evaluationDates, setEvaluationDates, instruments, setInstruments, sessionsCount, setSessionsCount }: {
  evaluationDates: string[];
  setEvaluationDates: (v: string[]) => void;
  instruments: string[];
  setInstruments: (v: string[]) => void;
  sessionsCount: number;
  setSessionsCount: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-900">Seção 1 — Dados da avaliação</h2>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Instrumento(s) utilizado(s)</label>
        <div className="flex flex-wrap gap-2">
          {EVALUATION_INSTRUMENTS.map((inst) => (
            <button
              key={inst.value}
              onClick={() => setInstruments(
                instruments.includes(inst.value)
                  ? instruments.filter((i) => i !== inst.value)
                  : [...instruments, inst.value]
              )}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                instruments.includes(inst.value)
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {inst.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Nº de sessões realizadas</label>
          <input
            type="number"
            min={1}
            max={20}
            value={sessionsCount}
            onChange={(e) => setSessionsCount(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Data(s) de realização</label>
        <div className="flex flex-col gap-2">
          {evaluationDates.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="date"
                value={d}
                onChange={(e) => {
                  const updated = [...evaluationDates];
                  updated[i] = e.target.value;
                  setEvaluationDates(updated);
                }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              {i > 0 && (
                <button onClick={() => setEvaluationDates(evaluationDates.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {evaluationDates.length < 6 && (
            <button
              onClick={() => setEvaluationDates([...evaluationDates, ""])}
              className="text-sm text-indigo-600 hover:underline flex items-center gap-1 mt-1"
            >
              <Plus size={13} /> Adicionar data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Seção 2 — Resultados VB-MAPP ────────────────────────────────────────────
function Section2({ vbmappLevel, setVbmappLevel, vbmappDomains, setVbmappDomains, barriers, setBarriers, levelHint }: {
  vbmappLevel: number | null;
  setVbmappLevel: (v: number) => void;
  vbmappDomains: Record<string, number>;
  setVbmappDomains: (v: Record<string, number>) => void;
  barriers: { barrier: string; description: string }[];
  setBarriers: (v: { barrier: string; description: string }[]) => void;
  levelHint: Record<number, string>;
}) {
  const BARRIER_OPTIONS = [
    "Comportamentos-desafio",
    "Ausência de controle de instruções",
    "Déficit de imitação",
    "Problemas de controle de reflexos",
    "Comportamento de fuga e esquiva",
    "Déficit de atenção",
    "Déficit de motivação",
    "Déficit de jogo e socialização",
    "Outros",
  ];

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-base font-semibold text-gray-900">Seção 2 — Resultados VB-MAPP</h2>
      <p className="text-sm text-gray-500">Selecione o nível e registre as pontuações por domínio</p>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-3">Nível VB-MAPP</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setVbmappLevel(lvl)}
              className={`p-4 rounded-xl text-left transition-all ${
                vbmappLevel === lvl
                  ? "border-2 border-indigo-600 bg-indigo-50"
                  : "border border-gray-200 hover:border-indigo-300 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                  vbmappLevel === lvl ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"
                }`}>{lvl}</span>
                <span className="font-semibold text-sm text-gray-900">Nível {lvl}</span>
              </div>
              <p className="text-xs text-gray-500">{levelHint[lvl]}</p>
            </button>
          ))}
        </div>
      </div>

      {vbmappLevel && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-3">
            Pontuação por domínio — Nível {vbmappLevel}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(VBMAPP_DOMAINS_LABELS).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{label}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={VBMAPP_DOMAIN_MAX[key] ?? 10}
                    value={vbmappDomains[key] ?? ""}
                    onChange={(e) => setVbmappDomains({ ...vbmappDomains, [key]: Number(e.target.value) })}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">/{VBMAPP_DOMAIN_MAX[key] ?? 10}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Barreiras identificadas</label>
        <div className="flex flex-col gap-3">
          {BARRIER_OPTIONS.map((opt) => {
            const existing = barriers.find((b) => b.barrier === opt);
            return (
              <div key={opt}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`barrier-${opt}`}
                    checked={!!existing}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBarriers([...barriers, { barrier: opt, description: "" }]);
                      } else {
                        setBarriers(barriers.filter((b) => b.barrier !== opt));
                      }
                    }}
                    className="rounded"
                  />
                  <label htmlFor={`barrier-${opt}`} className="text-sm text-gray-700">{opt}</label>
                </div>
                {existing && (
                  <textarea
                    value={existing.description}
                    onChange={(e) =>
                      setBarriers(barriers.map((b) => b.barrier === opt ? { ...b, description: e.target.value } : b))
                    }
                    placeholder="Descreva a manifestação específica observada..."
                    rows={2}
                    className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none ml-6"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Seção 3 — Perfil funcional ───────────────────────────────────────────────
function Section3({ functionalProfile, setFunctionalProfile }: {
  functionalProfile: Record<string, string>;
  setFunctionalProfile: (v: Record<string, string>) => void;
}) {
  const COMM_OPTIONS = ["Fala com frases", "Palavras soltas", "CAA", "PECS", "Não verbal", "Outro"];
  const SENSORY_OPTIONS = ["Hipersensibilidade tátil", "Hipersensibilidade auditiva", "Hipersensibilidade visual", "Hipossensibilidade vestibular", "Busca sensorial intensa", "Outro"];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-900">Seção 3 — Perfil funcional</h2>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Comunicação</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {COMM_OPTIONS.map((opt) => (
            <button key={opt}
              onClick={() => setFunctionalProfile({ ...functionalProfile, comunicacao: opt })}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                functionalProfile.comunicacao === opt ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {opt}
            </button>
          ))}
        </div>
        <textarea
          value={functionalProfile.comunicacao_obs ?? ""}
          onChange={(e) => setFunctionalProfile({ ...functionalProfile, comunicacao_obs: e.target.value })}
          placeholder="Observações sobre comunicação..."
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Sensibilidades sensoriais</label>
        <div className="flex flex-wrap gap-2">
          {SENSORY_OPTIONS.map((opt) => {
            const selected = (functionalProfile.sensibilidades_arr ?? "").split(",").includes(opt);
            return (
              <button key={opt}
                onClick={() => {
                  const arr = (functionalProfile.sensibilidades_arr ?? "").split(",").filter(Boolean);
                  const updated = selected ? arr.filter((s) => s !== opt) : [...arr, opt];
                  setFunctionalProfile({ ...functionalProfile, sensibilidades_arr: updated.join(",") });
                }}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  selected ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Autonomia nas AVDs</label>
        <textarea
          value={functionalProfile.autonomia_avds ?? ""}
          onChange={(e) => setFunctionalProfile({ ...functionalProfile, autonomia_avds: e.target.value })}
          placeholder="Descreva o nível de autonomia nas atividades de vida diária..."
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Interesses e reforçadores identificados</label>
        <textarea
          value={functionalProfile.interesses ?? ""}
          onChange={(e) => setFunctionalProfile({ ...functionalProfile, interesses: e.target.value })}
          placeholder="Interesses, brinquedos, atividades preferidas..."
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
        />
      </div>
    </div>
  );
}

// ─── Seção 4 — Comportamentos-desafio ────────────────────────────────────────
function Section4({ behaviorChallenges, setBehaviorChallenges, fbaConducted, setFbaConducted, entry }: {
  behaviorChallenges: BehaviorChallenge[];
  setBehaviorChallenges: (v: BehaviorChallenge[]) => void;
  fbaConducted: boolean;
  setFbaConducted: (v: boolean) => void;
  entry: { factor_b?: Record<string, unknown> } | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-900">Seção 4 — Comportamentos-desafio</h2>

      {entry?.factor_b && (
        <div className="p-3 rounded-lg text-sm"
          style={{ background: "#EDE9FE", border: "0.5px solid #7C3AED" }}>
          Pré-preenchido do Form 1. Confirme, detalhe ou corrija abaixo.
        </div>
      )}

      {behaviorChallenges.map((bc, i) => (
        <div key={i} className="p-4 rounded-xl flex flex-col gap-3" style={{ border: "0.5px solid #E5E7EB" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Comportamento {i + 1}</span>
            <button onClick={() => setBehaviorChallenges(behaviorChallenges.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
          <textarea
            value={bc.descricao}
            onChange={(e) => {
              const u = [...behaviorChallenges]; u[i] = { ...u[i], descricao: e.target.value };
              setBehaviorChallenges(u);
            }}
            placeholder="Descreva o comportamento..."
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Função</label>
            <div className="flex flex-wrap gap-2">
              {BEHAVIOR_FUNCTIONS.map((fn) => (
                <button key={fn}
                  onClick={() => { const u = [...behaviorChallenges]; u[i] = { ...u[i], funcao: fn }; setBehaviorChallenges(u); }}
                  className={`px-2 py-1 rounded-full text-xs transition-colors ${
                    bc.funcao === fn ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
                  {fn}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={bc.estrategias}
            onChange={(e) => {
              const u = [...behaviorChallenges]; u[i] = { ...u[i], estrategias: e.target.value };
              setBehaviorChallenges(u);
            }}
            placeholder="Estratégias de manejo recomendadas..."
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>
      ))}

      <button
        onClick={() => setBehaviorChallenges([...behaviorChallenges, { descricao: "", funcao: "", estrategias: "" }])}
        className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
      >
        <Plus size={13} /> Adicionar comportamento
      </button>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="fba"
          checked={fbaConducted}
          onChange={(e) => setFbaConducted(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="fba" className="text-sm text-gray-700">FBA (Avaliação Funcional do Comportamento) foi realizado</label>
      </div>
    </div>
  );
}

// ─── Seção 5 — Recomendação ───────────────────────────────────────────────────
function Section5({
  recommendedModality, setRecommendedModality, recommendedHours, setRecommendedHours,
  justification, setJustification, sessionsPerWeek, setSessionsPerWeek,
  sessionDuration, setSessionDuration, vbmappLevel,
}: {
  recommendedModality: string[];
  setRecommendedModality: (v: string[]) => void;
  recommendedHours: number | "";
  setRecommendedHours: (v: number | "") => void;
  justification: string;
  setJustification: (v: string) => void;
  sessionsPerWeek: number | "";
  setSessionsPerWeek: (v: number | "") => void;
  sessionDuration: number;
  setSessionDuration: (v: number) => void;
  vbmappLevel: number | null;
}) {
  const hourHints: Record<number, string> = {
    1: "Recomendado: 25–40h/semana (Lovaas 1987)",
    2: "Recomendado: 20–30h/semana (Linstead 2017)",
    3: "Recomendado: 10–25h/semana (BACB Guidelines)",
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-900">Seção 5 — Recomendação terapêutica</h2>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-3">Modalidade indicada</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {RECOMMENDED_MODALITIES.map((m) => (
            <button key={m.value}
              onClick={() => setRecommendedModality(
                recommendedModality.includes(m.value)
                  ? recommendedModality.filter((v) => v !== m.value)
                  : [...recommendedModality, m.value]
              )}
              className={`p-4 rounded-xl border text-sm font-medium transition-all ${
                recommendedModality.includes(m.value)
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 text-gray-600 hover:border-indigo-300"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Horas/semana</label>
          {vbmappLevel && (
            <p className="text-xs text-gray-400 mb-1">{hourHints[vbmappLevel]}</p>
          )}
          <input
            type="number"
            min={1}
            max={80}
            value={recommendedHours}
            onChange={(e) => setRecommendedHours(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Ex: 20"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Sessões/semana</label>
          <input
            type="number"
            min={1}
            max={20}
            value={sessionsPerWeek}
            onChange={(e) => setSessionsPerWeek(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="Ex: 5"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Duração da sessão (min)</label>
          <select
            value={sessionDuration}
            onChange={(e) => setSessionDuration(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {[30, 45, 60, 75, 90, 120].map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Justificativa clínica
          <span className={`ml-2 text-xs ${justification.length >= 100 ? "text-green-600" : "text-red-400"}`}>
            ({justification.length}/100 mínimo)
          </span>
        </label>
        <textarea
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          rows={5}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
          placeholder="Descreva a justificativa clínica para a recomendação (mínimo 100 caracteres — compõe o relatório para convênio)..."
        />
        {justification.length > 0 && justification.length < 100 && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertTriangle size={11} /> Mínimo de 100 caracteres necessário para finalizar o relatório.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Seção 6 — Plano inicial ──────────────────────────────────────────────────
function Section6({ goals, setGoals }: {
  goals: EvaluationGoalData[];
  setGoals: (v: EvaluationGoalData[]) => void;
}) {
  const DOMAINS = [
    "Mando", "Tato", "Ouvinte", "Imitação", "Jogo e socialização",
    "Comportamento-desafio", "AVDs", "Comunicação aumentativa", "Outro",
  ];

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-gray-900">Seção 6 — Plano terapêutico inicial</h2>
      <p className="text-sm text-gray-500">Top 3–5 metas prioritárias para o primeiro ciclo</p>

      {goals.map((goal, i) => (
        <div key={i} className="p-4 rounded-xl flex flex-col gap-3" style={{ border: "0.5px solid #E5E7EB" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Meta {i + 1}</span>
            {i > 0 && (
              <button onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Domínio</label>
              <select
                value={goal.domain}
                onChange={(e) => { const u = [...goals]; u[i] = { ...u[i], domain: e.target.value }; setGoals(u); }}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="">Selecionar...</option>
                {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Objetivo</label>
              <input
                value={goal.objective}
                onChange={(e) => { const u = [...goals]; u[i] = { ...u[i], objective: e.target.value }; setGoals(u); }}
                placeholder="Ex: Solicitar 10 itens preferidos..."
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Critério de maestria</label>
            <input
              value={goal.mastery_criterion}
              onChange={(e) => { const u = [...goals]; u[i] = { ...u[i], mastery_criterion: e.target.value }; setGoals(u); }}
              placeholder="Ex: 80% em 3 sessões consecutivas"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      ))}

      {goals.length < 5 && (
        <button
          onClick={() => setGoals([...goals, { domain: "", objective: "", mastery_criterion: "" }])}
          className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
        >
          <Plus size={13} /> Adicionar meta
        </button>
      )}
    </div>
  );
}

// ─── Botão enviar Form 3 ──────────────────────────────────────────────────────
function SendForm3Button({
  clinicId,
  queueEntryId,
  responsavelEmail,
  childName,
}: {
  clinicId: string;
  queueEntryId: string;
  responsavelEmail?: string;
  childName?: string;
}) {
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sendForm3 = useServerFn(sendForm3Server);

  const mutation = useMutation({
    mutationFn: async () =>
      sendForm3({ data: { clinicId, queueEntryId }, headers: await authHeaders() }),
    onSuccess: (res) => {
      if (!res.ok) { toast.error(res.error || "Erro ao gerar link"); return; }
      setSent(true);
      setToken(res.token);
    },
    onError: () => toast.error("Erro ao gerar link do Form 3"),
  });

  const formUrl = token ? `${window.location.origin}/cadastro-completo/${token}` : null;

  const copyLink = () => {
    if (formUrl) {
      navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const sendByEmail = () => {
    if (!formUrl || !responsavelEmail) return;
    const name = childName ?? "seu filho(a)";
    const subject = encodeURIComponent(`TEAmo — Cadastro completo de ${name}`);
    const body = encodeURIComponent(
      `Olá!\n\nA avaliação de ${name} foi concluída. Por favor, acesse o link abaixo para preencher o cadastro completo:\n\n${formUrl}\n\nAtenciosamente,\nEquipe da Clínica`
    );
    window.open(`mailto:${responsavelEmail}?subject=${subject}&body=${body}`);
  };

  if (sent && formUrl) {
    return (
      <div className="flex flex-col gap-2 items-end">
        <input
          readOnly
          value={formUrl}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 w-64 font-mono"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ background: copied ? "#DCFCE7" : "#EDE9FE", color: copied ? "#16A34A" : "#7C3AED" }}
          >
            {copied ? <CheckCircle2 size={12} /> : <FileText size={12} />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
          {responsavelEmail && (
            <button
              onClick={sendByEmail}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-700"
              style={{ background: "#EEF2FF", border: "1px solid #C7D2FE" }}
            >
              <Send size={12} />
              Enviar por e-mail
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
      style={{ background: "#4F46E5" }}
    >
      {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      Enviar Form 3 para família
    </button>
  );
}
