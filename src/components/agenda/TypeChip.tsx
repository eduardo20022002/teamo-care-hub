import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type { AgendaEventType } from "@/types/agenda";
import { TypeIcon } from "./icons";

interface Props {
  type: AgendaEventType;
  size?: "sm" | "md" | "lg";
}

const SIZE_TOKENS = {
  sm: { h: 22, padX: 8, font: 11, gap: 4, icon: 12 },
  md: { h: 26, padX: 10, font: 12, gap: 5, icon: 13 },
  lg: { h: 30, padX: 12, font: 12.5, gap: 6, icon: 14 },
} as const;

export function TypeChip({ type, size = "md" }: Props) {
  const t = TYPE_STYLES[type];
  const tokens = SIZE_TOKENS[size];
  return (
    <span
      className="inline-flex flex-shrink-0 items-center rounded-full font-bold"
      style={{
        height: tokens.h,
        padding: `0 ${tokens.padX}px`,
        gap: tokens.gap,
        background: t.tint,
        color: t.col,
        fontSize: tokens.font,
        letterSpacing: "-0.005em",
      }}
    >
      <TypeIcon type={type} size={tokens.icon} color={t.col} />
      {t.label}
    </span>
  );
}
