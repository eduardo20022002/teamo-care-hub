import { Clock, Plus, X } from "lucide-react";
import { inputClasses } from "./FieldLabel";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  disabled?: boolean;
}

export function TimeMultiPicker({
  value,
  onChange,
  max = 8,
  disabled,
}: Props) {
  const update = (idx: number, v: string) => {
    const next = [...value];
    next[idx] = v;
    onChange(next);
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
  };
  const items = value.length === 0 ? [""] : value;
  return (
    <div className="flex flex-col gap-2">
      {items.map((t, idx) => (
        <div key={`time-${idx}`} className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="time"
              value={t}
              onChange={(e) => {
                if (value.length === 0) onChange([e.target.value]);
                else update(idx, e.target.value);
              }}
              disabled={disabled}
              className={`${inputClasses()} pr-10`}
              style={{ color: "#0F172A", colorScheme: "light" }}
            />
            <Clock
              size={16}
              strokeWidth={1.6}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
          </div>
          {value.length > 1 && (
            <button
              type="button"
              onClick={() => remove(idx)}
              disabled={disabled}
              aria-label="Remover horário"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[#9CA3AF] transition-colors hover:bg-[#E5E7EB] hover:text-[#6B7280] disabled:opacity-50"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 self-start rounded-[9px] border border-dashed border-[#D1D5DB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B5563] transition-colors hover:border-[#9CA3AF] hover:text-[#374151] disabled:opacity-50"
        >
          <Plus size={14} strokeWidth={2} />
          Adicionar horário
        </button>
      )}
    </div>
  );
}
