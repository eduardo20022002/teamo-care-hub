import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type {
  TerapiaDuration,
  TerapiaKind,
  TerapiaTypeData,
} from "@/types/agenda";
import { ChipGroup } from "./primitives/ChipGroup";
import { FieldLabel, inputClasses } from "./primitives/FieldLabel";
import { AnimatedReveal } from "./primitives/AnimatedReveal";
import { Toggle } from "./MedicacaoFields";

const KIND_OPTIONS: { value: TerapiaKind; label: string }[] = [
  { value: "aba", label: "ABA" },
  { value: "fono", label: "Fonoaudiologia" },
  { value: "psicomotricidade", label: "Psicomotricidade" },
  { value: "to", label: "Terapia Ocupacional" },
  { value: "psicologia", label: "Psicologia" },
  { value: "other", label: "Outro" },
];

const DURATION_OPTIONS: { value: TerapiaDuration; label: string }[] = [
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "1h" },
  { value: "90", label: "1h30" },
  { value: "other", label: "Outro" },
];

interface Props {
  data: TerapiaTypeData;
  onChange: (d: TerapiaTypeData) => void;
  disabled?: boolean;
}

export function TerapiaFields({ data, onChange, disabled }: Props) {
  const color = TYPE_STYLES.terapia.col;
  const tint = TYPE_STYLES.terapia.tint;
  const set = <K extends keyof TerapiaTypeData>(
    k: K,
    v: TerapiaTypeData[K],
  ) => onChange({ ...data, [k]: v });

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <FieldLabel>Tipo de terapia</FieldLabel>
        <ChipGroup
          options={KIND_OPTIONS}
          value={data.therapyType}
          onChange={(v) => set("therapyType", v)}
          activeColor={color}
          activeTint={tint}
          scroll
          customValue="other"
          customInput={data.therapyTypeCustom ?? ""}
          onCustomInputChange={(v) => set("therapyTypeCustom", v)}
          customPlaceholder="Outro tipo de terapia"
          disabled={disabled}
        />
      </div>

      <div>
        <FieldLabel>Duração da sessão</FieldLabel>
        <ChipGroup
          options={DURATION_OPTIONS}
          value={data.duration}
          onChange={(v) => set("duration", v)}
          activeColor={color}
          activeTint={tint}
          customValue="other"
          customInput={data.durationCustom ?? ""}
          onCustomInputChange={(v) => set("durationCustom", v)}
          customPlaceholder="Outra duração"
          disabled={disabled}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <FieldLabel className="!mb-0">
            Tem contrato ou plano de sessões?
          </FieldLabel>
          <Toggle
            checked={data.hasContract}
            onChange={(v) => set("hasContract", v)}
            color={color}
            disabled={disabled}
          />
        </div>
        <AnimatedReveal show={data.hasContract}>
          <div className="mt-2.5 flex flex-col gap-3">
            <div>
              <FieldLabel>Quantidade de sessões previstas</FieldLabel>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={data.plannedSessions ?? ""}
                onChange={(e) =>
                  set(
                    "plannedSessions",
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                placeholder="Ex.: 24"
                disabled={disabled}
                className={inputClasses()}
                style={{ color: "#0F172A" }}
              />
            </div>
            <div>
              <FieldLabel>Data de reavaliação</FieldLabel>
              <input
                type="date"
                value={data.reassessmentOn ?? ""}
                onChange={(e) =>
                  set("reassessmentOn", e.target.value || undefined)
                }
                disabled={disabled}
                className={inputClasses()}
                style={{ color: "#0F172A", colorScheme: "light" }}
              />
            </div>
          </div>
        </AnimatedReveal>
      </div>
    </div>
  );
}
