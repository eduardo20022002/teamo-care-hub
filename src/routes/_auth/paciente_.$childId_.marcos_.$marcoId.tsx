import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Trophy,
  CheckCircle2,
  PauseCircle,
  Clock,
  MoreHorizontal,
  Loader2,
  Target,
  History,
  MessageCircle,
  Users2,
  Star,
  Heart,
  Lightbulb,
  PersonStanding,
  Flag,
  X,
  Plus,
  Trash2,
  ChevronRight,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { useQuery } from "@tanstack/react-query";
import {
  useMilestone,
  useAchieveMilestone,
  usePauseResumeMilestone,
  useUpdateMilestone,
  useMilestoneGoals,
  useCreateMilestoneGoal,
  useUpdateMilestoneGoal,
  useDeleteMilestoneGoal,
  useMilestoneProgress,
  type Milestone,
  type MilestoneGoal,
  type MilestoneProgressEntry,
} from "@/services/milestones.service";
import {
  MILESTONE_AREA_LABELS,
  MILESTONE_AREA_COLORS,
  MILESTONE_AREA_BG,
  MILESTONE_AREAS,
  type MilestoneArea,
  type MilestoneGoalInput,
} from "@/lib/validation";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/paciente_/$childId_/marcos_/$marcoId")({
  head: () => ({
    meta: [{ title: "Marco de desenvolvimento — TEAmo" }],
  }),
  component: MilestoneDetailPage,
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

// ─── Dots de progresso (últimas 5 tentativas) ─────────────────────────────────

const STATUS_DOT_COLOR: Record<string, string> = {
  achieved:     "#16A34A",
  partial:      "#D97706",
  not_achieved: "#DC2626",
};
const STATUS_DOT_SYMBOL: Record<string, string> = {
  achieved:     "✓",
  partial:      "–",
  not_achieved: "×",
};

function GoalProgressDots({ entries }: { entries: MilestoneProgressEntry[] }) {
  const dots = entries.slice(0, 5);
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      {dots.length === 0 ? (
        <span className="text-[11px]" style={{ color: "#9CA3AF" }}>Sem tentativas</span>
      ) : (
        dots.map((e, i) => (
          <span
            key={i}
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: STATUS_DOT_COLOR[e.status] ?? "#9CA3AF" }}
          >
            {STATUS_DOT_SYMBOL[e.status] ?? "?"}
          </span>
        ))
      )}
    </div>
  );
}

// ─── Tela de celebração ───────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4",
  "#EF4444", "#F97316",
];

function CelebrationScreen({
  milestone,
  patientName,
  areaColor,
  areaBg,
  AreaIcon,
  onViewAll,
}: {
  milestone: Milestone;
  patientName: string;
  areaColor: string;
  areaBg: string;
  AreaIcon: typeof Flag;
  onViewAll: () => void;
}) {
  const achievedDate = milestone.achieved_at
    ? new Date(milestone.achieved_at).toLocaleDateString("pt-BR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  // Deterministic confetti positions (avoids hydration mismatch)
  const confettiDots = useMemo(() => {
    const seed = [12, 35, 55, 8, 72, 90, 25, 60, 45, 80, 18, 66];
    return seed.map((s, i) => ({
      left: `${(s * 7 + i * 23) % 95}%`,
      top:  `${(s * 3 + i * 17) % 80}%`,
      size: 6 + (i % 4) * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: (s * 11 + i * 37) % 360,
    }));
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-white px-6 overflow-hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
    >
      {/* Confetti */}
      {confettiDots.map((d, i) => (
        <span
          key={i}
          className="pointer-events-none absolute rounded-sm"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            background: d.color,
            transform: `rotate(${d.rotate}deg)`,
            opacity: 0.75,
          }}
        />
      ))}

      {/* Ícones sobrepostos */}
      <div className="relative mb-6">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: areaColor + "22", border: `2px solid ${areaColor}44` }}
        >
          <AreaIcon size={34} strokeWidth={1.7} color={areaColor} />
        </div>
        <div
          className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "#FEFCE8", border: "2px solid #FDE68A" }}
        >
          <Trophy size={15} strokeWidth={2} color="#D97706" />
        </div>
      </div>

      <p className="text-[13px] font-semibold mb-2" style={{ color: TEAL }}>
        🎉 {patientName} conquistou!
      </p>

      <h1
        className="text-center text-[24px] font-extrabold leading-tight mb-4"
        style={{ color: "#0F172A", letterSpacing: "-0.025em", maxWidth: 320 }}
      >
        {milestone.title}
      </h1>

      <span
        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-semibold mb-5"
        style={{ background: "#F0FDF4", color: "#16A34A" }}
      >
        <CheckCircle2 size={14} strokeWidth={2.5} />
        Atingido em {achievedDate}
      </span>

      {milestone.description && (
        <p
          className="text-center text-[14px] leading-relaxed mb-6"
          style={{ color: "#4B5563", maxWidth: 320 }}
        >
          {milestone.description}
        </p>
      )}

      <button
        type="button"
        onClick={() => toast.info("Em breve: compartilhamento disponível.")}
        className="flex w-full max-w-xs items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white mb-3"
        style={{ background: "#3B82F6" }}
      >
        <Share2 size={16} strokeWidth={2} />
        Compartilhar esta conquista
      </button>

      <button
        type="button"
        onClick={onViewAll}
        className="text-[14px] font-semibold"
        style={{ color: "#6B7280" }}
      >
        Ver todos os marcos
      </button>
    </div>
  );
}

// ─── Modal de confirmação de conquista ────────────────────────────────────────

function AchieveModal({
  milestone,
  onConfirm,
  onCancel,
  submitting,
}: {
  milestone: Milestone;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const today = new Date().toLocaleDateString("pt-BR", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.65)" }}>
      <div className="bg-white rounded-[20px] w-full max-w-[360px] p-6 shadow-2xl">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "#FEFCE8", border: "2px solid #FDE68A" }}
        >
          <Trophy size={30} strokeWidth={1.7} color="#D97706" />
        </div>

        <h3
          className="text-center text-[18px] font-extrabold mb-2"
          style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
        >
          Confirmar conquista
        </h3>
        <p className="text-center text-[13.5px] leading-relaxed mb-2" style={{ color: "#374151" }}>
          Você está prestes a marcar{" "}
          <span className="font-semibold">"{milestone.title}"</span>{" "}
          como atingido. Esta conquista é permanente e não pode ser desfeita.
        </p>
        <p
          className="text-center text-[12px] rounded-xl px-3 py-2 mb-5"
          style={{ background: "#F0FDF4", color: "#16A34A" }}
        >
          Registrado como conquistado em <strong>{today}</strong>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl border text-[14px] font-semibold transition-colors hover:bg-[#F3F4F6]"
            style={{ borderColor: "#E5E7EB", color: "#374151" }}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 h-11 rounded-xl text-[14px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "#16A34A" }}
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <Trophy size={15} strokeWidth={2} />
                Confirmar conquista
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Menu de opções ───────────────────────────────────────────────────────────

function OptionsMenu({
  milestone,
  onPauseResume,
  onEdit,
  onClose,
}: {
  milestone: Milestone;
  onPauseResume: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const isAchieved = milestone.status === "atingido";

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-10 z-50 w-48 rounded-[14px] border bg-white py-1 shadow-xl"
        style={{ borderColor: "#EEF0F4" }}
      >
        <button
          type="button"
          onClick={() => { onEdit(); onClose(); }}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[14px] font-medium transition-colors hover:bg-[#F3F4F6]"
          style={{ color: "#0F172A" }}
        >
          Editar marco
        </button>
        {!isAchieved && (
          <button
            type="button"
            onClick={() => { onPauseResume(); onClose(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-[14px] font-medium transition-colors hover:bg-[#F3F4F6]"
            style={{ color: "#0F172A" }}
          >
            {milestone.status === "pausado" ? "Retomar" : "Pausar"} marco
          </button>
        )}
      </div>
    </>
  );
}

// ─── Sheet de edição do marco (inline) ───────────────────────────────────────

function EditSheet({
  milestone,
  childId,
  onClose,
}: {
  milestone: Milestone;
  childId: string;
  onClose: () => void;
}) {
  const [area, setArea] = useState<MilestoneArea>(milestone.area as MilestoneArea);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [shared, setShared] = useState(milestone.is_shared_with_parents);
  const updateMutation = useUpdateMilestone(childId);
  const canSave = !!area && title.trim().length >= 3;

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        childId,
        milestoneId: milestone.id,
        title: title.trim(),
        area,
        description: description.trim() || undefined,
        isSharedWithParents: shared,
      });
      toast.success("Marco atualizado.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white px-5 pt-4 shadow-2xl"
        style={{ maxHeight: "92vh", overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB]" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold" style={{ color: "#0F172A" }}>Editar marco</h2>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6]">
            <X size={18} color="#6B7280" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-2">Área</label>
          <div className="grid grid-cols-2 gap-2">
            {MILESTONE_AREAS.map((a) => {
              const color = MILESTONE_AREA_COLORS[a];
              const bg = MILESTONE_AREA_BG[a];
              const Icon = AREA_ICONS[a];
              const sel = area === a;
              return (
                <button key={a} type="button" onClick={() => setArea(a)}
                  className="flex items-center gap-2 rounded-xl border-2 px-3 py-2.5"
                  style={sel ? { borderColor: color, background: bg } : { borderColor: "#E5E7EB", background: "white" }}>
                  <Icon size={14} color={sel ? color : "#9CA3AF"} strokeWidth={1.8} />
                  <span className="text-[13px] font-semibold" style={{ color: sel ? color : "#374151" }}>{MILESTONE_AREA_LABELS[a]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Título</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
        </div>

        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
            Descrição <span className="font-normal text-[#9CA3AF]">(opcional)</span>
          </label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
        </div>

        <button type="button" onClick={() => setShared((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 mb-4"
          style={shared ? { borderColor: TEAL_BORDER, background: TEAL_SOFT } : { borderColor: "#E5E7EB", background: "#FAFAFA" }}>
          <div className="flex-1">
            <p className="text-[14px] font-bold" style={{ color: "#0F172A" }}>Visível para a família</p>
          </div>
          <span className="flex h-6 w-11 items-center rounded-full" style={{ background: shared ? TEAL : "#D1D5DB" }}>
            <span className="h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: shared ? "translateX(22px)" : "translateX(2px)" }} />
          </span>
        </button>

        <button type="button" onClick={() => void handleSave()} disabled={!canSave || updateMutation.isPending}
          className="flex h-12 w-full items-center justify-center rounded-xl text-white text-[15px] font-bold disabled:opacity-50"
          style={{ background: TEAL }}>
          {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Salvar alterações"}
        </button>
      </div>
    </>
  );
}

// ─── Sheet de criação/edição de meta ─────────────────────────────────────────

function GoalFormSheet({
  milestoneId,
  childId,
  editGoal,
  onClose,
}: {
  milestoneId: string;
  childId: string;
  editGoal: MilestoneGoal | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(editGoal?.title ?? "");
  const [description, setDescription] = useState(editGoal?.description ?? "");

  const createMutation = useCreateMilestoneGoal(milestoneId);
  const updateMutation = useUpdateMilestoneGoal(milestoneId);
  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSave = title.trim().length >= 3;

  const handleSave = async () => {
    const payload: MilestoneGoalInput = {
      milestoneId,
      childId,
      title: title.trim(),
      description: description.trim() || undefined,
    };
    try {
      if (editGoal) {
        await updateMutation.mutateAsync({ ...payload, goalId: editGoal.id });
        toast.success("Meta atualizada.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Meta criada.");
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar meta.");
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white px-5 pt-4 shadow-2xl"
        style={{ maxHeight: "85vh", overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB]" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-extrabold" style={{ color: "#0F172A" }}>
            {editGoal ? "Editar meta" : "Nova meta"}
          </h2>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6]">
            <X size={18} color="#6B7280" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
            Título da meta
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 200))}
            placeholder="Ex: Pedir objeto por troca sem apoio gestual"
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
        </div>

        <div className="mb-6">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
            Descrição <span className="font-normal text-[#9CA3AF]">(opcional)</span>
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Detalhes ou critério de sucesso desta meta..."
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm resize-none placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave || isPending}
          className="flex h-12 w-full items-center justify-center rounded-xl text-white text-[15px] font-bold disabled:opacity-50"
          style={{ background: TEAL }}
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : editGoal ? "Salvar alterações" : "Adicionar meta"}
        </button>
      </div>
    </>
  );
}

// ─── Status badge do histórico ────────────────────────────────────────────────

const HISTORY_LABELS: Record<string, string> = {
  achieved:     "Atingido",
  partial:      "Parcial",
  not_achieved: "Não atingido",
};
const HISTORY_COLORS: Record<string, { bg: string; text: string }> = {
  achieved:     { bg: "#ECFDF5", text: "#16A34A" },
  partial:      { bg: "#FEF3C7", text: "#D97706" },
  not_achieved: { bg: "#FEE2E2", text: "#DC2626" },
};

// ─── Página principal ─────────────────────────────────────────────────────────

function MilestoneDetailPage() {
  const { childId, marcoId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showAchieveModal, setShowAchieveModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [goalFormOpen, setGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<MilestoneGoal | null>(null);

  const { data: allChildren } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const patient = (allChildren ?? []).find((c: Child) => c.id === childId) ?? null;
  const patientName = patient?.name ?? "Paciente";

  const milestoneQuery = useMilestone(marcoId);
  const milestone = milestoneQuery.data;

  const goalsQuery = useMilestoneGoals(marcoId);
  const goals = goalsQuery.data ?? [];

  const progressQuery = useMilestoneProgress(marcoId, childId);
  const progressEntries = progressQuery.data ?? [];

  // Group progress entries by goal ID for dots
  const progressByGoal = useMemo(() => {
    const map: Record<string, MilestoneProgressEntry[]> = {};
    for (const e of progressEntries) {
      if (!map[e.goalId]) map[e.goalId] = [];
      map[e.goalId].push(e);
    }
    return map;
  }, [progressEntries]);

  const achieveMutation = useAchieveMilestone(childId);
  const pauseResumeMutation = usePauseResumeMilestone(childId);
  const deleteGoalMutation = useDeleteMilestoneGoal(marcoId);

  const handleAchieve = async () => {
    try {
      await achieveMutation.mutateAsync(marcoId);
      setShowAchieveModal(false);
      setShowCelebration(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar como atingido.");
    }
  };

  const handlePauseResume = async () => {
    try {
      await pauseResumeMutation.mutateAsync(marcoId);
      toast.success("Status do marco atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status.");
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Remover esta meta? As avaliações associadas serão desvinculadas.")) return;
    try {
      await deleteGoalMutation.mutateAsync(goalId);
      toast.success("Meta removida.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover meta.");
    }
  };

  if (milestoneQuery.isLoading) {
    return (
      <AppShell hideMenu>
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!milestone) {
    return (
      <AppShell hideMenu>
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-[#6B7280] text-sm">Marco não encontrado.</p>
        </div>
      </AppShell>
    );
  }

  const area = milestone.area as MilestoneArea;
  const color = MILESTONE_AREA_COLORS[area] ?? TEAL;
  const bg = MILESTONE_AREA_BG[area] ?? TEAL_SOFT;
  const AreaIcon = AREA_ICONS[area] ?? Flag;
  const isAchieved = milestone.status === "atingido";
  const isInProgress = milestone.status === "em_progresso";

  const achievedDate = milestone.achieved_at
    ? new Date(milestone.achieved_at).toLocaleDateString("pt-BR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "";

  return (
    <AppShell hideMenu>
      {/* Tela de celebração */}
      {showCelebration && (
        <CelebrationScreen
          milestone={milestone}
          patientName={patientName}
          areaColor={color}
          areaBg={bg}
          AreaIcon={AreaIcon}
          onViewAll={() => {
            setShowCelebration(false);
            navigate({ to: "/paciente/$childId/marcos" as any, params: { childId } as any });
          }}
        />
      )}

      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <button
          type="button"
          onClick={() => navigate({ to: "/paciente/$childId/marcos" as any, params: { childId } as any })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Marcos de {patientName}
        </button>

        {/* Header colorido */}
        <div
          className="mt-2 rounded-[18px] px-5 py-4 mb-4"
          style={{ background: bg, border: `1.5px solid ${color}33` }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: color + "22" }}
            >
              <AreaIcon size={20} strokeWidth={1.7} color={color} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold mb-1" style={{ color }}>
                {MILESTONE_AREA_LABELS[area]}
              </div>
              <h1
                className="text-[18px] font-extrabold leading-snug"
                style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
              >
                {milestone.title}
              </h1>
              {milestone.description && (
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "#4B5563" }}>
                  {milestone.description}
                </p>
              )}
            </div>
            {/* Menu de opções */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowOptions((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/10"
              >
                <MoreHorizontal size={18} color="#6B7280" />
              </button>
              {showOptions && (
                <OptionsMenu
                  milestone={milestone}
                  onPauseResume={() => void handlePauseResume()}
                  onEdit={() => setShowEditSheet(true)}
                  onClose={() => setShowOptions(false)}
                />
              )}
            </div>
          </div>

          {/* Status chip */}
          <div className="mt-3">
            {isAchieved ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: "#ECFDF5", color: "#16A34A" }}>
                <CheckCircle2 size={13} strokeWidth={2.5} />
                Atingido
              </span>
            ) : milestone.status === "pausado" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: "#FEF3C7", color: "#D97706" }}>
                <PauseCircle size={13} strokeWidth={2.5} />
                Pausado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                style={{ background: "#F3F4F6", color: "#6B7280" }}>
                <Clock size={13} strokeWidth={2.5} />
                Em progresso
              </span>
            )}
          </div>
        </div>

        {/* Banner de conquista */}
        {isAchieved && (
          <div
            className="flex items-center gap-4 rounded-[16px] px-5 py-4 mb-5"
            style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
              style={{ background: "#FEFCE8", border: "1.5px solid #FDE68A" }}
            >
              <Trophy size={22} strokeWidth={1.7} color="#D97706" />
            </div>
            <div>
              <p className="text-[14px] font-extrabold" style={{ color: "#16A34A" }}>
                Conquista atingida! 🎉
              </p>
              <p className="text-[12.5px] mt-0.5" style={{ color: "#4B5563" }}>
                Conquistado em {achievedDate} — permanente.
              </p>
            </div>
          </div>
        )}

        {/* ── Seção: Metas vinculadas ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#EFF6FF" }}>
                <Target size={15} strokeWidth={1.8} color="#3B82F6" />
              </div>
              <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>
                Metas vinculadas
                {goals.length > 0 && (
                  <span className="ml-1.5 text-[13px] font-semibold" style={{ color: "#9CA3AF" }}>
                    {goals.length}
                  </span>
                )}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => { setEditingGoal(null); setGoalFormOpen(true); }}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition-colors hover:bg-[#F3F4F6]"
              style={{ border: "1.5px solid #E5E7EB" }}
            >
              <Plus size={16} strokeWidth={2} color={TEAL} />
            </button>
          </div>

          {goalsQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin" style={{ color: "#9CA3AF" }} />
            </div>
          ) : goals.length === 0 ? (
            <div
              className="rounded-[14px] border px-4 py-5 text-center"
              style={{ borderColor: "#E5E7EB", borderStyle: "dashed" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "#6B7280" }}>
                Nenhuma meta criada ainda.
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                Adicione metas para acompanhar o progresso neste marco.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {goals.map((goal) => {
                const dots = progressByGoal[goal.id] ?? [];
                return (
                  <div
                    key={goal.id}
                    className="flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3"
                    style={{ borderColor: "#E5E7EB" }}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        navigate({
                          to: "/paciente/$childId/marcos/$marcoId/meta/$goalId" as any,
                          params: { childId, marcoId, goalId: goal.id } as any,
                        })
                      }
                    >
                      <p className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>
                        {goal.title}
                      </p>
                      {goal.status === "atingido" ? (
                        <span className="inline-flex items-center gap-1 mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                          style={{ background: "#ECFDF5", color: "#16A34A" }}>
                          <CheckCircle2 size={10} strokeWidth={2.5} />
                          Atingida
                          {goal.achieved_at ? ` · ${new Date(goal.achieved_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}` : ""}
                        </span>
                      ) : (
                        <GoalProgressDots entries={dots} />
                      )}
                    </button>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => { setEditingGoal(goal); setGoalFormOpen(true); }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#F3F4F6]"
                      >
                        <History size={13} color="#6B7280" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteGoal(goal.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#FEE2E2]"
                        disabled={deleteGoalMutation.isPending}
                      >
                        <Trash2 size={13} color="#DC2626" />
                      </button>
                      <ChevronRight size={14} color="#9CA3AF" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Seção: Histórico de progresso ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#F5F3FF" }}>
              <History size={15} strokeWidth={1.8} color="#8B5CF6" />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Histórico de progresso</h2>
          </div>

          {progressQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="animate-spin" style={{ color: "#9CA3AF" }} />
            </div>
          ) : progressEntries.length === 0 ? (
            <div
              className="rounded-[14px] border px-4 py-5 text-center"
              style={{ borderColor: "#E5E7EB", borderStyle: "dashed" }}
            >
              <p className="text-[13px] font-medium" style={{ color: "#6B7280" }}>
                Sem registros ainda.
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: "#9CA3AF" }}>
                Vincule objetivos de sessão às metas para ver o histórico aqui.
              </p>
            </div>
          ) : (
            <div className="relative pl-5">
              {/* Linha vertical */}
              <div
                className="absolute left-2.5 top-3 bottom-3 w-0.5 rounded-full"
                style={{ background: "#E5E7EB" }}
              />
              <div className="flex flex-col gap-3">
                {progressEntries.map((entry, i) => {
                  const dateStr = entry.sessionDate
                    ? new Date(entry.sessionDate).toLocaleDateString("pt-BR", {
                        day: "numeric", month: "short",
                      })
                    : "";
                  const colors = HISTORY_COLORS[entry.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
                  const dotColor = STATUS_DOT_COLOR[entry.status] ?? "#9CA3AF";
                  return (
                    <div key={i} className="relative pl-4">
                      {/* Dot da timeline */}
                      <div
                        className="absolute -left-[3px] top-1.5 h-3 w-3 rounded-full ring-2 ring-white"
                        style={{ background: dotColor }}
                      />
                      <div className="rounded-[12px] border bg-white px-3 py-2.5" style={{ borderColor: "#F3F4F6" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11.5px] font-semibold" style={{ color: "#6B7280" }}>
                            {dateStr} · {entry.sessionTitle}
                          </span>
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{ background: colors.bg, color: colors.text }}
                          >
                            {HISTORY_LABELS[entry.status] ?? entry.status}
                          </span>
                        </div>
                        <p className="text-[12.5px] font-semibold" style={{ color: "#374151" }}>
                          {entry.goalTitle}
                        </p>
                        {entry.notes && (
                          <p className="text-[12px] mt-0.5" style={{ color: "#6B7280" }}>
                            {entry.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Progresso de metas — guia para decisão de atingir o marco */}
        {goals.length > 0 && (() => {
          const achieved = goals.filter((g) => g.status === "atingido").length;
          const pct = goals.length > 0 ? Math.round((achieved / goals.length) * 100) : 0;
          const allDone = achieved === goals.length;
          return (
            <div
              className="rounded-[16px] px-5 py-4 mb-4"
              style={{ background: allDone ? "#F0FDF4" : "#F8FAFC", border: `1.5px solid ${allDone ? "#BBF7D0" : "#E5E7EB"}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-bold" style={{ color: allDone ? "#16A34A" : "#374151" }}>
                  {achieved} de {goals.length} metas atingidas
                </p>
                <span className="text-[12px] font-semibold" style={{ color: allDone ? "#16A34A" : "#6B7280" }}>
                  {pct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "#E5E7EB" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: allDone ? "#16A34A" : "#0D9488" }}
                />
              </div>
              {allDone && isInProgress && (
                <p className="mt-2 text-[12px] font-semibold" style={{ color: "#16A34A" }}>
                  Todas as metas foram atingidas — considere marcar este marco como conquistado!
                </p>
              )}
            </div>
          );
        })()}

        {isInProgress && (
          <div className="px-4 pt-4 pb-8">
            <button
              type="button"
              onClick={() => setShowAchieveModal(true)}
              className="w-full inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-[14px] font-bold text-white shadow-xl transition-transform hover:-translate-y-px active:scale-95"
              style={{ background: "#16A34A", boxShadow: "0 8px 20px rgba(22,163,74,0.35)" }}
            >
              <Trophy size={17} strokeWidth={2} />
              Marcar como atingido
            </button>
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* Modal de confirmação */}
      {showAchieveModal && (
        <AchieveModal
          milestone={milestone}
          onConfirm={() => void handleAchieve()}
          onCancel={() => setShowAchieveModal(false)}
          submitting={achieveMutation.isPending}
        />
      )}

      {/* Sheet de edição do marco */}
      {showEditSheet && (
        <EditSheet
          milestone={milestone}
          childId={childId}
          onClose={() => setShowEditSheet(false)}
        />
      )}

      {/* Sheet de criação/edição de meta */}
      {goalFormOpen && (
        <GoalFormSheet
          milestoneId={marcoId}
          childId={childId}
          editGoal={editingGoal}
          onClose={() => { setGoalFormOpen(false); setEditingGoal(null); }}
        />
      )}
    </AppShell>
  );
}
