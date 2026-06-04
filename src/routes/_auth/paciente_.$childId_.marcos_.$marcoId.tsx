import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
  type Milestone,
} from "@/services/milestones.service";
import {
  MILESTONE_AREA_LABELS,
  MILESTONE_AREA_COLORS,
  MILESTONE_AREA_BG,
  MILESTONE_AREAS,
  MILESTONE_AREA_LABELS as _L,
  type MilestoneArea,
  type MilestoneInput,
  milestoneSchema,
} from "@/lib/validation";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/paciente/$childId/marcos/$marcoId")({
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
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.65)" }}>
      <div className="bg-white rounded-[20px] w-full max-w-[360px] p-6 shadow-2xl">
        {/* Ícone */}
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
          Será registrado como conquistado em <strong>{today}</strong>
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

// ─── Sheet de edição (inline) ─────────────────────────────────────────────────

function EditSheet({
  milestone,
  childId,
  patientName,
  onClose,
}: {
  milestone: Milestone;
  childId: string;
  patientName: string;
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

        {/* Área */}
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

        {/* Título */}
        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Título</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
        </div>

        {/* Descrição */}
        <div className="mb-4">
          <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">
            Descrição <span className="font-normal text-[#9CA3AF]">(opcional)</span>
          </label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]" />
        </div>

        {/* Toggle */}
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

// ─── Página principal ─────────────────────────────────────────────────────────

function MilestoneDetailPage() {
  const { childId, marcoId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showAchieveModal, setShowAchieveModal] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);

  const { data: allChildren } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const patient = (allChildren ?? []).find((c: Child) => c.id === childId) ?? null;
  const patientName = patient?.name ?? "Paciente";

  const milestoneQuery = useMilestone(marcoId);
  const milestone = milestoneQuery.data;

  const achieveMutation = useAchieveMilestone(childId);
  const pauseResumeMutation = usePauseResumeMilestone(childId);

  const handleAchieve = async () => {
    try {
      await achieveMutation.mutateAsync(marcoId);
      toast.success("🎉 Marco atingido!");
      setShowAchieveModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao marcar como atingido.");
    }
  };

  const handlePauseResume = async () => {
    try {
      await pauseResumeMutation.mutateAsync(marcoId);
      const m = pauseResumeMutation.data?.milestone as Milestone | undefined;
      toast.success(m?.status === "pausado" ? "Marco pausado." : "Marco retomado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao alterar status.");
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
                Marco conquistado!
              </p>
              <p className="text-[12.5px] mt-0.5" style={{ color: "#4B5563" }}>
                Atingido em {achievedDate}
              </p>
            </div>
          </div>
        )}

        {/* Seção: Metas vinculadas */}
        <div className="mb-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#EFF6FF" }}>
              <Target size={15} strokeWidth={1.8} color="#3B82F6" />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Metas vinculadas</h2>
          </div>
          <div
            className="rounded-[14px] border px-4 py-4 text-center"
            style={{ borderColor: "#E5E7EB", borderStyle: "dashed" }}
          >
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              Metas de sessão serão integradas na próxima fase.
            </p>
          </div>
        </div>

        {/* Seção: Histórico de progresso */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#F5F3FF" }}>
              <History size={15} strokeWidth={1.8} color="#8B5CF6" />
            </div>
            <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>Histórico de progresso</h2>
          </div>
          <div
            className="rounded-[14px] border px-4 py-4 text-center"
            style={{ borderColor: "#E5E7EB", borderStyle: "dashed" }}
          >
            <p className="text-[13px]" style={{ color: "#9CA3AF" }}>
              Tentativas registradas nas sessões aparecerão aqui.
            </p>
          </div>
        </div>

        <div className="h-24" />
      </div>

      {/* FAB — Marcar como atingido */}
      {isInProgress && (
        <button
          type="button"
          onClick={() => setShowAchieveModal(true)}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-[14px] font-bold text-white shadow-xl transition-transform hover:-translate-y-px active:scale-95"
          style={{ background: "#16A34A", boxShadow: "0 8px 20px rgba(22,163,74,0.35)" }}
        >
          <Trophy size={17} strokeWidth={2} />
          Marcar como atingido
        </button>
      )}

      {/* Modal de confirmação */}
      {showAchieveModal && (
        <AchieveModal
          milestone={milestone}
          onConfirm={() => void handleAchieve()}
          onCancel={() => setShowAchieveModal(false)}
          submitting={achieveMutation.isPending}
        />
      )}

      {/* Sheet de edição */}
      {showEditSheet && (
        <EditSheet
          milestone={milestone}
          childId={childId}
          patientName={patientName}
          onClose={() => setShowEditSheet(false)}
        />
      )}
    </AppShell>
  );
}
