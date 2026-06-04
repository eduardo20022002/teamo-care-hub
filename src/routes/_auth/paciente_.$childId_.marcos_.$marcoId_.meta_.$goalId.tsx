import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowLeft,
  Loader2,
  Target,
  CheckCircle2,
  MinusCircle,
  XCircle,
  Hash,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  useMilestoneGoals,
  useGoalProgress,
  type GoalAttempt,
} from "@/services/milestones.service";

export const Route = createFileRoute(
  "/_auth/paciente/$childId/marcos/$marcoId/meta/$goalId",
)({
  head: () => ({
    meta: [{ title: "Detalhe da meta — TEAmo" }],
  }),
  component: GoalDetailPage,
});

// ─── Big number card ──────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  bg,
  text,
}: {
  value: number;
  label: string;
  bg: string;
  text: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[14px] py-4 px-2"
      style={{ background: bg }}
    >
      <span className="text-[28px] font-extrabold leading-none mb-1" style={{ color: text }}>
        {value}
      </span>
      <span className="text-[11px] font-semibold text-center" style={{ color: text, opacity: 0.8 }}>
        {label}
      </span>
    </div>
  );
}

// ─── Status labels/colors ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  achieved:     "Atingido",
  partial:      "Parcial",
  not_achieved: "Não atingido",
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  achieved:     { bg: "#ECFDF5", text: "#16A34A" },
  partial:      { bg: "#FEF3C7", text: "#D97706" },
  not_achieved: { bg: "#FEE2E2", text: "#DC2626" },
};
const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  achieved:     CheckCircle2,
  partial:      MinusCircle,
  not_achieved: XCircle,
};

// ─── Attempt row ──────────────────────────────────────────────────────────────

function AttemptRow({ attempt }: { attempt: GoalAttempt }) {
  const colors = STATUS_COLORS[attempt.status] ?? { bg: "#F3F4F6", text: "#6B7280" };
  const Icon = STATUS_ICON[attempt.status] ?? CheckCircle2;
  const dateStr = attempt.sessionDate
    ? new Date(attempt.sessionDate).toLocaleDateString("pt-BR", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "";

  return (
    <div
      className="rounded-[14px] border bg-white px-4 py-3"
      style={{ borderColor: "#F3F4F6" }}
    >
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <span className="text-[12px] font-semibold" style={{ color: "#6B7280" }}>
          {dateStr} · {attempt.sessionTitle}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold flex-shrink-0"
          style={{ background: colors.bg, color: colors.text }}
        >
          <Icon size={11} strokeWidth={2.5} />
          {STATUS_LABEL[attempt.status] ?? attempt.status}
        </span>
      </div>
      {attempt.notes && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: "#4B5563" }}>
          {attempt.notes}
        </p>
      )}
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

function GoalDetailPage() {
  const { childId, marcoId, goalId } = Route.useParams();
  const navigate = useNavigate();

  const goalsQuery = useMilestoneGoals(marcoId);
  const goals = goalsQuery.data ?? [];
  const goal = goals.find((g) => g.id === goalId) ?? null;

  const progressQuery = useGoalProgress(goalId, childId);
  const attempts = progressQuery.data ?? [];

  const stats = useMemo(() => {
    const total = attempts.length;
    const achieved = attempts.filter((a) => a.status === "achieved").length;
    const partial = attempts.filter((a) => a.status === "partial").length;
    const notAchieved = attempts.filter((a) => a.status === "not_achieved").length;
    return { total, achieved, partial, notAchieved };
  }, [attempts]);

  if (goalsQuery.isLoading) {
    return (
      <AppShell hideMenu>
        <LoadingSpinner />
      </AppShell>
    );
  }

  if (!goal) {
    return (
      <AppShell hideMenu>
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-sm" style={{ color: "#6B7280" }}>Meta não encontrada.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/paciente/$childId/marcos/$marcoId" as any,
              params: { childId, marcoId } as any,
            })
          }
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Voltar ao marco
        </button>

        {/* Header */}
        <div
          className="mt-2 flex items-start gap-3 rounded-[18px] px-5 py-4 mb-5"
          style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE" }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "#DBEAFE" }}
          >
            <Target size={18} strokeWidth={1.8} color="#3B82F6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold mb-0.5" style={{ color: "#3B82F6" }}>
              META TERAPÊUTICA
            </p>
            <h1
              className="text-[17px] font-extrabold leading-snug"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              {goal.title}
            </h1>
            {goal.description && (
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#4B5563" }}>
                {goal.description}
              </p>
            )}
          </div>
        </div>

        {/* Big numbers */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <StatCard
            value={stats.total}
            label="Total"
            bg="#EFF6FF"
            text="#3B82F6"
          />
          <StatCard
            value={stats.achieved}
            label="Atingido"
            bg="#ECFDF5"
            text="#16A34A"
          />
          <StatCard
            value={stats.partial}
            label="Parcial"
            bg="#FEF3C7"
            text="#D97706"
          />
          <StatCard
            value={stats.notAchieved}
            label="Não ating."
            bg="#FEE2E2"
            text="#DC2626"
          />
        </div>

        {/* Tentativas */}
        <div className="flex items-center gap-2 mb-3">
          <Hash size={15} strokeWidth={2} color="#6B7280" />
          <h2 className="text-[15px] font-bold" style={{ color: "#0F172A" }}>
            Objetivos registrados
          </h2>
        </div>

        {progressQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: "#9CA3AF" }} />
          </div>
        ) : attempts.length === 0 ? (
          <div
            className="rounded-[14px] border px-4 py-6 text-center"
            style={{ borderColor: "#E5E7EB", borderStyle: "dashed" }}
          >
            <p className="text-[14px] font-medium mb-1" style={{ color: "#6B7280" }}>
              Nenhum objetivo avaliado ainda.
            </p>
            <p className="text-[12.5px]" style={{ color: "#9CA3AF" }}>
              Ao planejar e registrar sessões com esta meta vinculada, as avaliações aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {attempts.map((attempt, i) => (
              <AttemptRow key={i} attempt={attempt} />
            ))}
          </div>
        )}

        <div className="h-16" />
      </div>
    </AppShell>
  );
}
