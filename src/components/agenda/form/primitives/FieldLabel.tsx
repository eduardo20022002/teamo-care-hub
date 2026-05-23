import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  optional?: boolean;
  className?: string;
}

export function FieldLabel({ children, optional, className = "" }: Props) {
  return (
    <label
      className={`mb-1.5 block text-[12.5px] font-semibold ${className}`}
      style={{ color: "#374151", letterSpacing: "-0.005em" }}
    >
      {children}
      {optional && (
        <span style={{ color: "#9CA3AF", fontWeight: 500, marginLeft: 6 }}>
          (opcional)
        </span>
      )}
    </label>
  );
}

export function inputClasses(hasError = false) {
  return `h-11 w-full rounded-xl border bg-[#F6F7FB] px-3.5 text-[14.5px] outline-none transition-all ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
      : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
  } disabled:opacity-60`;
}
