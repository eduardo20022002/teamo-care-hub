import { cn } from "@/lib/utils";
import type { Child } from "@/types/database";
import type { SearchKind } from "@/services/search.service";

export type KindFilter = "all" | SearchKind;

export interface SearchFiltersValue {
  childId: string; // "all" | id
  kind: KindFilter;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_SEARCH_FILTERS: SearchFiltersValue = {
  childId: "all",
  kind: "all",
  dateFrom: "",
  dateTo: "",
};

export function isSearchFiltersActive(v: SearchFiltersValue): boolean {
  return v.childId !== "all" || v.kind !== "all" || v.dateFrom !== "" || v.dateTo !== "";
}

// Quick period presets
type PeriodPreset = "all" | "7d" | "30d";

function toPeriodPreset(dateFrom: string, dateTo: string): PeriodPreset {
  if (!dateFrom && !dateTo) return "all";
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const from = new Date(dateFrom);
  if (Math.abs(from.getTime() - thirtyDaysAgo.getTime()) < 86400000 * 2) return "30d";
  if (Math.abs(from.getTime() - sevenDaysAgo.getTime()) < 86400000 * 2) return "7d";
  return "all";
}

function presetToDates(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
  if (preset === "all") return { dateFrom: "", dateTo: "" };
  const now = new Date();
  const days = preset === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 86400000);
  return {
    dateFrom: from.toISOString().split("T")[0],
    dateTo: now.toISOString().split("T")[0],
  };
}

// ─── Pill button ──────────────────────────────────────────────────────────────
function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
      )}
    >
      {children}
    </button>
  );
}

// ─── Badge count ──────────────────────────────────────────────────────────────
function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums font-semibold",
        active ? "bg-white/20 text-inherit" : "bg-foreground/10 text-foreground/70",
      )}
    >
      {n}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  value: SearchFiltersValue;
  onChange: (v: SearchFiltersValue) => void;
  childrenList: Child[];
  counts?: { all: number; record: number; document: number };
}

export function SearchFilters({ value, onChange, childrenList, counts }: Props) {
  const update = (patch: Partial<SearchFiltersValue>) => onChange({ ...value, ...patch });

  const periodPreset = toPeriodPreset(value.dateFrom, value.dateTo);

  const setPeriod = (preset: PeriodPreset) => {
    update(presetToDates(preset));
  };

  const KIND_OPTIONS: { id: KindFilter; label: string; count?: number }[] = [
    { id: "all", label: "Tudo", count: counts?.all },
    { id: "record", label: "Registros", count: counts?.record },
    { id: "document", label: "Documentos", count: counts?.document },
  ];

  const PERIOD_OPTIONS: { id: PeriodPreset; label: string }[] = [
    { id: "all", label: "Sempre" },
    { id: "7d", label: "Últimos 7 dias" },
    { id: "30d", label: "Últimos 30 dias" },
  ];

  return (
    <div className="space-y-4">
      {/* Tipo de conteúdo */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Tipo de conteúdo
        </p>
        <div className="flex flex-wrap gap-2">
          {KIND_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              active={value.kind === opt.id}
              onClick={() => update({ kind: opt.id })}
            >
              {opt.label}
              {opt.count != null && <Count n={opt.count} active={value.kind === opt.id} />}
            </Pill>
          ))}
        </div>
      </div>

      {/* Período */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Período
        </p>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Pill key={opt.id} active={periodPreset === opt.id} onClick={() => setPeriod(opt.id)}>
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Criança (só se houver múltiplas) */}
      {childrenList.length > 1 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Criança
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill active={value.childId === "all"} onClick={() => update({ childId: "all" })}>
              Todas
            </Pill>
            {childrenList.map((c) => (
              <Pill
                key={c.id}
                active={value.childId === c.id}
                onClick={() => update({ childId: c.id })}
              >
                {c.name}
              </Pill>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
