import type { Child } from "@/types/database";
import { CATEGORIES } from "./AddChildDocumentDialog";

export type CategoryFilter = "all" | "laudo" | "relatorio" | "prescricao" | "escolar" | "outros";

interface Props {
  childrenList: Child[];
  childFilter: string;
  onChildChange: (v: string) => void;
  categoryFilter: CategoryFilter;
  onCategoryChange: (v: CategoryFilter) => void;
}

export function DocumentFilters({
  childrenList,
  childFilter,
  onChildChange,
  categoryFilter,
  onCategoryChange,
}: Props) {
  const showChildFilter = childrenList.length > 1;

  return (
    <div className="flex flex-wrap gap-2">
      {/* Filtro de criança — só aparece quando há mais de uma */}
      {showChildFilter && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChildChange("all")}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            style={
              childFilter === "all"
                ? { background: "#4F46E5", borderColor: "#4F46E5", color: "#fff" }
                : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#374151" }
            }
          >
            Todas
          </button>
          {childrenList.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChildChange(c.id)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                childFilter === c.id
                  ? { background: "#4F46E5", borderColor: "#4F46E5", color: "#fff" }
                  : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#374151" }
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Separador visual entre os dois grupos */}
      {showChildFilter && (
        <div className="w-full border-t border-[#EEF0F4]" />
      )}

      {/* Filtro de categoria */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onCategoryChange("all")}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
          style={
            categoryFilter === "all"
              ? { background: "#7C3AED", borderColor: "#7C3AED", color: "#fff" }
              : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#374151" }
          }
        >
          Todas categorias
        </button>
        {CATEGORIES.map((cat) => {
          const active = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id as CategoryFilter)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all"
              style={
                active
                  ? { background: cat.activeBg, borderColor: cat.activeBorder, color: "inherit" }
                  : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#374151" }
              }
            >
              <span className={active ? cat.color : ""}>
                {cat.emoji} {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
