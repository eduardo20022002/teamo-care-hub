import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { SearchInput } from "@/components/search/SearchInput";
import {
  SearchFilters,
  EMPTY_SEARCH_FILTERS,
  isSearchFiltersActive,
  type SearchFiltersValue,
} from "@/components/search/SearchFilters";
import { SearchResultItem } from "@/components/search/SearchResultItem";
import { EmptySearch } from "@/components/search/EmptySearch";
import { RecordDetailsDialog } from "@/components/attendance/RecordDetailsDialog";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import {
  flattenAndSortByDate,
  searchAll,
  type SearchHit,
  type SearchKind,
} from "@/services/search.service";
import { getAttachmentSignedUrl } from "@/services/attachments.service";
import { normalizeForSearch } from "@/services/documents.service";
import type { AttendanceRecordWithRelations } from "@/services/attendance.service";

export const Route = createFileRoute("/_auth/busca")({
  head: () => ({
    meta: [{ title: "Buscar — TEAmo" }],
  }),
  component: BuscaPage,
});

function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Section header for grouped results ──────────────────────────────────────
const GROUP_COLORS: Record<string, string> = {
  record: "text-rose-500",
  document: "text-indigo-500",
  professional: "text-emerald-600",
};

const GROUP_ICONS: Record<string, string> = {
  record: "📦",
  document: "📁",
  professional: "👤",
};

const GROUP_LABELS: Record<string, string> = {
  record: "REGISTROS",
  document: "DOCUMENTOS",
  professional: "PROFISSIONAIS",
};

function GroupHeader({ kind, count }: { kind: string; count: number }) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${GROUP_COLORS[kind] ?? "text-muted-foreground"}`}
    >
      <span>{GROUP_ICONS[kind] ?? "•"}</span>
      {GROUP_LABELS[kind] ?? kind} · {count}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function BuscaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFiltersValue>(EMPTY_SEARCH_FILTERS);
  const [openRecord, setOpenRecord] = useState<AttendanceRecordWithRelations | null>(null);

  const debouncedQuery = useDebounced(query, 200);

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  const kinds: SearchKind[] | undefined =
    filters.kind === "all" ? undefined : [filters.kind as SearchKind];

  const searchQuery = useQuery({
    queryKey: ["global-search", filters.childId, filters.kind, filters.dateFrom, filters.dateTo],
    queryFn: () =>
      searchAll("", {
        childId: filters.childId === "all" ? undefined : filters.childId,
        kinds,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      }),
    enabled: !!user,
  });

  const childrenList = childrenQuery.data ?? [];
  const results = searchQuery.data;

  const allHits = useMemo(() => (results ? flattenAndSortByDate(results) : []), [results]);

  const visibleHits = useMemo(() => {
    const q = normalizeForSearch(debouncedQuery.trim());
    if (!q) return allHits;
    return allHits.filter((h) => {
      const haystack = normalizeForSearch(`${h.title} ${h.subtitle ?? ""}`);
      return haystack.includes(q);
    });
  }, [allHits, debouncedQuery]);

  // Counts per kind for filter pills
  const counts = useMemo(
    () => ({
      all: allHits.length,
      record: allHits.filter((h) => h.kind === "record").length,
      document: allHits.filter((h) => h.kind === "document").length,
    }),
    [allHits],
  );

  // Group visible hits by kind
  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const h of visibleHits) {
      const arr = map.get(h.kind) ?? [];
      arr.push(h);
      map.set(h.kind, arr);
    }
    return map;
  }, [visibleHits]);

  const handleSelect = async (hit: SearchHit) => {
    if (hit.payload.kind === "record") {
      setOpenRecord(hit.payload.record);
      return;
    }
    if (hit.payload.kind === "professional") {
      navigate({ to: "/profissionais" });
      return;
    }
    if (hit.payload.kind === "document") {
      try {
        const url = await getAttachmentSignedUrl(hit.payload.doc.storage_path);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        toast.error("Não foi possível abrir o documento.");
      }
    }
  };

  const filtersActive = isSearchFiltersActive(filters);
  const hasAnyData = allHits.length > 0 || filtersActive;

  return (
    <AppShell>
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Voltar ao início
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground md:text-3xl">
          <Search className="h-6 w-6 text-primary" strokeWidth={1.75} />
          Buscar no histórico
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre registros, profissionais, documentos e compromissos. Use os filtros pra refinar.
        </p>
      </header>

      <div className="mb-4">
        <SearchInput value={query} onChange={setQuery} />
      </div>

      <div className="mb-6">
        <SearchFilters
          value={filters}
          onChange={setFilters}
          childrenList={childrenList}
          counts={counts}
        />
      </div>

      {searchQuery.isLoading ? (
        <LoadingSpinner />
      ) : searchQuery.isError ? (
        <div className="rounded-xl border border-dashed border-destructive/40 bg-card p-8 text-center text-sm text-muted-foreground">
          Não foi possível buscar agora. Tente novamente em instantes.
        </div>
      ) : !hasAnyData ? (
        <EmptySearch state="no-data" />
      ) : visibleHits.length === 0 ? (
        <EmptySearch state="no-results" query={debouncedQuery.trim() || undefined} />
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {visibleHits.length}{" "}
            {visibleHits.length === 1 ? "resultado encontrado" : "resultados encontrados"}
            {debouncedQuery.trim() ? ` para "${debouncedQuery.trim()}"` : ""}
            {" · ordenados por relevância"}
          </p>

          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([kind, hits]) => (
              <div key={kind}>
                <GroupHeader kind={kind} count={hits.length} />
                <div className="mt-2 space-y-2">
                  {hits.map((hit) => (
                    <SearchResultItem
                      key={`${hit.kind}-${hit.id}`}
                      hit={hit}
                      onClick={() => void handleSelect(hit)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <RecordDetailsDialog
        record={openRecord}
        open={!!openRecord}
        onOpenChange={(o) => {
          if (!o) setOpenRecord(null);
        }}
      />
    </AppShell>
  );
}
