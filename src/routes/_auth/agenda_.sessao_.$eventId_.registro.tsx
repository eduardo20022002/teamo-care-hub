import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Loader2, Plus, Trash2, Eye, EyeOff, Lock,
  Home, ChevronRight, X, CheckCircle2, MinusCircle, XCircle,
  Calendar, Stethoscope, Link2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import {
  useSaveSessionRecord,
  useGetSessionRecord,
  useGetSessionRecordPrivate,
  type UpcomingSession,
} from "@/services/therapist.service";
import { useAllGoalsForChild } from "@/services/milestones.service";
import { MILESTONE_AREA_COLORS } from "@/lib/validation";
import {
  NOTABLE_BEHAVIOR_TYPES,
  NOTABLE_BEHAVIOR_TYPE_LABELS,
  GOAL_STATUSES,
  GOAL_STATUS_LABELS,
  type GoalStatus,
  type NotableBehaviorType,
  type SessionRecordInput,
} from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/agenda_/sessao_/$eventId_/registro")({
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
  status: GoalStatus | null;
  notes: string;
  milestoneGoalIds: string[];
}

interface ProfObservation {
  id: string;
  professionalName: string;
  notes: string;
}

// Estilos por status de objetivo
const GOAL_STATUS_STYLE: Record<GoalStatus, { color: string; bg: string; border: string }> = {
  achieved:     { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  partial:      { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  not_achieved: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

const GOAL_STATUS_ICON: Record<GoalStatus, typeof CheckCircle2> = {
  achieved:     CheckCircle2,
  partial:      MinusCircle,
  not_achieved: XCircle,
};

function formatSessionLabel(s: UpcomingSession): string {
  const d = new Date(s.start_at);
  const date = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

// ─── Sheet de seleção de próxima sessão ───────────────────────────────────────

function SessionPickerSheet({
  open,
  onClose,
  sessions,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  sessions: UpcomingSession[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[#0F172A]/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[500px] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] bg-white rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-[16px] font-bold text-[#0F172A]">Escolha a sessão</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-[#F1F5F9] transition-colors">
            <X size={18} color="#6B7280" />
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-2">
          {sessions.map((s) => {
            const sel = s.id === selectedId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { onSelect(s.id); onClose(); }}
                className="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:bg-[#F8FAFC]"
                style={sel ? { borderColor: TEAL, background: TEAL_SOFT } : { borderColor: "#E5E7EB" }}
              >
                <Calendar size={16} color={sel ? TEAL : "#9CA3AF"} />
                <span className="flex-1 text-sm font-medium text-[#0F172A]">{formatSessionLabel(s)}</span>
                {sel && <CheckCircle2 size={16} color={TEAL} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  const privateQuery = useGetSessionRecordPrivate(eventId);

  // ─── Estado dos 4 blocos ──────────────────────────────────────────────────
  // Bloco 1
  const [goalsChecklist, setGoalsChecklist] = useState<GoalItem[]>([]);
  const [whatWasDone, setWhatWasDone] = useState("");
  // Bloco 2
  const [clinicalObservations, setClinicalObservations] = useState("");
  const [notableBehaviors, setNotableBehaviors] = useState<NotableBehavior[]>([]);
  const [profObservations, setProfObservations] = useState<ProfObservation[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  // Bloco 3
  const [familyInstruction, setFamilyInstruction] = useState("");
  const [frequencySuggestion, setFrequencySuggestion] = useState("");
  // Bloco 4
  const [pointsToContinue, setPointsToContinue] = useState("");
  const [approachAdjustment, setApproachAdjustment] = useState("");
  const [nextSessionEventId, setNextSessionEventId] = useState<string | undefined>();
  const [sessionPickerOpen, setSessionPickerOpen] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const event = data?.event as any;
  const child = data?.child as any;
  const existing = data?.sessionRecord as any;
  const upcomingSessions: UpcomingSession[] = data?.upcomingSessions ?? [];

  const allGoalsQuery = useAllGoalsForChild(child?.id as string | undefined);
  const goalMap: Record<string, { goalTitle: string; milestoneTitle: string; milestoneArea: string }> =
    Object.fromEntries(
      (allGoalsQuery.data ?? []).map((g) => [
        g.goalId,
        { goalTitle: g.goalTitle, milestoneTitle: g.milestoneTitle, milestoneArea: g.milestoneArea },
      ])
    );
  const selectedNextSession = upcomingSessions.find((s) => s.id === nextSessionEventId);

  // Pré-preenche dados existentes (rascunho).
  // Aguarda tanto os dados gerais quanto os campos privados (approach_adjustment,
  // professional_observations) que chegam via getSessionRecordPrivateServer.
  useEffect(() => {
    if (!data || !privateQuery.isSuccess || initialized) return;
    setInitialized(true);

    const privateRec = privateQuery.data?.ok ? privateQuery.data : null;

    // Objetivos específicos do plano (fallback: objetivo geral quebrado por linhas)
    const plan = event?.session_plan ?? {};
    const planSpecific: string[] = Array.isArray(plan.specific_objectives)
      ? plan.specific_objectives.filter((s: string) => s && s.trim())
      : [];
    const planObjectives: string = plan.objectives ?? "";
    const prevPoints: string = data.previousPoints as string ?? plan.objectives_from_previous ?? "";

    // Normaliza um item de goals_achieved para o shape atual
    const normalizeGoal = (g: any): GoalItem => {
      let ids: string[] = [];
      if (Array.isArray(g?.milestoneGoalIds)) ids = g.milestoneGoalIds.filter(Boolean);
      else if (typeof g?.milestoneGoalId === "string" && g.milestoneGoalId) ids = [g.milestoneGoalId];

      if (g && typeof g.status === "string") {
        return { goal: g.goal ?? "", status: g.status as GoalStatus, notes: g.notes ?? "", milestoneGoalIds: ids };
      }
      return { goal: g?.goal ?? "", status: g?.achieved ? "achieved" : null, notes: "", milestoneGoalIds: ids };
    };

    if (existing) {
      // Carrega rascunho existente
      const savedGoals: GoalItem[] = (existing.goals_achieved ?? []).map(normalizeGoal);
      // Se o plano ganhou objetivos específicos novos que não estão no rascunho, anexa
      const savedTexts = new Set(savedGoals.map((g) => g.goal));
      const extra = planSpecific
        .filter((s) => !savedTexts.has(s))
        .map((goal): GoalItem => ({ goal, status: null, notes: "", milestoneGoalIds: [] }));
      setGoalsChecklist([...savedGoals, ...extra]);

      setWhatWasDone(existing.what_was_done ?? "");
      setClinicalObservations(existing.clinical_observations ?? "");
      setNotableBehaviors(
        (existing.notable_behaviors ?? []).map((b: any) => ({ id: crypto.randomUUID(), ...b }))
      );
      setProfObservations(
        ((privateRec?.professionalObservations ?? []) as any[]).map((p: any) => ({
          id: crypto.randomUUID(),
          professionalName: p.professional_name ?? p.professionalName ?? "",
          notes: p.notes ?? "",
        }))
      );
      setIsPrivate(existing.is_private ?? false);
      setFamilyInstruction(existing.family_instruction ?? "");
      setFrequencySuggestion(existing.frequency_suggestion ?? "");
      setPointsToContinue(existing.points_to_continue ?? "");
      setApproachAdjustment(privateRec?.approachAdjustment ?? "");
      setNextSessionEventId(existing.next_session_event_id ?? undefined);
    } else {
      // Cria checklist inicial a partir dos objetivos específicos do plano
      const sourceGoals = planSpecific.length > 0
        ? planSpecific
        : planObjectives.split("\n").map((l: string) => l.trim()).filter(Boolean);
      // Suporta novo shape (string[][]) e antigo (string|null)[]
      const rawIds: any[] = Array.isArray(plan.objective_goal_ids) ? plan.objective_goal_ids : [];
      const planGoalIds: string[][] = rawIds.map((v) => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof v === "string" && v) return [v];
        return [];
      });
      setGoalsChecklist(
        sourceGoals.map((goal: string, i: number): GoalItem => ({
          goal,
          status: null,
          notes: "",
          milestoneGoalIds: planGoalIds[i] ?? [],
        }))
      );

      // Pré-preenche pontos a continuar se houver sessão anterior
      if (prevPoints) setPointsToContinue(prevPoints);
    }
  }, [data, privateQuery.isSuccess, initialized, event, existing]);

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

  const setGoalStatus = (i: number, status: GoalStatus) =>
    setGoalsChecklist((prev) =>
      prev.map((g, idx) =>
        idx === i ? { ...g, status: g.status === status ? null : status } : g
      )
    );

  const updateGoalNotes = (i: number, notes: string) =>
    setGoalsChecklist((prev) =>
      prev.map((g, idx) => (idx === i ? { ...g, notes: notes.slice(0, 500) } : g))
    );

  const addProfObservation = () =>
    setProfObservations((prev) => [
      ...prev,
      { id: crypto.randomUUID(), professionalName: "", notes: "" },
    ]);

  const removeProfObservation = (id: string) =>
    setProfObservations((prev) => prev.filter((p) => p.id !== id));

  const updateProfObservation = (
    id: string,
    field: "professionalName" | "notes",
    value: string,
  ) =>
    setProfObservations((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );

  const buildPayload = (isDraft: boolean): SessionRecordInput => ({
    eventId,
    goalsAchieved:
      goalsChecklist.length > 0
        ? goalsChecklist.map((g) => ({
            goal: g.goal,
            status: g.status ?? "not_achieved",
            notes: g.notes.trim() || undefined,
            // Novo shape: array de IDs; mantém milestoneGoalId (primeiro) para compat
            milestoneGoalIds: g.milestoneGoalIds.length > 0 ? g.milestoneGoalIds : undefined,
            milestoneGoalId: g.milestoneGoalIds[0] ?? undefined,
          }))
        : undefined,
    whatWasDone: whatWasDone.trim() || undefined,
    clinicalObservations: clinicalObservations.trim() || undefined,
    notableBehaviors:
      notableBehaviors.filter((b) => b.description.trim()).length > 0
        ? notableBehaviors
            .filter((b) => b.description.trim())
            .map(({ description, type }) => ({ description, type }))
        : undefined,
    professionalObservations:
      profObservations.filter((p) => p.professionalName.trim() && p.notes.trim()).length > 0
        ? profObservations
            .filter((p) => p.professionalName.trim() && p.notes.trim())
            .map((p) => ({ professionalName: p.professionalName.trim(), notes: p.notes.trim() }))
        : undefined,
    isPrivate,
    familyInstruction: familyInstruction.trim() || undefined,
    frequencySuggestion: frequencySuggestion.trim() || undefined,
    pointsToContinue: pointsToContinue.trim() || undefined,
    approachAdjustment: approachAdjustment.trim() || undefined,
    nextSessionEventId,
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
            {/* Checklist de objetivos específicos com status */}
            {goalsChecklist.length > 0 && (
              <div className="mb-4 flex flex-col gap-2.5">
                {goalsChecklist.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-[14px] border border-[#E5E7EB] p-3.5"
                  >
                    {/* Chips de metas vinculadas */}
                    {item.milestoneGoalIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {item.milestoneGoalIds.map((gid) => {
                          const gInfo = goalMap[gid];
                          if (!gInfo) return null;
                          const goalColor = MILESTONE_AREA_COLORS[gInfo.milestoneArea as keyof typeof MILESTONE_AREA_COLORS] ?? "#0D9488";
                          return (
                            <div key={gid} className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: goalColor + "15", border: `1px solid ${goalColor}44` }}>
                              <Link2 size={10} strokeWidth={2} color={goalColor} />
                              <span className="text-[10.5px] font-semibold" style={{ color: goalColor }}>
                                {gInfo.milestoneTitle} · {gInfo.goalTitle}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-sm font-medium text-[#374151] mb-2.5">{item.goal}</p>
                    <div className="flex gap-2">
                      {GOAL_STATUSES.map((status) => {
                        const sel = item.status === status;
                        const st = GOAL_STATUS_STYLE[status];
                        const Icon = GOAL_STATUS_ICON[status];
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setGoalStatus(i, status)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-[12px] font-semibold transition-all"
                            style={
                              sel
                                ? { borderColor: st.color, background: st.bg, color: st.color }
                                : { borderColor: "#E5E7EB", background: "white", color: "#9CA3AF" }
                            }
                          >
                            <Icon size={14} strokeWidth={2} />
                            {GOAL_STATUS_LABELS[status]}
                          </button>
                        );
                      })}
                    </div>
                    {/* Observação opcional por objetivo */}
                    {item.status && (
                      <input
                        type="text"
                        placeholder="Observação (opcional) — explique o motivo…"
                        value={item.notes}
                        onChange={(e) => updateGoalNotes(i, e.target.value)}
                        className="mt-2.5 h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Observações gerais */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Observações gerais
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
          </SectionBlock>

          {/* ═══ Bloco 2 — Observações clínicas ═══ */}
          <SectionBlock number={2} title="Observações clínicas">
            {/* Controle de visibilidade — bloco clicável e explícito */}
            <button
              type="button"
              onClick={() => setIsPrivate((v) => !v)}
              className="mb-4 flex w-full items-center gap-3 rounded-[14px] border-2 px-4 py-3 text-left transition-colors"
              style={
                isPrivate
                  ? { borderColor: "#CBD5E1", background: "#F8FAFC" }
                  : { borderColor: TEAL_BORDER, background: TEAL_SOFT }
              }
            >
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                style={{ background: isPrivate ? "#E2E8F0" : "white" }}
              >
                {isPrivate ? <Lock size={16} color="#475569" /> : <Eye size={16} color={TEAL} />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: isPrivate ? "#475569" : TEAL }}>
                  {isPrivate ? "Privado — só você vê" : "Compartilhado com a família"}
                </p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Toque para {isPrivate ? "compartilhar com os responsáveis" : "tornar privado"}
                </p>
              </div>
              <div
                className="flex h-6 w-11 flex-shrink-0 items-center rounded-full px-0.5 transition-colors"
                style={{ background: isPrivate ? "#CBD5E1" : TEAL }}
              >
                <div
                  className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: isPrivate ? "translateX(0)" : "translateX(20px)" }}
                />
              </div>
            </button>

            <div className="mb-4">
              <textarea
                rows={4}
                placeholder="Observações clínicas da sessão…"
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

            {/* ── Observação para outro profissional ── */}
            <div className="mt-5 pt-5 border-t border-[#F1F5F9]">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope size={15} color={TEAL} />
                <p className="text-sm font-bold text-[#0F172A]">Observação para outro profissional</p>
              </div>
              <p className="text-xs text-[#9CA3AF] mb-3">
                Direcione uma observação a outro profissional do paciente. Por ora, visível apenas para você.
              </p>

              {profObservations.length > 0 && (
                <div className="flex flex-col gap-3 mb-3">
                  {profObservations.map((p) => (
                    <div key={p.id} className="rounded-xl border border-[#E5E7EB] p-3">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Nome do profissional / especialidade"
                          value={p.professionalName}
                          onChange={(e) => updateProfObservation(p.id, "professionalName", e.target.value.slice(0, 120))}
                          className="h-9 flex-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                        />
                        <button
                          type="button"
                          onClick={() => removeProfObservation(p.id)}
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                        >
                          <Trash2 size={13} strokeWidth={1.8} />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="O que deseja comunicar a esse profissional…"
                        value={p.notes}
                        onChange={(e) => updateProfObservation(p.id, "notes", e.target.value.slice(0, 2000))}
                        className="w-full rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                      />
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={addProfObservation}
                className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                style={{ color: TEAL }}
              >
                <Plus size={14} strokeWidth={2.5} />
                Adicionar observação para profissional
              </button>
            </div>
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

            {/* Vincular a uma sessão específica */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Vincular a uma sessão
              </label>
              {selectedNextSession ? (
                <div
                  className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
                >
                  <Calendar size={15} color={TEAL} />
                  <span className="flex-1 text-sm font-medium text-[#0F172A]">
                    {formatSessionLabel(selectedNextSession)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNextSessionEventId(undefined)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                    aria-label="Desvincular sessão"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => upcomingSessions.length > 0 ? setSessionPickerOpen(true) : toast.message("Nenhuma sessão futura agendada para este paciente.")}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[#F8FAFC]"
                  style={{ borderColor: "#CBD5E1", color: "#6B7280" }}
                >
                  <Calendar size={15} color="#9CA3AF" />
                  Escolher sessão (opcional)
                </button>
              )}
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
              {selectedNextSession
                ? "Estes pontos serão sugeridos no plano da sessão escolhida acima."
                : "Estes pontos serão sugeridos automaticamente no plano da próxima sessão com este paciente."}
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

      {/* Seletor de próxima sessão */}
      <SessionPickerSheet
        open={sessionPickerOpen}
        onClose={() => setSessionPickerOpen(false)}
        sessions={upcomingSessions}
        selectedId={nextSessionEventId}
        onSelect={(id) => setNextSessionEventId(id)}
      />

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
