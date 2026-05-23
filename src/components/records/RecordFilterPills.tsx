import { RECORD_TYPE_CONFIG, RECORD_TYPES, type RecordType } from "@/lib/validation";

interface Props {
  value: "all" | RecordType;
  onChange: (v: "all" | RecordType) => void;
  counts: Partial<Record<RecordType | "all", number>>;
}

export function RecordFilterPills({ value, onChange, counts }: Props) {
  const pills: { key: "all" | RecordType; label: string; color?: string; tint?: string }[] = [
    { key: "all", label: `Todos${counts.all != null ? ` · ${counts.all}` : ""}` },
    ...RECORD_TYPES.map((t) => ({
      key: t as RecordType,
      label: RECORD_TYPE_CONFIG[t].label,
      color: RECORD_TYPE_CONFIG[t].color,
      tint: RECORD_TYPE_CONFIG[t].tint,
    })),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {pills.map(({ key, label, color, tint }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
            style={
              active
                ? {
                    background: key === "all" ? "#EC4899" : color,
                    borderColor: key === "all" ? "#EC4899" : color,
                    color: "#fff",
                  }
                : {
                    background: "#fff",
                    borderColor: "#E5E7EB",
                    color: "#6B7280",
                  }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
