import { AGENDA_BRAND } from "@/lib/agenda/tokens";
import type { RecurrenceConfig } from "@/types/agenda";
import { ChipGroup } from "../primitives/ChipGroup";
import { FieldLabel, inputClasses } from "../primitives/FieldLabel";
import { AnimatedReveal } from "../primitives/AnimatedReveal";

type Choice = "once" | "weekly" | "custom";

const OPTIONS: { value: Choice; label: string }[] = [
  { value: "once", label: "Só essa vez" },
  { value: "weekly", label: "Toda semana" },
  { value: "custom", label: "Outro" },
];

function toChoice(r: RecurrenceConfig): Choice {
  if (r.freq === "weekly") return "weekly";
  if (r.freq === "custom") return "custom";
  return "once";
}

interface Props {
  value: RecurrenceConfig;
  onChange: (v: RecurrenceConfig) => void;
  activeColor?: string;
  activeTint?: string;
  disabled?: boolean;
}

export function GenericRecurrence({
  value,
  onChange,
  activeColor = AGENDA_BRAND.col,
  activeTint = AGENDA_BRAND.tint,
  disabled,
}: Props) {
  const choice = toChoice(value);
  return (
    <div>
      <FieldLabel>Com que frequência?</FieldLabel>
      <ChipGroup
        options={OPTIONS}
        value={choice}
        onChange={(c) => {
          if (c === "once") onChange({ freq: "once" });
          else if (c === "weekly") onChange({ freq: "weekly" });
          else onChange({ freq: "custom", interval: 1 });
        }}
        activeColor={activeColor}
        activeTint={activeTint}
        disabled={disabled}
      />
      <AnimatedReveal show={choice === "custom"}>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[13px] text-[#4B5563]">A cada</span>
          <input
            type="number"
            min="1"
            max="365"
            inputMode="numeric"
            value={value.freq === "custom" ? (value.interval ?? 1) : 1}
            onChange={(e) =>
              onChange({
                freq: "custom",
                interval: Math.max(1, Number(e.target.value) || 1),
              })
            }
            disabled={disabled}
            className={`${inputClasses()} w-20 text-center`}
            style={{ color: "#0F172A" }}
          />
          <span className="text-[13px] text-[#4B5563]">dias</span>
        </div>
      </AnimatedReveal>
    </div>
  );
}
