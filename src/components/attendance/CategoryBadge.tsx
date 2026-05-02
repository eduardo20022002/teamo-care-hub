import { cn } from "@/lib/utils";
import {
  ATTENDANCE_CATEGORY_LABELS,
  type AttendanceCategoryValue,
} from "@/lib/validation";

const STYLES: Record<AttendanceCategoryValue, string> = {
  orientacao: "bg-primary-soft text-primary",
  observacao_clinica: "bg-amber-100 text-amber-800",
  conduta: "bg-violet-100 text-violet-800",
  evolucao: "bg-emerald-100 text-emerald-800",
};

interface Props {
  category: AttendanceCategoryValue | string;
  className?: string;
}

export function CategoryBadge({ category, className }: Props) {
  const key = category as AttendanceCategoryValue;
  const label = ATTENDANCE_CATEGORY_LABELS[key] ?? category;
  const style = STYLES[key] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}
