import { Check, Plus, X } from "lucide-react";
import type { ChecklistItem } from "@/types/agenda";

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

function newId() {
  // Curto, sem precisar de crypto.randomUUID em ambientes mais antigos
  return Math.random().toString(36).slice(2, 10);
}

export function ChecklistField({
  items,
  onChange,
  disabled,
  placeholder = "Ex.: Carteira de vacinação",
}: Props) {
  const updateLabel = (id: string, label: string) => {
    onChange(items.map((it) => (it.id === id ? { ...it, label } : it)));
  };
  const toggleDone = (id: string) => {
    onChange(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };
  const remove = (id: string) => onChange(items.filter((it) => it.id !== id));
  const add = () => onChange([...items, { id: newId(), label: "", done: false }]);

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleDone(it.id)}
            disabled={disabled}
            aria-label={it.done ? "Desmarcar item" : "Marcar item"}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] border transition-colors disabled:opacity-50"
            style={{
              background: it.done ? "#4F46E5" : "#F6F7FB",
              borderColor: it.done ? "#4F46E5" : "#E5E7EB",
            }}
          >
            {it.done && <Check size={14} strokeWidth={2.5} color="white" />}
          </button>
          <input
            type="text"
            value={it.label}
            onChange={(e) => updateLabel(it.id, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={120}
            className="h-9 flex-1 rounded-[9px] border border-[#E5E7EB] bg-[#F6F7FB] px-3 text-[13.5px] outline-none transition-all focus:border-[#4F46E5] focus:shadow-[0_0_0_3px_rgba(79,70,229,0.10)] disabled:opacity-60"
            style={{
              color: "#0F172A",
              textDecoration: it.done ? "line-through" : "none",
            }}
          />
          <button
            type="button"
            onClick={() => remove(it.id)}
            disabled={disabled}
            aria-label="Remover item"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] text-[#9CA3AF] transition-colors hover:bg-[#F4F5FA] hover:text-[#6B7280] disabled:opacity-50"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 self-start rounded-[9px] border border-dashed border-[#D1D5DB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B5563] transition-colors hover:border-[#9CA3AF] hover:text-[#374151] disabled:opacity-50"
      >
        <Plus size={14} strokeWidth={2} />
        Adicionar item
      </button>
    </div>
  );
}
