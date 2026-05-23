import { useId } from "react";
import { AGENDA_BRAND } from "@/lib/agenda/tokens";
import { AnimatedReveal } from "./AnimatedReveal";
import { inputClasses } from "./FieldLabel";

export interface ChipOption<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  options: ChipOption<V>[];
  value: V | "";
  onChange: (v: V) => void;
  /** Cor de destaque do chip ativo. Default = AGENDA_BRAND.col (violeta). */
  activeColor?: string;
  activeTint?: string;
  /** Se true, faz scroll horizontal (chips em uma linha). */
  scroll?: boolean;
  /** Valor que abre o input livre — padrão "other". */
  customValue?: V;
  customInput?: string;
  onCustomInputChange?: (v: string) => void;
  customPlaceholder?: string;
  disabled?: boolean;
}

export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  activeColor = AGENDA_BRAND.col,
  activeTint = AGENDA_BRAND.tint,
  scroll = false,
  customValue,
  customInput = "",
  onCustomInputChange,
  customPlaceholder = "Digite a opção",
  disabled,
}: Props<V>) {
  const wrapperClass = scroll
    ? "-mr-5 flex gap-1.5 overflow-x-auto pb-1"
    : "flex flex-wrap gap-1.5";
  const showCustom =
    customValue !== undefined && value === customValue && !!onCustomInputChange;

  const customId = useId();

  return (
    <>
      <div className={wrapperClass}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className="inline-flex h-8 flex-shrink-0 items-center rounded-[9px] px-3 text-[12.5px] font-bold transition-colors disabled:opacity-60"
              style={{
                background: active ? activeTint : "#F6F7FB",
                border: `1px solid ${active ? activeColor : "#E5E7EB"}`,
                color: active ? activeColor : "#4B5563",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <AnimatedReveal show={showCustom}>
        <input
          id={customId}
          type="text"
          value={customInput}
          onChange={(e) => onCustomInputChange?.(e.target.value)}
          placeholder={customPlaceholder}
          disabled={disabled}
          maxLength={60}
          className={`${inputClasses()} mt-2`}
          style={{ color: "#0F172A" }}
        />
      </AnimatedReveal>
    </>
  );
}
