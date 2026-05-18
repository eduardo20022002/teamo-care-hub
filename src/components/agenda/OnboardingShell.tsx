import type { ReactNode } from "react";
import { AGENDA_BRAND } from "@/lib/agenda/tokens";

interface Props {
  step: number;
  total?: number;
  children: ReactNode;
  primary: ReactNode;
  skipLabel?: string;
  onSkip?: () => void;
  bg?: string;
}

export function OnboardingShell({
  step,
  total = 4,
  children,
  primary,
  skipLabel = "Pular tutorial",
  onSkip,
  bg = "white",
}: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: bg, fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 pt-2">
        <ProgressDots step={step} total={total} />
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="bg-transparent px-3 py-2 text-[13.5px] font-semibold transition-colors hover:text-[#374151]"
            style={{ color: "#6B7280" }}
          >
            {skipLabel}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">{children}</div>
      <div className="px-5 pb-6 pt-3.5" style={{ background: bg }}>
        {primary}
      </div>
    </div>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-3.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: i + 1 === step ? 22 : 6,
            background: i + 1 <= step ? AGENDA_BRAND.col : "#E5E7EB",
          }}
        />
      ))}
    </div>
  );
}
