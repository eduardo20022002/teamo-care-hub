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
  type KindFilter,
} from "@/components/search/SearchFilters";
import { SearchResultsGroup } from "@/components/search/SearchResultsGroup";
import { EmptySearch } from "@/components/search/EmptySearch";
import { RecordDetailsDialog } from "@/components/attendance/RecordDetailsDialog";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import {
  searchAll,
  type SearchHit,
  type SearchKind,
} from "@/services/search.service";
import { getAttachmentSignedUrl } from "@/services/attachments.service";
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

const KIND_ORDER: SearchKind[] = ["record", "professional", "document"];

function BuscaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [childFilter, setChildFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [openRecord, setOpenRecord] =
    useState<AttendanceRecordWithRelations | null>(null);

  const debounced = useDebounced(query, 200);
  const isReady = debounced.trim().length >= 2;

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  const searchQuery = useQuery({
    queryKey: [
      "global-search",
      debounced,
      childFilter,
      kindFilter,
    ],
    queryFn: () =>
      searchAll(debounced, {
        childId: childFilter === "all" ? undefined : childFilter,
        kinds: kindFilter === "all" ? undefined : [kindFilter as SearchKind],
      }),
    enabled: !!user && isReady,
  });

  const childrenList = childrenQuery.data ?? [];
  const results = searchQuery.data;

  const totalHits = useMemo(() => {
    if (!results) return 0;
    return KIND_ORDER.reduce((acc, k) => acc + results[k].length, 0);
  }, [results]);

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
          Encontre registros de atendimento, profissionais e documentos.
        </p>
      </header>

      <div className="mb-4">
        <SearchInput value={query} onChange={setQuery} />
      </div>

      <div className="mb-6">
        <SearchFilters
          childrenList={childrenList}
          childFilter={childFilter}
          onChildChange={setChildFilter}
          kindFilter={kindFilter}
          onKindChange={setKindFilter}
        />
      </div>

      {!isReady ? (
        <EmptySearch state="initial" />
      ) : searchQuery.isLoading ? (
        <LoadingSpinner />
      ) : searchQuery.isError ? (
        <div className="rounded-xl border border-dashed border-destructive/40 bg-card p-8 text-center text-sm text-muted-foreground">
          Não foi possível buscar agora. Tente novamente em instantes.
        </div>
      ) : !results || totalHits === 0 ? (
        <EmptySearch state="no-results" query={debounced} />
      ) : (
        <div className="space-y-6">
          {KIND_ORDER.map((kind) => (
            <SearchResultsGroup
              key={kind}
              kind={kind}
              hits={results[kind]}
              onSelect={handleSelect}
            />
          ))}
        </div>
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
