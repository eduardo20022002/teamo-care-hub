/** Selo "Premium" e cadeado para marcar controles bloqueados sem escondê-los. */
import { Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanScope } from "@/lib/plan-limits";

type Scope = PlanScope;
const ACCENT: Record<Scope, string> = { therapist: "#0D9488", parent: "#7C3AED", clinic: "#2563EB" };
const ACCENT_SOFT: Record<Scope, string> = { therapist: "#F0FDFA", parent: "#F5F3FF", clinic: "#DBEAFE" };

export function PremiumBadge({
  className,
  scope = "therapist",
}: {
  className?: string;
  scope?: Scope;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        className,
      )}
      style={{ background: ACCENT_SOFT[scope], color: ACCENT[scope] }}
    >
      <Sparkles className="h-3 w-3" />
      Premium
    </span>
  );
}

export function PremiumLock({ className, scope = "therapist" }: { className?: string; scope?: Scope }) {
  return <Lock className={cn("h-3.5 w-3.5", className)} style={{ color: ACCENT[scope] }} aria-hidden />;
}
