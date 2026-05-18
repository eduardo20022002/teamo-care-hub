import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  isLast?: boolean;
}

export function DetailRow({ icon, label, value, isLast }: Props) {
  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{
        borderBottom: isLast ? "none" : "1px solid #F1F2F6",
      }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: "#F4F5FA" }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="mb-px text-[11.5px] font-semibold uppercase tracking-[0.04em]"
          style={{ color: "#9CA3AF" }}
        >
          {label}
        </div>
        <div
          className="text-sm font-semibold"
          style={{ color: "#0F172A", letterSpacing: "-0.005em" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
