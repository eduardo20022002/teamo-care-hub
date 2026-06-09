import { Calendar, Clock } from "lucide-react";
import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type {
  ConsultaKind,
  ConsultaSpecialty,
  ConsultaTypeData,
} from "@/types/agenda";
import { ChipGroup } from "./primitives/ChipGroup";
import { ChecklistField } from "./primitives/ChecklistField";
import { FieldLabel, inputClasses } from "./primitives/FieldLabel";
import { AnimatedReveal } from "./primitives/AnimatedReveal";
import { Toggle } from "./MedicacaoFields";

const KIND_OPTIONS: { value: ConsultaKind; label: string }[] = [
  { value: "first", label: "Primeira consulta" },
  { value: "followup", label: "Retorno" },
  { value: "evaluation", label: "Avaliação" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
  { value: "other", label: "Outro" },
];

const SPECIALTY_OPTIONS: { value: ConsultaSpecialty; label: string }[] = [
  { value: "neuro", label: "Neuropediatria" },
  { value: "psicologia", label: "Psicologia" },
  { value: "psiquiatria_infantil", label: "Psiquiatria infantil" },
  { value: "pediatria", label: "Pediatria" },
  { value: "fonoaudiologia", label: "Fonoaudiologia" },
  { value: "nutricao", label: "Nutrição" },
  { value: "assistencia_social", label: "Assistência social" },
  { value: "other", label: "Outro" },
];

export interface ConsultaFieldsData extends ConsultaTypeData {
  returnDate?: string;
  returnTime?: string;
}

interface Props {
  data: ConsultaFieldsData;
  onChange: (d: ConsultaFieldsData) => void;
  disabled?: boolean;
}

export function ConsultaFields({ data, onChange, disabled }: Props) {
  const color = TYPE_STYLES.consulta.col;
  const tint = TYPE_STYLES.consulta.tint;
  const set = <K extends keyof ConsultaFieldsData>(
    k: K,
    v: ConsultaFieldsData[K],
  ) => onChange({ ...data, [k]: v });

  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <FieldLabel>Tipo de consulta</FieldLabel>
        <ChipGroup
          options={KIND_OPTIONS}
          value={data.consultType}
          onChange={(v) => set("consultType", v)}
          activeColor={color}
          activeTint={tint}
          scroll
          customValue="other"
          customInput={data.consultTypeCustom ?? ""}
          onCustomInputChange={(v) => set("consultTypeCustom", v)}
          customPlaceholder="Outro tipo"
          disabled={disabled}
        />
      </div>

      <div>
        <FieldLabel>Especialidade ou área</FieldLabel>
        <ChipGroup
          options={SPECIALTY_OPTIONS}
          value={data.specialty}
          onChange={(v) => set("specialty", v)}
          activeColor={color}
          activeTint={tint}
          scroll
          customValue="other"
          customInput={data.specialtyCustom ?? ""}
          onCustomInputChange={(v) => set("specialtyCustom", v)}
          customPlaceholder="Outra especialidade"
          disabled={disabled}
        />
      </div>

      <div>
        <FieldLabel optional>Documentos para levar</FieldLabel>
        <ChecklistField
          items={data.documentsChecklist}
          onChange={(items) => set("documentsChecklist", items)}
          disabled={disabled}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <FieldLabel className="!mb-0">Retorno já agendado?</FieldLabel>
          <Toggle
            checked={data.returnScheduled}
            onChange={(v) => set("returnScheduled", v)}
            color={color}
            disabled={disabled}
          />
        </div>
        <AnimatedReveal show={data.returnScheduled}>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <FieldLabel>Data do retorno</FieldLabel>
              <div className="relative min-w-0">
                <input
                  type="date"
                  value={data.returnDate ?? ""}
                  onChange={(e) =>
                    set("returnDate", e.target.value || undefined)
                  }
                  disabled={disabled}
                  className={`${inputClasses()} pr-10`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Calendar
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
            </div>
            <div className="min-w-0">
              <FieldLabel>Hora do retorno</FieldLabel>
              <div className="relative min-w-0">
                <input
                  type="time"
                  value={data.returnTime ?? ""}
                  onChange={(e) =>
                    set("returnTime", e.target.value || undefined)
                  }
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
            </div>
          </div>
        </AnimatedReveal>
      </div>
    </div>
  );
}
