import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type { RecurrenceConfig } from "@/types/agenda";
import { ChipGroup } from "../primitives/ChipGroup";
import { FieldLabel, inputClasses } from "../primitives/FieldLabel";
import { WeekdayPicker } from "../primitives/WeekdayPicker";
import { AnimatedReveal } from "../primitives/AnimatedReveal";

type Choice = "daily" | "weekly" | "every_n_days" | "once";

const OPTIONS: { value: Choice; label: string }[] = [
  { value: "daily", label: "Todo dia" },
  { value: "weekly", label: "Dias específicos" },
  { value: "every_n_days", label: "A cada X dias" },
  { value: "once", label: "Só uma vez" },
];

function toChoice(r: RecurrenceConfig): Choice {
  if (r.freq === "weekly") return "weekly";
  if (r.freq === "every_n_days") return "every_n_days";
  if (r.freq === "once" || r.freq === "none") return "once";
  return "daily";
}

interface Props {
  value: RecurrenceConfig;
  onChange: (v: RecurrenceConfig) => void;
  disabled?: boolean;
}

export function MedicacaoRecurrence({ value, onChange, disabled }: Props) {
  const color = TYPE_STYLES.medicacao.col;
  const tint = TYPE_STYLES.medicacao.tint;
  const choice = toChoice(value);

  const setChoice = (c: Choice) => {
    if (c === "daily") onChange({ freq: "daily" });
    else if (c === "weekly") onChange({ freq: "weekly", daysOfWeek: [] });
    else if (c === "every_n_days")
      onChange({ freq: "every_n_days", interval: 2 });
    else onChange({ freq: "once" });
  };

  return (
    <div>
      <FieldLabel>Com que frequência?</FieldLabel>
      <ChipGroup
        options={OPTIONS}
        value={choice}
        onChange={setChoice}
        activeColor={color}
        activeTint={tint}
        disabled={disabled}
      />
      <AnimatedReveal show={value.freq === "weekly"}>
        <div className="mt-3">
          <WeekdayPicker
            value={value.freq === "weekly" ? (value.daysOfWeek ?? []) : []}
            onChange={(days) => onChange({ freq: "weekly", daysOfWeek: days })}
            activeColor={color}
            disabled={disabled}
          />
        </div>
      </AnimatedReveal>
      <AnimatedReveal show={value.freq === "every_n_days"}>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[13px] text-[#4B5563]">A cada</span>
          <input
            type="number"
            min="1"
            max="365"
            inputMode="numeric"
            value={value.freq === "every_n_days" ? value.interval : 2}
            onChange={(e) =>
              onChange({
                freq: "every_n_days",
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
