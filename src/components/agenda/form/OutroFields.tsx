import type { OutroTypeData } from "@/types/agenda";
import { FieldLabel } from "./primitives/FieldLabel";

interface Props {
  data: OutroTypeData;
  onChange: (d: OutroTypeData) => void;
  disabled?: boolean;
}

export function OutroFields({ data, onChange, disabled }: Props) {
  return (
    <div>
      <FieldLabel optional>Observações</FieldLabel>
      <textarea
        value={data.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value || undefined })}
        placeholder="Detalhes do compromisso"
        disabled={disabled}
        maxLength={2000}
        rows={3}
        className="w-full rounded-xl border border-[#E5E7EB] bg-[#F6F7FB] px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)] disabled:opacity-60"
        style={{ color: "#0F172A", resize: "vertical" }}
      />
    </div>
  );
}
