import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Loader2, Plus, Trash2, Eye, EyeOff, Lock,
  CheckSquare, Square, Home, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useSaveSessionRecord, useGetSessionRecord } from "@/services/therapist.service";
import {
  ENGAGEMENT_LEVELS,
  ENGAGEMENT_LEVEL_LABELS,
  NOTABLE_BEHAVIOR_TYPES,
  NOTABLE_BEHAVIOR_TYPE_LABELS,
  type EngagementLevel,
  type NotableBehaviorType,
  type SessionRecordInput,
} from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/agenda/sessao/$eventId/registro")({
  head: () => ({
    meta: [{ title: "Registro de sessão — TEAmo" }],
  }),
  component: SessionRecordPage,
});

interface NotableBehavior {
  id: string;
  description: string;
  type: NotableBehaviorType;
}

interface GoalItem {
  goal: string;
  achieved: boolean;
}

// ─── Preview sheet para os pais ───────────────────────────────────────────────

function ParentPreviewSheet({
  open,
  onClose,
  onPublish,
  childName,
  familyInstruction,
  frequencySuggestion,
  clinicalObservations,
  isPrivate,
  objectives,
  planVisible,
  publishing,
}: {
  open: boolean;
  onClose: () => void;
  onPublish: () => void;
  childName: string;
  familyInstruction: string;
  frequencySuggestion: string;
  clinicalObservations: string;
  isPrivate: boolean;
  objectives: string;
  planVisible: boolean;
  publishing: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-[#0F172A]/50"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[500px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Preview</p>
            <h2 className="text-[16px] font-bold text-[#0F172A]">Como os responsáveis verão</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors">
            <X size={18} color="#6B7280" />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">
          {/* Plano da sessão */}
          {planVisible && objectives && (
            <div className="rounded-[14px] border p-4" style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: TEAL }}>
                Plano da sessão
              </p>
              <p className="text-sm text-[#374151] leading-relaxed">{objectives}</p>
            </div>
          )}

          {/* Observações compartilhadas */}
          {!isPrivate && clinicalObservations && (
            <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-white">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">
                Observações da sessão
              </p>
              <p className="text-sm text-[#374151] leading-relaxed">{clinicalObservations}</p>
            </div>
          )}
          {isPrivate && (
            <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-[#FAFAFA] flex items-center gap-3">
              <EyeOff size={16} color="#9CA3AF" />
              <p className="text-sm text-[#9CA3AF] italic">Observações clínicas (privadas — não visíveis)</p>
            </div>
          )}

          {/* Instrução para família */}
          {familyInstruction && (
            <div className="rounded-[14px] border-2 p-4" style={{ borderColor: TEAL_BORDER, background: "#ECFDF5" }}>
              <div className="flex items-center gap-2 mb-2">
                <Home size={14} color={TEAL} />
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: TEAL }}>
                  Para praticar em casa
                </p>
              </div>
              <p className="text-sm text-[#374151] leading-relaxed">{familyInstruction}</p>
              {frequencySuggestion && (
                <p className="mt-2 text-xs font-medium" style={{ color: TEAL }}>
                  Frequência: {frequencySuggestion}
                </p>
              )}
            </div>
          )}
          {!familyInstruction && (
            <div className="rounded-[14px] border border-[#E5E7EB] p-4 bg-[#FAFAFA] flex items-center gap-3">
              <Home size={16} color="#D1D5DB" />
              <p className="text-sm text-[#9CA3AF] italic">Nenhuma instrução para casa definida</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F8FAFC] transition-colors"
          >
            Voltar e editar
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing}
            className="flex-1 h-11 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-60"
            style={{ background: TEAL }}
          >
            {publishing ? <Loader2 size={15} className="animate-spin mx-auto" /> : "Confirmar e publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bloco de seção ────────────────────────────────────────────────────────────

function SectionBlock({
  number,
  title,
  subtitle,
  badge,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: TEAL }}
        >
          {number}
        </span>
        <h2 className="text-[16px] font-bold text-[#0F172A]">{title}</h2>
        {badge}
      </div>
      {subtitle && <p className="text-xs text-[#9CA3AF] mb-3 -mt-2 ml-8">{subtitle}</p>}
      {children}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

function SessionRecordPage() {
  const navigate = useNavigate();
  const { eventId } = Route.useParams();
  const saveRecord = useSaveSessionRecord();
  const { data, isLoading } = useGetSessionRecord(eventId);

  // ─── Estado dos 4 blocos ──────────────────────────────────────────────────
  // Bloco 1
  const [goalsChecklist, setGoalsChecklist] = useState<GoalItem[]>([]);
  const [whatWasDone, setWhatWasDone] = useState("");
  const [engagementLevel, setEngagementLevel] = useState<EngagementLevel | undefined>();
  // Bloco 2
  const [clinicalObservations, setClinicalObservations] = useState("");
  const [notableBehaviors, setNotableBehaviors] = useState<NotableBehavior[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  // Bloco 3
  const [familyInstruction, setFamilyInstruction] = useState("");
  const [frequencySuggestion, setFrequencySuggestion] = useState("");
  // Bloco 4
  const [pointsToContinue, setPointsToContinue] = useState("");
  const [approachAdjustment, setApproachAdjustment] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const event = data?.event as any;
  const child = data?.child as any;
  const existing = data?.sessionRecord as any;

  // Pré-preenche dados existentes (rascunho)
  useEffect(() => {
    if (!data || initialized) return;
    setInitialized(true);

    // Gera checklist a partir dos objetivos do plano
    const plan = event?.session_plan ?? {};
    const planObjectives: string = plan.objectives ?? "";
    const prevPoints: string = data.previousPoints as string ?? plan.objectives_from_previous ?? "";

    if (existing) {
      // Carrega rascunho existente
      setGoalsChecklist(existing.goals_achieved ?? []);
      setWhatWasDone(existing.what_was_done ?? "");
      setEngagementLevel(existing.engagement_level ?? undefined);
      setClinicalObservations(existing.clinical_observations ?? "");
      setNotableBehaviors(
        (existing.notable_behaviors ?? []).map((b: any) => ({ id: crypto.randomUUID(), ...b }))
      );
      setIsPrivate(existing.is_private ?? false);
      setFamilyInstruction(existing.family_instruction ?? "");
      setFrequencySuggestion(existing.frequency_suggestion ?? "");
      setPointsToContinue(existing.points_to_continue ?? "");
      setApproachAdjustment(existing.approach_adjustment ?? "");
    } else if (planObjectives) {
      // Cria checklist inicial a partir dos objetivos do plano
      const items = planObjectives
        .split("\n")
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map((goal: string) => ({ goal, achieved: false }));
      setGoalsChecklist(items.length > 0 ? items : []);

      // Pré-preenche pontos a continuar se houver sessão anterior
      if (prevPoints) setPointsToContinue(prevPoints);
    }
  }, [data, initialized, event, existing]);

  const addBehavior = () =>
    setNotableBehaviors((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", type: "conquista" },
    ]);

  const removeBehavior = (id: string) =>
    setNotableBehaviors((prev) => prev.filter((b) => b.id !== id));

  const updateBehavior = (id: string, field: keyof Omit<NotableBehavior, "id">, value: string) =>
    setNotableBehaviors((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );

  const toggleGoal = (i: number) =>
    setGoalsChecklist((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, achieved: !g.achieved } : g))
    );

  const buildPayload = (isDraft: boolean): SessionRecordInput => ({
    eventId,
    goalsAchieved: goalsChecklist.length > 0 ? goalsChecklist : undefined,
    whatWasDone: whatWasDone.trim() || undefined,
    engagementLevel,
    clinicalObservations: clinicalObservations.trim() || undefined,
    notableBehaviors:
      notableBehaviors.filter((b) => b.description.trim()).length > 0
        ? notableBehaviors
            .filter((b) => b.description.trim())
            .map(({ description, type }) => ({ description, type }))
        : undefined,
    isPrivate,
    familyInstruction: familyInstruction.trim() || undefined,
    frequencySuggestion: frequencySuggestion.trim() || undefined,
    pointsToContinue: pointsToContinue.trim() || undefined,
    approachAdjustment: approachAdjustment.trim() || undefined,
    isDraft,
  });

  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      await saveRecord.mutateAsync(buildPayload(true));
      toast.success("Rascunho salvo.");
      navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar rascunho.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    setSubmitting(true);
    try {
      await saveRecord.mutateAsync(buildPayload(false));
      toast.success("Registro publicado! Os responsáveis já podem ver.");
      setPreviewOpen(false);
      navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar registro.");
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell hideMenu onBack={() => navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any })}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin" color={TEAL} />
        </div>
      </AppShell>
    );
  }

  const sessionDate = event?.start_at
    ? new Date(event.start_at).toLocaleDateString("pt-BR", {
        weekday: "short", day: "numeric", month: "short",
      })
    : "";

  return (
    <>
      <AppShell hideMenu onBack={() => navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any })}>
        <div className="mx-auto max-w-[540px] px-4 py-6 pb-28">
          {/* Header */}
          <div
            className="rounded-[16px] border px-4 py-4 mb-6"
            style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1">
              Registro de sessão
            </p>
            <h1 className="text-[20px] font-extrabold text-[#0F172A]">
              {child?.name ?? event?.title ?? "Sessão"}
            </h1>
            <p className="text-sm text-[#6B7280] mt-0.5">{sessionDate}</p>
          </div>

          {/* ═══ Bloco 1 — O que foi trabalhado ═══ */}
          <SectionBlock number={1} title="O que foi trabalhado">
            {/* Checklist de objetivos */}
            {goalsChecklist.length > 0 && (
              <div className="mb-4 rounded-[14px] border border-[#E5E7EB] divide-y divide-[#F1F5F9] overflow-hidden">
                {goalsChecklist.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleGoal(i)}
                    className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-[#FAFAFA] transition-colors"
                  >
                    {item.achieved ? (
                      <CheckSquare size={18} color={TEAL} strokeWidth={1.8} className="flex-shrink-0" />
                    ) : (
                      <Square size={18} color="#D1D5DB" strokeWidth={1.8} className="flex-shrink-0" />
                    )}
                    <span
                      className="text-sm"
                      style={{
                        color: item.achieved ? TEAL : "#374151",
                        textDecoration: item.achieved ? "line-through" : "none",
                      }}
                    >
                      {item.goal}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* O que foi feito */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                O que foi efetivamente feito
              </label>
              <textarea
                rows={3}
                placeholder="Descreva o que aconteceu na sessão…"
                value={whatWasDone}
                onChange={(e) => setWhatWasDone(e.target.value.slice(0, 2000))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
              <p className="mt-1 text-right text-xs text-[#9CA3AF]">{whatWasDone.length}/2000</p>
            </div>

            {/* Engajamento */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-2">
                Nível de engajamento
              </label>
              <div className="flex gap-2">
                {ENGAGEMENT_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setEngagementLevel(engagementLevel === level ? undefined : level)}
                    className="flex-1 rounded-xl border-2 py-2 text-sm font-medium transition-all"
                    style={
                      engagementLevel === level
                        ? {
                            borderColor: level === "alto" ? "#16A34A" : level === "medio" ? "#D97706" : "#DC2626",
                            background: level === "alto" ? "#F0FDF4" : level === "medio" ? "#FEF3C7" : "#FEF2F2",
                            color: level === "alto" ? "#16A34A" : level === "medio" ? "#D97706" : "#DC2626",
                          }
                        : { borderColor: "#E5E7EB", background: "white", color: "#374151" }
                    }
                  >
                    {ENGAGEMENT_LEVEL_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>
          </SectionBlock>

          {/* ═══ Bloco 2 — Observações clínicas ═══ */}
          <SectionBlock
            number={2}
            title="Observações clínicas"
            badge={
              <button
                type="button"
                onClick={() => setIsPrivate((v) => !v)}
                className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors"
                style={
                  isPrivate
                    ? { background: "#F1F5F9", borderColor: "#CBD5E1", color: "#475569" }
                    : { background: TEAL_SOFT, borderColor: TEAL_BORDER, color: TEAL }
                }
              >
                {isPrivate ? <Lock size={11} /> : <Eye size={11} />}
                {isPrivate ? "Privado" : "Compartilhado"}
              </button>
            }
            subtitle={isPrivate ? "Só você verá estas observações" : "Visível para os responsáveis"}
          >
            <div className="mb-4">
              <textarea
                rows={4}
                placeholder="Observações gerais da sessão…"
                value={clinicalObservations}
                onChange={(e) => setClinicalObservations(e.target.value.slice(0, 3000))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
              <p className="mt-1 text-right text-xs text-[#9CA3AF]">{clinicalObservations.length}/3000</p>
            </div>

            {/* Comportamentos notáveis */}
            {notableBehaviors.length > 0 && (
              <div className="flex flex-col gap-3 mb-3">
                {notableBehaviors.map((b) => (
                  <div key={b.id} className="rounded-xl border border-[#E5E7EB] p-3">
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Descreva o comportamento…"
                        value={b.description}
                        onChange={(e) => updateBehavior(b.id, "description", e.target.value.slice(0, 300))}
                        className="h-9 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                      />
                      <button
                        type="button"
                        onClick={() => removeBehavior(b.id)}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {NOTABLE_BEHAVIOR_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateBehavior(b.id, "type", type)}
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all"
                          style={
                            b.type === type
                              ? { background: TEAL, borderColor: TEAL, color: "white" }
                              : { background: TEAL_SOFT, borderColor: TEAL_BORDER, color: "#374151" }
                          }
                        >
                          {NOTABLE_BEHAVIOR_TYPE_LABELS[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addBehavior}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
              style={{ color: TEAL }}
            >
              <Plus size={14} strokeWidth={2.5} />
              Adicionar comportamento notável
            </button>
          </SectionBlock>

          {/* ═══ Bloco 3 — Instrução para família ═══ */}
          <SectionBlock
            number={3}
            title="Instrução para família"
            badge={
              <span className="ml-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-[#ECFDF5] text-[#16A34A] border border-[#BBF7D0]">
                <Home size={10} />
                Sempre visível
              </span>
            }
            subtitle="Os responsáveis sempre veem este bloco"
          >
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                O que praticar em casa
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Praticar a imitação de sons frente ao espelho…"
                value={familyInstruction}
                onChange={(e) => setFamilyInstruction(e.target.value.slice(0, 2000))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Frequência sugerida{" "}
                <span className="text-[#9CA3AF] font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 2x ao dia por 5 minutos"
                value={frequencySuggestion}
                onChange={(e) => setFrequencySuggestion(e.target.value.slice(0, 200))}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </SectionBlock>

          {/* ═══ Bloco 4 — Próxima sessão ═══ */}
          <SectionBlock number={4} title="Próxima sessão">
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Pontos a continuar
              </label>
              <textarea
                rows={3}
                placeholder="O que ficou pendente ou deve ser retomado…"
                value={pointsToContinue}
                onChange={(e) => setPointsToContinue(e.target.value.slice(0, 1000))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            <div className="mb-3">
              <label className="block text-sm font-medium text-[#374151] mb-1 flex items-center gap-1.5">
                Ajuste de abordagem
                <span className="flex items-center gap-0.5 text-[11px] font-normal text-[#9CA3AF]">
                  <Lock size={10} /> privado
                </span>
              </label>
              <textarea
                rows={2}
                placeholder="Mudanças de estratégia para as próximas sessões…"
                value={approachAdjustment}
                onChange={(e) => setApproachAdjustment(e.target.value.slice(0, 1000))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            <div
              className="rounded-xl border p-3 flex items-center gap-2 text-xs text-[#6B7280]"
              style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
            >
              <ChevronRight size={13} color={TEAL} />
              Estes pontos serão sugeridos automaticamente no plano da próxima sessão com este paciente.
            </div>
          </SectionBlock>
        </div>
      </AppShell>

      {/* Rodapé fixo */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E5E7EB] bg-white px-4 py-3">
        <div className="mx-auto max-w-[540px] flex gap-3">
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F8FAFC] disabled:opacity-60 transition-colors"
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-px disabled:opacity-60"
            style={{ background: TEAL }}
          >
            Publicar registro
          </button>
        </div>
      </div>

      {/* Preview sheet */}
      <ParentPreviewSheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onPublish={() => void handlePublish()}
        childName={child?.name ?? "Paciente"}
        familyInstruction={familyInstruction}
        frequencySuggestion={frequencySuggestion}
        clinicalObservations={clinicalObservations}
        isPrivate={isPrivate}
        objectives={(event?.session_plan as any)?.objectives ?? ""}
        planVisible={(event as any)?.plan_visible_to_parents ?? true}
        publishing={submitting}
      />
    </>
  );
}
