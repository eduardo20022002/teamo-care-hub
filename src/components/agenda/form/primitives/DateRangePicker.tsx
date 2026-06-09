import { Calendar } from "lucide-react";
import { inputClasses } from "./FieldLabel";

interface Props {
  from: string;
  to: string;
  onChange: (v: { from: string; to: string }) => void;
  disabled?: boolean;
}

export function DateRangePicker({ from, to, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <div className="relative min-w-0">
        <input
          type="date"
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          disabled={disabled}
          className={`${inputClasses()} pr-10`}
          style={{ color: "#0F172A", colorScheme: "light" }}
          aria-label="De"
        />
        <Calendar
          size={16}
          strokeWidth={1.6}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
        />
      </div>
      <div className="relative min-w-0">
        <input
          type="date"
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          disabled={disabled}
          className={`${inputClasses()} pr-10`}
          style={{ color: "#0F172A", colorScheme: "light" }}
          aria-label="Até"
        />
        <Calendar
          size={16}
          strokeWidth={1.6}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
        />
      </div>
    </div>
  );
}
