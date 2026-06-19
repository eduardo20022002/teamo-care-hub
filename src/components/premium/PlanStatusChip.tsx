/**
 * Selo de status do plano para o dashboard — torna visível se o usuário está em
 * Premium pago, em trial (com dias restantes) ou no plano grátis (com CTA de upgrade).
 * Scope-aware: terapeuta (teal), pais (roxo), clínica (azul).
 */
import { Link } from "@tanstack/react-router";
import { Sparkles, Gift, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanScope } from "@/lib/plan-limits";

const ACCENT: Record<PlanScope, string> = { therapist: "#0D9488", parent: "#7C3AED", clinic: "#2563EB" };
const ACCENT_SOFT: Record<PlanScope, string> = { therapist: "#F0FDFA", parent: "#F5F3FF", clinic: "#DBEAFE" };
const ACCENT_BORDER: Record<PlanScope, string> = { therapist: "#CCFBF1", parent: "#DDD6FE", clinic: "#BFDBFE" };

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function PlanStatusChip({
  scope,
  isPremium,
  status,
  trialEndsAt,
  className,
}: {
  scope: PlanScope;
  isPremium: boolean;
  status: string | null;
  trialEndsAt: string | null;
  className?: string;
}) {
  const accent = ACCENT[scope];
  const soft = ACCENT_SOFT[scope];
  const border = ACCENT_BORDER[scope];

  const isTrial = status === "trialing";
  const days = daysUntil(trialEndsAt);

  // Plano grátis (sem premium e sem trial) → CTA para conhecer o Premium.
  if (!isPremium) {
    return (
      <Link
        to="/premium"
        search={{ scope } as any}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
          className,
        )}
        style={{ background: "white", color: accent, borderColor: border }}
      >
        Plano grátis
        <span className="opacity-60">·</span>
        <span className="inline-flex items-center gap-0.5">
          Conhecer o Premium
          <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    );
  }

  // Premium ativo via trial → mostra dias restantes.
  if (isTrial) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold",
          className,
        )}
        style={{ background: soft, color: accent, borderColor: border }}
      >
        <Gift className="h-3.5 w-3.5" />
        Premium · trial
        {days !== null && (
          <span className="opacity-80">
            · {days} {days === 1 ? "dia restante" : "dias restantes"}
          </span>
        )}
      </span>
    );
  }

  // Premium pago/ativo.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold",
        className,
      )}
      style={{ background: soft, color: accent, borderColor: border }}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Premium ativo
    </span>
  );
}
