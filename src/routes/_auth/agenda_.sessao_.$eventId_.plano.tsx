import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Trash2, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useSaveSessionPlan, useGetSessionRecord } from "@/services/therapist.service";
import { formatBirthDate } from "@/lib/formatters";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/agenda/sessao/$eventId/plano")({
  head: () => ({
    meta: [{ title: "Plano da sessão — TEAmo" }],
  }),
  component: SessionPlanPage,
});

function SessionPlanPage() {
  const navigate = useNavigate();
  const { eventId } = Route.useParams();
  const savePlan = useSaveSessionPlan();
  const { data, isLoading } = useGetSessionRecord(eventId);

  const [objectives, setObjectives] = useState("");
  const [activities, setActivities] = useState<string[]>([""]);
  const [materials, setMaterials] = useState("");
  const [visibleToParents, setVisibleToParents] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Pré-preenche dados existentes
  useEffect(() => {
    if (!data || initialized) return;
    setInitialized(true);

    const plan = (data.event as any)?.session_plan ?? {};
    const previousPoints = data.previousPoints as string | null;

    // Objetivos: usa dados salvos ou pontos da sessão anterior
    const savedObjectives = plan.objectives ?? "";
    const fromPrevious = plan.objectives_from_previous ?? "";
    if (savedObjectives) {
      setObjectives(savedObjectives);
    } else if (fromPrevious) {
      setObjectives(fromPrevious);
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

  const addActivity = () => setActivities((prev) => [...prev, ""]);
  const removeActivity = (i: number) => setActivities((prev) => prev.filter((_, idx) => idx !== i));
  const updateActivity = (i: number, val: string) =>
    setActivities((prev) => prev.map((a, idx) => (idx === i ? val : a)));

  const handleSave = async () => {
    try {
      await savePlan.mutateAsync({
        eventId,
        objectives: objectives.trim() || undefined,
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
        weekday: "long",
        day: "numeric",
        month: "long",
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

        {/* Bloco: Objetivos */}
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
            {/* Objetivos da sessão */}
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                O que você planeja trabalhar?
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

            {/* Atividades planejadas */}
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

            {/* Materiais */}
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
    </AppShell>
  );
}
