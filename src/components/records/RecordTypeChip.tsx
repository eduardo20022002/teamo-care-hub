import type { ComponentType } from "react";
import {
  Star, Trophy, Moon, Activity, Utensils, Sparkles, PenLine,
} from "lucide-react";
import { RECORD_TYPE_CONFIG, type RecordType } from "@/lib/validation";

type IconComponent = ComponentType<{ className?: string; strokeWidth?: number }>;

const ICONS: Record<RecordType, IconComponent> = {
  comportamento: Star,
  conquista: Trophy,
  sono: Moon,
  saude: Activity,
  alimentacao: Utensils,
  sensorial: Sparkles,
  livre: PenLine,
};

interface Props {
  type: RecordType;
  size?: "sm" | "md";
}

export function RecordTypeChip({ type, size = "sm" }: Props) {
  const cfg = RECORD_TYPE_CONFIG[type];
  const Icon = ICONS[type];

  if (size === "md") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        style={{ background: cfg.tint, color: cfg.color }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {cfg.label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: cfg.tint, color: cfg.color }}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {cfg.label}
    </span>
  );
}

export { ICONS as RECORD_TYPE_ICONS };
