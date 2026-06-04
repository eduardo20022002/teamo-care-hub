import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Flag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PauseCircle,
  Clock,
  MessageCircle,
  Users2,
  Star,
  Heart,
  Lightbulb,
  PersonStanding,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { useQuery } from "@tanstack/react-query";
import {
  useMilestones,
  useCreateMilestone,
  useUpdateMilestone,
  useMilestoneGoalCounts,
  type Milestone,
} from "@/services/milestones.service";
import {
  MILESTONE_AREAS,
  MILESTONE_AREA_LABELS,
  MILESTONE_AREA_COLORS,
  MILESTONE_AREA_BG,
  type MilestoneArea,
  type MilestoneInput,
} from "@/lib/validation";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/paciente/$childId/marcos")({
  head: () => ({
    meta: [{ title: "Marcos de desenvolvimento — TEAmo" }],
  }),
  component: MarcosPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

// ─── Ícones por área ──────────────────────────────────────────────────────────

const AREA_ICONS: Record<MilestoneArea, typeof Flag> = {
  comunicacao:   MessageCircle,
  socializacao:  Users2,
  autonomia:     Star,
  comportamento: Heart,
  cognicao:      Lightbulb,
  motricidade:   PersonStanding,
};

// ─── Chip de status ───────────────────────────────────────────────────────────

function StatusChip({ status, achievedAt }: { status: Milestone["status"]; achievedAt: string | null }) {
  if (status === "atingido") {
    const date = achievedAt
      ? new Date(achievedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
      : "";
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{ background: "#ECFDF5", color: "#16A34A" }}>
        <CheckCircle2 size={11} strokeWidth={2.5} />
        Atingido{date ? ` · ${date}` : ""}
      </span>
    );
  }
  if (status === "pausado") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{ background: "#FEF3C7", color: "#D97706" }}>
        <PauseCircle size={11} strokeWidth={2.5} />
        Pausado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: "#F3F4F6", color: "#6B7280" }}>
      <Clock size={11} strokeWidth={2.5} />
      Em progresso
    </span>
  );
}

// ─── Card de marco ────────────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  goalCount,
  onClick,
}: {
  milestone: Milestone;
  goalCount: number;
  onClick: () => void;
}) {
  const color = MILESTONE_AREA_COLORS[milestone.area as MilestoneArea] ?? TEAL;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-0 rounded-[14px] border bg-white text-left transition-shadow hover:shadow-md w-full overflow-hidden"
      style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
    >
      {/* Borda colorida à esquerda */}
      <div className="w-1 self-stretch flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[14px] font-bold leading-tight" style={{ color: "#0F172A" }}>
            {milestone.title}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusChip status={milestone.status} achievedAt={milestone.achieved_at} />
          <span className="text-[11px]" style={{ color: "#9CA3AF" }}>
            {goalCount === 0 ? "Sem metas" : `${goalCount} meta${goalCount !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Seção colapsável por área ────────────────────────────────────────────────

function AreaSection({
  area,
  milestones,
  goalCounts,
  onOpenMilestone,
}: {
  area: MilestoneArea;
  milestones: Milestone[];
  goalCounts: Record<string, number>;
  onOpenMilestone: (m: Milestone) => void;
}) {
  const [open, setOpen] = useState(true);
  const color = MILESTONE_AREA_COLORS[area];
  const bg = MILESTONE_AREA_BG[area];
  const Icon = AREA_ICONS[area];
  const label = MILESTONE_AREA_LABELS[area];
  const active = milestones.filter((m) => m.status !== "atingido").length;
  const achieved = milestones.filter((m) => m.status === "atingido").length;

  if (milestones.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-[14px] px-4 py-3 transition-colors hover:opacity-90"
        style={{ background: bg }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: color + "22" }}
        >
          <Icon size={16} strokeWidth={1.8} color={color} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-[14px] font-bold" style={{ color: "#0F172A" }}>{label}</span>
          <span className="ml-2 text-[12px]" style={{ color: "#6B7280" }}>
            {active > 0 && `${active} em progresso`}
            {active > 0 && achieved > 0 && " · "}
            {achieved > 0 && `${achieved} atingido${achieved !== 1 ? "s" : ""}`}
          </span>
        </div>
        {open ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 pl-2">
          {milestones.map((m) => (
            <MilestoneCard
              key={m.id}
              milestone={m}
              goalCount={goalCounts[m.id] ?? 0}
              onClick={() => onOpenMilestone(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sheet de criação/edição de marco ────────────────────────────────────────

interface SheetState {
  mode: "create" | "edit";
  milestone?: Milestone;
}

function MilestoneFormSheet({
  open,
  sheetState,
  onClose,
  childId,
  patientName,
}: {
  open: boolean;
  sheetState: SheetState;
  onClose: () => void;
  childId: string;
  patientName: string;
}) {
  const isEdit = sheetState.mode === "edit" && !!sheetState.milestone;
  const initial = sheetState.milestone;

  const [area, setArea] = useState<MilestoneArea | null>(
    (initial?.area as MilestoneArea) ?? null,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [shared, setShared] = useState(initial?.is_shared_with_parents ?? true);

  const createMutation = useCreateMilestone(childId);
  const updateMutation = useUpdateMilestone(childId);
  const submitting = createMutation.isPending || updateMutation.isPending;

  const canSubmit = !!area && title.trim().length >= 3;

  const handleSave = async () => {
    if (!area) return;
    const payload: MilestoneInput = {
      childId,
      title: title.trim(),
      area,
      description: description.trim() || undefined,
      isSharedWithParents: shared,
    };
    try {
      if (isEdit && initial) {
        await updateMutation.mutateAsync({ ...payload, milestoneId: initial.id });
        toast.success("Marco atualizado.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Marco criado.");
      }
      onClose();
      // Reset
      setArea(null);
      setTitle("");
      setDescription("");
      setShared(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar marco.");
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white px-5 pt-4 shadow-2xl"
        style={{ maxHeight: "92vh", overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB]" />

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-[18px] font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em" }}>
              {isEdit ? "Editar marco" : "Novo marco"}
            </h2>
            <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
              Uma conquista de desenvolvimento que você vai acompanhar ao longo das sessões de {patientName}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[#F3F4F6]"
          >
            <X size={18} color="#6B7280" />
          </button>
        </div>

        {/* Área de desenvolvimento */}
        <div className="mt-5">
          <label className="block text-[13px] font-semibold text-[#374151] mb-2.5">
            Área de desenvolvimento
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MILESTONE_AREAS.map((a) => {
              const color = MILESTONE_AREA_COLORS[a];
              const bg = MILESTONE_AREA_BG[a];
              const Icon = AREA_ICONS[a];
              const selected = area === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArea(a)}
                  className="flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left transition-all"
                  style={
                    selected
                      ? { borderColor: color, background: bg }
                      : { borderColor: "#E5E7EB", background: "white" }
                  }
                >
                  <Icon size={15} strokeWidth={1.8} color={selected ? color : "#9CA3AF"} />
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: selected ? color : "#374151" }}
                  >
                    {MILESTONE_AREA_LABELS[a]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11.5px]" style={{ color: "#9CA3AF" }}>
            Define a cor e a categoria do marco.
          </p>
        </div>

        {/* Título */}
        <div className="mt-5">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
            Título do marco
          </label>
          <input
            type="text"
            placeholder="Descreva a conquista a ser atingida…"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
        </div>

        {/* Descrição */}
        <div className="mt-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
            Descrição{" "}
            <span className="text-[#9CA3AF] font-normal">(opcional)</span>
          </label>
          <textarea
            rows={3}
            placeholder={`Contextualize o que esse marco significa para o ${patientName}…`}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
        </div>

        {/* Toggle visibilidade */}
        <button
          type="button"
          onClick={() => setShared((v) => !v)}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors"
          style={
            shared
              ? { borderColor: TEAL_BORDER, background: TEAL_SOFT }
              : { borderColor: "#E5E7EB", background: "#FAFAFA" }
          }
        >
          <div className="flex-1">
            <p className="text-[14px] font-bold" style={{ color: "#0F172A" }}>
              Visível para a família
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
              Os responsáveis verão este marco e acompanharão o progresso.
            </p>
          </div>
          <span
            className="ml-auto flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors"
            style={{ background: shared ? TEAL : "#D1D5DB" }}
          >
            <span
              className="h-5 w-5 rounded-full bg-white shadow transition-transform"
              style={{ transform: shared ? "translateX(22px)" : "translateX(2px)" }}
            />
          </span>
        </button>

        {/* Botão salvar */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSubmit || submitting}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all disabled:opacity-50"
          style={{ background: TEAL }}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            isEdit ? "Salvar alterações" : "Salvar marco"
          )}
        </button>
      </div>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function MarcosPage() {
  const { childId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>({ mode: "create" });

  // Dados da criança
  const { data: allChildren, isLoading: childrenLoading } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const patient = (allChildren ?? []).find((c: Child) => c.id === childId) ?? null;

  // Marcos
  const milestonesQuery = useMilestones(childId);
  const milestones = milestonesQuery.data ?? [];

  // Contagem de metas por marco
  const goalCountsQuery = useMilestoneGoalCounts(childId);
  const goalCounts = goalCountsQuery.data ?? {};

  // Agrupar por área
  const byArea = useMemo(() => {
    const map = new Map<MilestoneArea, Milestone[]>();
    for (const area of MILESTONE_AREAS) {
      map.set(area, []);
    }
    for (const m of milestones) {
      const list = map.get(m.area as MilestoneArea);
      if (list) list.push(m);
    }
    return map;
  }, [milestones]);

  const achieved = milestones.filter((m) => m.status === "atingido").length;
  const inProgress = milestones.filter((m) => m.status === "em_progresso").length;

  const openCreate = () => {
    setSheetState({ mode: "create" });
    setSheetOpen(true);
  };

  const openEdit = (m: Milestone) => {
    navigate({
      to: "/paciente/$childId/marcos/$marcoId" as any,
      params: { childId, marcoId: m.id } as any,
    });
  };

  if (childrenLoading || milestonesQuery.isLoading) {
    return (
      <AppShell hideMenu>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const patientName = patient?.name ?? "Paciente";

  return (
    <AppShell hideMenu onBack={() => navigate({ to: "/paciente/$childId" as any, params: { childId } as any })}>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <button
          type="button"
          onClick={() => navigate({ to: "/paciente/$childId" as any, params: { childId } as any })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Perfil de {patientName}
        </button>

        <div className="mt-1 mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            {patient && (
              <p className="text-[13px]" style={{ color: "#6B7280" }}>
                {patientName}
              </p>
            )}
            <h1
              className="text-[22px] font-extrabold leading-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              Marcos de desenvolvimento
            </h1>
          </div>
          {milestones.length > 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: TEAL, boxShadow: "0 4px 12px rgba(13,148,136,0.35)" }}
              aria-label="Novo marco"
            >
              <Plus size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* Estado vazio */}
        {milestones.length === 0 ? (
          <div className="mt-8 flex flex-col items-center text-center px-4">
            {/* Ilustração */}
            <div className="relative mb-8">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-[28px]"
                style={{ background: TEAL_SOFT, border: `2px solid ${TEAL_BORDER}` }}
              >
                <Flag size={40} strokeWidth={1.5} color={TEAL} />
              </div>
              {/* Ícones flutuantes decorativos */}
              <div
                className="absolute -top-3 -right-4 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}
              >
                <MessageCircle size={16} color="#3B82F6" strokeWidth={1.7} />
              </div>
              <div
                className="absolute -bottom-2 -left-5 flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: "#ECFDF5", border: "1.5px solid #A7F3D0" }}
              >
                <Users2 size={16} color="#10B981" strokeWidth={1.7} />
              </div>
              <div
                className="absolute top-6 -right-8 flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "#FDF2F8", border: "1.5px solid #FBCFE8" }}
              >
                <PersonStanding size={14} color="#EC4899" strokeWidth={1.7} />
              </div>
            </div>

            <h2
              className="text-[20px] font-extrabold leading-snug"
              style={{ color: "#0F172A", letterSpacing: "-0.02em", maxWidth: 280 }}
            >
              Comece a mapear a jornada de {patientName}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "#6B7280", maxWidth: 320 }}>
              Defina os primeiros marcos de desenvolvimento. Eles guiarão o trabalho sessão a sessão e mostrarão à família o caminho percorrido.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[15px] font-bold text-white"
              style={{ background: TEAL, boxShadow: "0 4px 16px rgba(13,148,136,0.3)" }}
            >
              <Plus size={18} strokeWidth={2.2} />
              Criar primeiro marco
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex gap-2 mb-5">
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
              >
                <CheckCircle2 size={16} strokeWidth={2} color="#16A34A" />
                <div>
                  <p className="text-[18px] font-extrabold leading-none" style={{ color: "#16A34A" }}>
                    {achieved}
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: "#16A34A" }}>
                    Atingidos
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                style={{ background: "white", border: "1px solid #E5E7EB" }}
              >
                <Clock size={16} strokeWidth={1.8} color="#6B7280" />
                <div>
                  <p className="text-[18px] font-extrabold leading-none" style={{ color: "#0F172A" }}>
                    {inProgress}
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: "#6B7280" }}>
                    Em progresso
                  </p>
                </div>
              </div>
            </div>

            {/* Seções por área */}
            {MILESTONE_AREAS.map((area) => {
              const list = byArea.get(area) ?? [];
              return (
                <AreaSection
                  key={area}
                  area={area}
                  milestones={list}
                  goalCounts={goalCounts}
                  onOpenMilestone={openEdit}
                />
              );
            })}
          </>
        )}

        <div className="h-8" />
      </div>

      {/* Sheet de formulário */}
      <MilestoneFormSheet
        open={sheetOpen}
        sheetState={sheetState}
        onClose={() => setSheetOpen(false)}
        childId={childId}
        patientName={patientName}
      />
    </AppShell>
  );
}
