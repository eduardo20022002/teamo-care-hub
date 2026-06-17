import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Eye, EyeOff, Loader2, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useSaveSessionPlan, useGetSessionRecord } from "@/services/therapist.service";
import { useAllGoalsForChild, type GoalPickerItem } from "@/services/milestones.service";
import { usePlan } from "@/services/subscription.service";
import { useUpgrade } from "@/components/premium/PremiumGate";
import { MILESTONE_AREA_COLORS } from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/agenda_/sessao_/$eventId_/plano")({
  head: () => ({
    meta: [{ title: "Plano da sessão — TEAmo" }],
  }),
  component: SessionPlanPage,
});

// ─── Sheet picker de meta ─────────────────────────────────────────────────────

function GoalPickerSheet({
  goals,
  onToggle,
  onClearAll,
  currentGoalIds,
  onClose,
}: {
  goals: GoalPickerItem[];
  onToggle: (goal: GoalPickerItem) => void;
  onClearAll: () => void;
  currentGoalIds: string[];
  onClose: () => void;
}) {
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(() => {
    // Auto-expand marcos que já têm metas selecionadas, e o primeiro marco
    const expanded = new Set<string>();
    for (const g of goals) {
      if (currentGoalIds.includes(g.goalId)) expanded.add(g.milestoneId);
    }
    return expanded;
  });

  const byMilestone = useMemo(() => {
    const map = new Map<string, { milestoneId: string; milestoneTitle: string; milestoneArea: string; goals: GoalPickerItem[] }>();
    for (const g of goals) {
      if (!map.has(g.milestoneId)) {
        map.set(g.milestoneId, {
          milestoneId: g.milestoneId,
          milestoneTitle: g.milestoneTitle,
          milestoneArea: g.milestoneArea,
          goals: [],
        });
      }
      map.get(g.milestoneId)!.goals.push(g);
    }
    return Array.from(map.values());
  }, [goals]);

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) next.delete(milestoneId);
      else next.add(milestoneId);
      return next;
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white px-5 pt-4 shadow-2xl flex flex-col"
        style={{ maxHeight: "78vh", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB] flex-shrink-0" />
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <h2 className="text-[17px] font-extrabold" style={{ color: "#0F172A" }}>Vincular a metas</h2>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6]">
            <X size={18} color="#6B7280" />
          </button>
        </div>
        <p className="text-[12px] mb-3 flex-shrink-0" style={{ color: "#6B7280" }}>
          Selecione uma ou mais metas. Toque no marco para expandir.
        </p>

        <div className="overflow-y-auto flex-1 pb-2">
          {goals.length === 0 ? (
            <p className="text-[13px] text-center py-6" style={{ color: "#9CA3AF" }}>
              Nenhuma meta criada. Crie metas nos marcos do paciente primeiro.
            </p>
          ) : (
            <>
              {currentGoalIds.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="mb-3 flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold text-[#DC2626]"
                  style={{ borderColor: "#FEE2E2", background: "#FFF5F5" }}
                >
                  <X size={14} strokeWidth={2.5} />
                  Remover todos os vínculos
                </button>
              )}
              {byMilestone.map((ms) => {
                const color = MILESTONE_AREA_COLORS[ms.milestoneArea as keyof typeof MILESTONE_AREA_COLORS] ?? TEAL;
                const expanded = expandedMilestones.has(ms.milestoneId);
                const selectedInMs = ms.goals.filter((g) => currentGoalIds.includes(g.goalId)).length;
                return (
                  <div key={ms.milestoneId} className="mb-2 rounded-xl border overflow-hidden" style={{ borderColor: expanded ? color + "55" : "#E5E7EB" }}>
                    {/* Cabeçalho do marco */}
                    <button
                      type="button"
                      onClick={() => toggleMilestone(ms.milestoneId)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      style={{ background: expanded ? color + "11" : "#FAFAFA" }}
                    >
                      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[13.5px] font-bold flex-1" style={{ color: expanded ? color : "#374151" }}>
                        {ms.milestoneTitle}
                      </span>
                      {selectedInMs > 0 && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: color, color: "white" }}
                        >
                          {selectedInMs}
                        </span>
                      )}
                      <span className="text-[12px] font-medium" style={{ color: "#9CA3AF" }}>
                        {expanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {/* Metas do marco */}
                    {expanded && (
                      <div className="flex flex-col divide-y divide-[#F3F4F6]">
                        {ms.goals.map((g) => {
                          const sel = currentGoalIds.includes(g.goalId);
                          return (
                            <button
                              key={g.goalId}
                              type="button"
                              onClick={() => onToggle(g)}
                              className="flex items-center gap-3 px-4 py-3 text-left transition-colors"
                              style={{ background: sel ? color + "0D" : "white" }}
                            >
                              {/* Checkbox visual */}
                              <div
                                className="h-5 w-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center"
                                style={sel ? { borderColor: color, background: color } : { borderColor: "#D1D5DB", background: "white" }}
                              >
                                {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                              </div>
                              <span className="text-[13.5px] font-semibold flex-1" style={{ color: sel ? color : "#374151" }}>
                                {g.goalTitle}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Botão Concluir */}
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 mt-3 h-11 w-full rounded-xl text-white text-[14px] font-bold"
          style={{ background: TEAL }}
        >
          Concluir
          {currentGoalIds.length > 0 ? ` (${currentGoalIds.length} selecionada${currentGoalIds.length > 1 ? "s" : ""})` : ""}
        </button>
      </div>
    </>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

function SessionPlanPage() {
  const navigate = useNavigate();
  const { eventId } = Route.useParams();
  const savePlan = useSaveSessionPlan();
  // Vínculo objetivo↔meta é Premium (server ignora os ids no free).
  const { isPremium } = usePlan();
  const { openUpgrade } = useUpgrade();
  const { data, isLoading } = useGetSessionRecord(eventId);

  const [objectives, setObjectives] = useState("");
  const [specificObjectives, setSpecificObjectives] = useState<string[]>([""]);
  // Parallel array: each entry is a list of linked goal IDs (empty = no links)
  const [objectiveGoalIds, setObjectiveGoalIds] = useState<string[][]>([[]]);
  const [activities, setActivities] = useState<string[]>([""]);
  const [materials, setMaterials] = useState("");
  const [visibleToParents, setVisibleToParents] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Picker state: index of objective being linked, or null
  const [pickerForIndex, setPickerForIndex] = useState<number | null>(null);

  // child_id vem direto do event (child só tem name/birth_date no servidor)
  const childId = (data?.event as any)?.child_id as string | undefined;
  const allGoalsQuery = useAllGoalsForChild(childId);
  const allGoals = allGoalsQuery.data ?? [];

  // Build a lookup map goalId → GoalPickerItem for display
  const goalMap = useMemo(() => {
    const m: Record<string, GoalPickerItem> = {};
    for (const g of allGoals) m[g.goalId] = g;
    return m;
  }, [allGoals]);

  // Pré-preenche dados existentes
  useEffect(() => {
    if (!data || initialized) return;
    setInitialized(true);

    const plan = (data.event as any)?.session_plan ?? {};
    const fromPrevious = plan.objectives_from_previous ?? "";

    const savedObjectives = plan.objectives ?? "";
    if (savedObjectives) {
      setObjectives(savedObjectives);
    } else if (fromPrevious) {
      setObjectives(fromPrevious);
    }

    if (plan.specific_objectives?.length) {
      const saved = plan.specific_objectives as string[];
      setSpecificObjectives(saved);
      // Restore linked goal IDs — support old shape (string|null)[] and new shape string[][]
      const raw: any[] = plan.objective_goal_ids ?? saved.map(() => []);
      const normalized: string[][] = raw.map((v) => {
        if (Array.isArray(v)) return v.filter(Boolean);
        if (typeof v === "string" && v) return [v];
        return [];
      });
      setObjectiveGoalIds(normalized);
    }

    if (plan.activities?.length) {
      setActivities(plan.activities as string[]);
    }
    if (plan.materials) {
      setMaterials(plan.materials);
    }
    if (typeof (data.event as any)?.plan_visible_to_parents === "boolean") {
      setVisibleToParents((data.event as any).plan_visible_to_parents);
    }
  }, [data, initialized]);

  // Keep objectiveGoalIds in sync with specificObjectives length
  const syncGoalIds = (newObjs: string[]) => {
    setObjectiveGoalIds((prev) => {
      const next = [...prev];
      while (next.length < newObjs.length) next.push([]);
      return next.slice(0, newObjs.length);
    });
  };

  const addSpecificObjective = () => {
    const next = [...specificObjectives, ""];
    setSpecificObjectives(next);
    syncGoalIds(next);
  };
  const removeSpecificObjective = (i: number) => {
    const next = specificObjectives.filter((_, idx) => idx !== i);
    setSpecificObjectives(next);
    setObjectiveGoalIds((prev) => prev.filter((_, idx) => idx !== i));
    if (pickerForIndex === i) setPickerForIndex(null);
  };
  const updateSpecificObjective = (i: number, val: string) =>
    setSpecificObjectives((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const addActivity = () => setActivities((prev) => [...prev, ""]);
  const removeActivity = (i: number) => setActivities((prev) => prev.filter((_, idx) => idx !== i));
  const updateActivity = (i: number, val: string) =>
    setActivities((prev) => prev.map((a, idx) => (idx === i ? val : a)));

  const toggleGoal = (index: number, goal: GoalPickerItem) => {
    setObjectiveGoalIds((prev) => {
      const next = prev.map((arr) => [...arr]);
      const arr = next[index] ?? [];
      const pos = arr.indexOf(goal.goalId);
      if (pos >= 0) arr.splice(pos, 1);
      else arr.push(goal.goalId);
      next[index] = arr;
      return next;
    });
  };
  const clearGoals = (index: number) => {
    setObjectiveGoalIds((prev) => {
      const next = prev.map((arr) => [...arr]);
      next[index] = [];
      return next;
    });
  };

  const handleSave = async () => {
    const filtered: string[] = [];
    const filteredGoalIds: string[][] = [];
    specificObjectives.forEach((o, i) => {
      if (o.trim()) {
        filtered.push(o);
        filteredGoalIds.push(objectiveGoalIds[i] ?? []);
      }
    });

    try {
      await savePlan.mutateAsync({
        eventId,
        objectives: objectives.trim() || undefined,
        specificObjectives: filtered.length > 0 ? filtered : undefined,
        objectiveGoalIds: filteredGoalIds.some((arr) => arr.length > 0) ? filteredGoalIds : undefined,
        activities: activities.filter((a) => a.trim()).length > 0
          ? activities.filter((a) => a.trim())
          : undefined,
        materials: materials.trim() || undefined,
        visibleToParents,
      });
      toast.success("Plano salvo com sucesso.");
      navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar plano.");
    }
  };

  const event = data?.event as any;
  const child = data?.child as any;

  const sessionDate = event?.start_at
    ? new Date(event.start_at).toLocaleDateString("pt-BR", {
        weekday: "long", day: "numeric", month: "long",
      })
    : "";
  const sessionTime = event?.start_at
    ? new Date(event.start_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  if (isLoading) {
    return (
      <AppShell hideMenu onBack={() => navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any })}>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin" color={TEAL} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideMenu onBack={() => navigate({ to: "/agenda/$eventId" as any, params: { eventId } as any })}>
      <div className="mx-auto max-w-[520px] px-4 py-6">
        {/* Header */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-6"
          style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1">
            Plano da sessão
          </p>
          <h1 className="text-[20px] font-extrabold text-[#0F172A] leading-tight">
            {child?.name ?? event?.title ?? "Sessão"}
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            {sessionDate}{sessionDate && sessionTime ? " · " : ""}{sessionTime}
          </p>
        </div>

        {/* ═══ Seção 1 — Objetivos ═══ */}
        <div className="mb-6">
          <h2 className="text-[16px] font-bold text-[#0F172A] mb-4 flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: TEAL }}
            >
              1
            </span>
            Objetivos
          </h2>

          <div className="flex flex-col gap-4">
            {/* Objetivo geral */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Objetivo geral
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Trabalhar imitação motora e contato visual…"
                value={objectives}
                onChange={(e) => setObjectives(e.target.value.slice(0, 1000))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
              <p className="mt-1 text-right text-xs text-[#9CA3AF]">{objectives.length}/1000</p>
            </div>

            {/* Objetivos específicos com vínculo de meta */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Objetivos específicos
              </label>
              <div className="flex flex-col gap-3">
                {specificObjectives.map((obj, i) => {
                  const linkedIds = objectiveGoalIds[i] ?? [];
                  const hasLinks = linkedIds.length > 0;

                  return (
                    <div key={i} className="flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`Objetivo específico ${i + 1}`}
                          value={obj}
                          onChange={(e) => updateSpecificObjective(i, e.target.value.slice(0, 200))}
                          className="h-10 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                        />
                        {/* Botão de vínculo */}
                        <button
                          type="button"
                          onClick={() => (isPremium ? setPickerForIndex(i) : openUpgrade("goal-link"))}
                          title={isPremium ? "Vincular a metas" : "Vincular a metas (Premium)"}
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors relative"
                          style={
                            hasLinks
                              ? { borderColor: TEAL, background: TEAL + "11" }
                              : { borderColor: "#E5E7EB", ...(isPremium ? {} : { opacity: 0.6 }) }
                          }
                        >
                          <Link2 size={14} strokeWidth={1.8} color={hasLinks ? TEAL : "#9CA3AF"} />
                          {linkedIds.length > 1 && (
                            <span
                              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                              style={{ background: TEAL }}
                            >
                              {linkedIds.length}
                            </span>
                          )}
                        </button>
                        {specificObjectives.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSpecificObjective(i)}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#DC2626] hover:border-red-200 transition-colors"
                          >
                            <Trash2 size={14} strokeWidth={1.8} />
                          </button>
                        )}
                      </div>
                      {/* Chips das metas vinculadas */}
                      {hasLinks && (
                        <div className="flex flex-wrap gap-1.5 pl-1">
                          {linkedIds.map((gid) => {
                            const g = goalMap[gid];
                            if (!g) return null;
                            const c = MILESTONE_AREA_COLORS[g.milestoneArea as keyof typeof MILESTONE_AREA_COLORS] ?? TEAL;
                            return (
                              <div key={gid} className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: c + "15", border: `1px solid ${c}44` }}>
                                <div className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                                <span className="text-[11px] font-semibold" style={{ color: c }}>
                                  {g.milestoneTitle} · {g.goalTitle}
                                </span>
                                <button type="button" onClick={() => toggleGoal(i, g)} className="ml-0.5">
                                  <X size={10} color={c} strokeWidth={2.5} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addSpecificObjective}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors self-start"
                  style={{ color: TEAL }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Adicionar objetivo específico
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Seção 2 — Atividades ═══ */}
        <div className="mb-6">
          <h2 className="text-[16px] font-bold text-[#0F172A] mb-4 flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: TEAL }}
            >
              2
            </span>
            Atividades
          </h2>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Atividades planejadas
              </label>
              <div className="flex flex-col gap-2">
                {activities.map((act, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Atividade ${i + 1}`}
                      value={act}
                      onChange={(e) => updateActivity(i, e.target.value.slice(0, 200))}
                      className="h-10 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                    />
                    {activities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeActivity(i)}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#9CA3AF] hover:text-[#DC2626] hover:border-red-200 transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addActivity}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors self-start"
                  style={{ color: TEAL }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Adicionar atividade
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                Materiais necessários{" "}
                <span className="text-[#9CA3AF] font-normal">(opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Bolas sensoriais, cartões PECS…"
                value={materials}
                onChange={(e) => setMaterials(e.target.value.slice(0, 500))}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>
        </div>

        {/* Bloco: Visibilidade */}
        <div
          className="rounded-[16px] border p-4 mb-8"
          style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#0F172A]">Visível para a família</p>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {visibleToParents
                  ? "Os responsáveis verão este plano antes da sessão acontecer."
                  : "Apenas você verá o plano — a família não tem acesso."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisibleToParents((v) => !v)}
              aria-label="Alternar visibilidade"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors"
              style={
                visibleToParents
                  ? { background: TEAL_SOFT, borderColor: TEAL_BORDER, color: TEAL }
                  : { background: "#F4F5FA", borderColor: "#E5E7EB", color: "#6B7280" }
              }
            >
              {visibleToParents ? <Eye size={13} /> : <EyeOff size={13} />}
              {visibleToParents ? "Visível" : "Privado"}
            </button>
          </div>
        </div>

        {/* Salvar */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={savePlan.isPending}
          className="flex h-12 w-full items-center justify-center rounded-xl text-white text-[15px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
          style={{ background: TEAL }}
        >
          {savePlan.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Salvar plano"
          )}
        </button>
      </div>

      {/* Picker de metas */}
      {pickerForIndex !== null && (
        <GoalPickerSheet
          goals={allGoals}
          currentGoalIds={objectiveGoalIds[pickerForIndex] ?? []}
          onToggle={(goal) => toggleGoal(pickerForIndex, goal)}
          onClearAll={() => clearGoals(pickerForIndex)}
          onClose={() => setPickerForIndex(null)}
        />
      )}
    </AppShell>
  );
}
