import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type { RecurrenceConfig } from "@/types/agenda";
import { ChipGroup } from "../primitives/ChipGroup";
import { FieldLabel, inputClasses } from "../primitives/FieldLabel";
import { AnimatedReveal } from "../primitives/AnimatedReveal";

type Choice =
  | "once"
  | "every_3_months"
  | "every_6_months"
  | "yearly"
  | "custom";

const OPTIONS: { value: Choice; label: string }[] = [
  { value: "once", label: "Só essa vez" },
  { value: "every_3_months", label: "A cada 3 meses" },
  { value: "every_6_months", label: "A cada 6 meses" },
  { value: "yearly", label: "Todo ano" },
  { value: "custom", label: "Personalizar" },
];

function toChoice(r: RecurrenceConfig): Choice {
  if (r.freq === "every_n_months") {
    if (r.interval === 3) return "every_3_months";
    if (r.interval === 6) return "every_6_months";
    return "custom";
  }
  if (r.freq === "yearly") return "yearly";
  return "once";
}

interface Props {
  value: RecurrenceConfig;
  onChange: (v: RecurrenceConfig) => void;
  disabled?: boolean;
}

export function ConsultaRecurrence({ value, onChange, disabled }: Props) {
  const color = TYPE_STYLES.consulta.col;
  const tint = TYPE_STYLES.consulta.tint;
  const choice = toChoice(value);
  const customInterval =
    value.freq === "every_n_months" &&
    value.interval !== 3 &&
    value.interval !== 6
      ? value.interval
      : 4;

  const setChoice = (c: Choice) => {
    if (c === "once") onChange({ freq: "once" });
    else if (c === "every_3_months")
      onChange({ freq: "every_n_months", interval: 3 });
    else if (c === "every_6_months")
      onChange({ freq: "every_n_months", interval: 6 });
    else if (c === "yearly") onChange({ freq: "yearly" });
    else onChange({ freq: "every_n_months", interval: customInterval });
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
        scroll
        disabled={disabled}
      />
      <AnimatedReveal show={choice === "custom"}>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[13px] text-[#4B5563]">A cada</span>
          <input
            type="number"
            min="1"
            max="60"
            inputMode="numeric"
            value={
              value.freq === "every_n_months" ? value.interval : customInterval
            }
            onChange={(e) =>
              onChange({
                freq: "every_n_months",
                interval: Math.max(1, Number(e.target.value) || 1),
              })
            }
            disabled={disabled}
            className={`${inputClasses()} w-20 text-center`}
            style={{ color: "#0F172A" }}
          />
          <span className="text-[13px] text-[#4B5563]">meses</span>
        </div>
      </AnimatedReveal>
      {choice !== "once" && (
        <p className="mt-2 text-[11.5px]" style={{ color: "#9CA3AF" }}>
          Próximos retornos serão criados como “Retorno previsto — confirmar
          data”.
        </p>
      )}
    </div>
  );
}
