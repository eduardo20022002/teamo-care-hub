import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type { EscolaKind, EscolaTypeData } from "@/types/agenda";
import { ChipGroup } from "./primitives/ChipGroup";
import { ChecklistField } from "./primitives/ChecklistField";
import { FieldLabel } from "./primitives/FieldLabel";

const KIND_OPTIONS: { value: EscolaKind; label: string }[] = [
  { value: "aee", label: "Reunião AEE" },
  { value: "parents", label: "Reunião de pais" },
  { value: "event", label: "Evento" },
  { value: "council", label: "Conselho de classe" },
  { value: "other", label: "Outro" },
];

interface Props {
  data: EscolaTypeData;
  onChange: (d: EscolaTypeData) => void;
  disabled?: boolean;
}

export function EscolaFields({ data, onChange, disabled }: Props) {
  const color = TYPE_STYLES.escola.col;
  const tint = TYPE_STYLES.escola.tint;
  const set = <K extends keyof EscolaTypeData>(k: K, v: EscolaTypeData[K]) =>
    onChange({ ...data, [k]: v });
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <FieldLabel>Tipo de evento escolar</FieldLabel>
        <ChipGroup
          options={KIND_OPTIONS}
          value={data.eventType}
          onChange={(v) => set("eventType", v)}
          activeColor={color}
          activeTint={tint}
          customValue="other"
          customInput={data.eventTypeCustom ?? ""}
          onCustomInputChange={(v) => set("eventTypeCustom", v)}
          customPlaceholder="Outro tipo de evento"
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
    </div>
  );
}
