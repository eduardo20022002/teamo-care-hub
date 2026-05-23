import { AGENDA_BRAND } from "@/lib/agenda/tokens";

const LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

interface Props {
  value: number[]; // 0..6
  onChange: (v: number[]) => void;
  /** Quando true, apenas 1 dia pode estar ativo. */
  single?: boolean;
  activeColor?: string;
  disabled?: boolean;
}

export function WeekdayPicker({
  value,
  onChange,
  single,
  activeColor = AGENDA_BRAND.col,
  disabled,
}: Props) {
  const toggle = (idx: number) => {
    if (single) {
      onChange([idx]);
      return;
    }
    onChange(
      value.includes(idx) ? value.filter((d) => d !== idx) : [...value, idx],
    );
  };
  return (
    <div className="flex gap-1.5">
      {LABELS.map((label, idx) => {
        const on = value.includes(idx);
        return (
          <button
            key={`day-${idx}`}
            type="button"
            disabled={disabled}
            onClick={() => toggle(idx)}
            className="flex h-9 flex-1 items-center justify-center rounded-[9px] text-[12px] font-extrabold transition-colors disabled:opacity-60"
            style={{
              background: on ? activeColor : "#F6F7FB",
              border: `1px solid ${on ? activeColor : "#E5E7EB"}`,
              color: on ? "white" : "#6B7280",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
