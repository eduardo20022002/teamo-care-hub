import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import {
  addChildDocuments,
  deleteUnifiedDocument,
  listAllDocuments,
  normalizeForSearch,
  type UnifiedDocument,
} from "@/services/documents.service";
import {
  DocumentFilters,
  type PeriodFilter,
  type SourceFilter,
  type TypeFilter,
} from "@/components/documents/DocumentFilters";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { AddChildDocumentDialog } from "@/components/documents/AddChildDocumentDialog";
import { EmptyDocuments } from "@/components/documents/EmptyDocuments";
import { DeleteAttachmentDialog } from "@/components/attachments/DeleteAttachmentDialog";

export const Route = createFileRoute("/_auth/documentos")({
  head: () => ({
    meta: [{ title: "Documentos — TEAmo" }],
  }),
  component: DocumentosPage,
});

function withinPeriod(createdAt: string, period: PeriodFilter): boolean {
  if (period === "all") return true;
  const created = new Date(createdAt);
  const now = new Date();
  if (period === "year") return created.getFullYear() === now.getFullYear();
  const days = period === "7d" ? 7 : 30;
  const limit = new Date(now.getTime() - days * 86400000);
  return created >= limit;
}

function matchesType(mime: string, type: TypeFilter): boolean {
  if (type === "all") return true;
  if (type === "pdf") return mime === "application/pdf";
  return mime.startsWith("image/");
}

function DocumentosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [childFilter, setChildFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<UnifiedDocument | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  const documentsQuery = useQuery({
    queryKey: ["documents-all"],
    queryFn: listAllDocuments,
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (vars: { childId: string; files: File[] }) =>
      addChildDocuments(user!.id, vars.childId, vars.files),
    onSuccess: ({ success, failed }) => {
      if (success > 0) {
        toast.success(
          success === 1
            ? "Documento enviado."
            : `${success} documentos enviados.`,
        );
        qc.invalidateQueries({ queryKey: ["documents-all"] });
        qc.invalidateQueries({ queryKey: ["child-attachments"] });
      }
      for (const f of failed) {
        toast.error(`${f.name}: ${f.error}`);
      }
      if (failed.length === 0) {
        setAddOpen(false);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (doc: UnifiedDocument) => deleteUnifiedDocument(doc),
    onSuccess: (_, doc) => {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey: ["documents-all"] });
      if (doc.source === "child") {
        qc.invalidateQueries({ queryKey: ["child-attachments", doc.child_id] });
      } else if (doc.record_id) {
        qc.invalidateQueries({
          queryKey: ["record-attachments", doc.record_id],
        });
        qc.invalidateQueries({
          queryKey: ["record-attachments-count", doc.record_id],
        });
      }
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const documents = documentsQuery.data ?? [];
  const childrenList = childrenQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search.trim());
    return documents.filter((d) => {
      if (childFilter !== "all" && d.child_id !== childFilter) return false;
      if (sourceFilter !== "all" && d.source !== sourceFilter) return false;
      if (!matchesType(d.mime_type, typeFilter)) return false;
      if (!withinPeriod(d.created_at, periodFilter)) return false;
      if (q && !normalizeForSearch(d.file_name).includes(q)) return false;
      return true;
    });
  }, [documents, childFilter, sourceFilter, typeFilter, periodFilter, search]);

  const isLoading = childrenQuery.isLoading || documentsQuery.isLoading;

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const hasAny = documents.length > 0;
  const hasChildren = childrenList.length > 0;

  return (
    <AppShell>
      <div className="mb-5">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Voltar ao início
        </Link>
      </div>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: "#F3E8FF" }}
          >
            <FolderOpen className="h-5 w-5" style={{ color: "#7C3AED" }} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-foreground leading-tight">
              Documentos
            </h1>
            <p className="text-xs text-muted-foreground">
              Laudos, relatórios e anexos — em um só lugar.
            </p>
          </div>
        </div>
        {hasChildren && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold text-white"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Adicionar</span>
          </button>
        )}
      </header>

      {hasAny && (
        <div className="mb-6">
          <DocumentFilters
            childrenList={childrenList}
            childFilter={childFilter}
            onChildChange={setChildFilter}
            sourceFilter={sourceFilter}
            onSourceChange={setSourceFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            periodFilter={periodFilter}
            onPeriodChange={setPeriodFilter}
            search={search}
            onSearchChange={setSearch}
          />
        </div>
      )}

      {!hasAny ? (
        <EmptyDocuments
          hasChildren={hasChildren}
          onAdd={() => setAddOpen(true)}
        />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum documento encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((doc) => (
            <DocumentCard
              key={`${doc.source}-${doc.id}`}
              doc={doc}
              onDelete={(d) => setDeleting(d)}
              deleting={
                deleteMutation.isPending && deleting?.id === doc.id
              }
            />
          ))}
        </div>
      )}

      <AddChildDocumentDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        childrenList={childrenList}
        onConfirm={async (childId, files) => {
          await addMutation.mutateAsync({ childId, files });
        }}
        submitting={addMutation.isPending}
      />

      <DeleteAttachmentDialog
        open={!!deleting}
        fileName={deleting?.file_name}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        loading={deleteMutation.isPending}
      />
    </AppShell>
  );
}
