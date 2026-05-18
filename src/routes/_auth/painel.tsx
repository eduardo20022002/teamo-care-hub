import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LayoutDashboard, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { AttendanceCard } from "@/components/attendance/AttendanceCard";
import { AttendanceFormDialog } from "@/components/attendance/AttendanceFormDialog";
import { DeleteAttendanceDialog } from "@/components/attendance/DeleteAttendanceDialog";
import { EmptyAttendance } from "@/components/attendance/EmptyAttendance";
import {
  RecordFilters,
  EMPTY_RECORD_FILTERS,
  isRecordFiltersActive,
  type RecordFiltersValue,
} from "@/components/attendance/RecordFilters";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import {
  createAttendanceRecord,
  deleteAttendanceRecord,
  listAttendanceRecords,
  updateAttendanceRecord,
  type AttendanceRecordWithRelations,
} from "@/services/attendance.service";
import { listAgendaEvents } from "@/services/agenda/events.service";
import { listObservationsByEvent } from "@/services/agenda/observations.service";
import { useEffect } from "react";
import {
  countRecordAttachments,
  uploadRecordAttachment,
} from "@/services/attachments.service";
import type { AttendanceRecordInput } from "@/lib/validation";

interface PainelSearch {
  prefillFromEvent?: string;
  prefillObsId?: string;
}

export const Route = createFileRoute("/_auth/painel")({
  head: () => ({
    meta: [{ title: "Painel — TEAmo" }],
  }),
  validateSearch: (search: Record<string, unknown>): PainelSearch => ({
    prefillFromEvent:
      typeof search.prefillFromEvent === "string"
        ? search.prefillFromEvent
        : undefined,
    prefillObsId:
      typeof search.prefillObsId === "string" ? search.prefillObsId : undefined,
  }),
  component: PainelPage,
});

function PainelPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { prefillFromEvent, prefillObsId } = Route.useSearch();

  const [filters, setFilters] = useState<RecordFiltersValue>(EMPTY_RECORD_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecordWithRelations | null>(null);
  const [deleting, setDeleting] = useState<AttendanceRecordWithRelations | null>(null);
  const [prefill, setPrefill] = useState<{
    childId?: string;
    professionalId?: string | null;
    professionalName?: string;
    content?: string;
    recordDate?: string;
  } | null>(null);

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });
  const recordsQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: listAttendanceRecords,
    enabled: !!user,
  });

  // Pré-fill quando vem de "Virar registro" numa obs / "Registrar atendimento" no detalhe
  const eventsForPrefillQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: listAgendaEvents,
    enabled: !!user && !!prefillFromEvent,
  });
  const obsForPrefillQuery = useQuery({
    queryKey: ["agenda-obs-prefill", prefillFromEvent],
    queryFn: () => listObservationsByEvent(prefillFromEvent!),
    enabled: !!user && !!prefillFromEvent,
  });

  useEffect(() => {
    if (!prefillFromEvent) return;
    const ev = eventsForPrefillQuery.data?.find(
      (e) => e.id === prefillFromEvent,
    );
    if (!ev) return;
    let content = "";
    if (prefillObsId) {
      const obs = obsForPrefillQuery.data?.find((o) => o.id === prefillObsId);
      if (obs) content = obs.text;
    } else if (obsForPrefillQuery.data) {
      content = obsForPrefillQuery.data.map((o) => `• ${o.text}`).join("\n");
    }
    setPrefill({
      childId: ev.child_id,
      professionalId: ev.professional?.id ?? null,
      professionalName:
        ev.professional?.name ?? ev.professional_name_raw ?? "",
      recordDate: ev.start_at.slice(0, 10),
      content,
    });
    setEditing(null);
    setFormOpen(true);
  }, [
    prefillFromEvent,
    prefillObsId,
    eventsForPrefillQuery.data,
    obsForPrefillQuery.data,
  ]);

  const createMutation = useMutation({
    mutationFn: async (vars: {
      input: AttendanceRecordInput;
      pendingFiles?: File[];
    }) => {
      const record = await createAttendanceRecord(user!.id, vars.input);
      const files = vars.pendingFiles ?? [];
      let success = 0;
      const failed: string[] = [];
      for (const file of files) {
        try {
          await uploadRecordAttachment(user!.id, record.id, file);
          success++;
        } catch (e) {
          failed.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      return { attachmentSuccess: success, attachmentFailed: failed };
    },
    onSuccess: ({ attachmentSuccess, attachmentFailed }) => {
      toast.success("Registro criado.");
      if (attachmentSuccess > 0) {
        toast.success(
          attachmentSuccess === 1
            ? "Anexo enviado."
            : `${attachmentSuccess} anexos enviados.`,
        );
      }
      for (const msg of attachmentFailed) toast.error(msg);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["documents-all"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: AttendanceRecordInput }) =>
      updateAttendanceRecord(vars.id, vars.input),
    onSuccess: () => {
      toast.success("Registro atualizado.");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttendanceRecord(id),
    onSuccess: (_data, id) => {
      toast.success("Registro excluído.");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["record-attachments", id] });
      qc.invalidateQueries({ queryKey: ["record-attachments-count", id] });
      qc.invalidateQueries({ queryKey: ["documents-all"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletingAttachmentsQuery = useQuery({
    queryKey: ["record-attachments-count", deleting?.id],
    queryFn: () => countRecordAttachments(deleting!.id),
    enabled: !!deleting,
  });

  const records = recordsQuery.data ?? [];
  const childrenList = childrenQuery.data ?? [];
  const professionalsList = professionalsQuery.data ?? [];

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filters.childId !== "all" && r.child_id !== filters.childId) return false;
      if (filters.professionalId === "none") {
        if (r.professional_id !== null) return false;
      } else if (filters.professionalId !== "all") {
        if (r.professional_id !== filters.professionalId) return false;
      }
      if (filters.category !== "all" && r.category !== filters.category) return false;
      if (filters.dateFrom && r.record_date < filters.dateFrom) return false;
      if (filters.dateTo && r.record_date > filters.dateTo) return false;
      return true;
    });
  }, [records, filters]);

  const isLoading =
    childrenQuery.isLoading ||
    professionalsQuery.isLoading ||
    recordsQuery.isLoading;

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const hasAny = records.length > 0;
  const filtersActive = isRecordFiltersActive(filters);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSubmit = async (
    data: AttendanceRecordInput,
    pendingFiles?: File[],
  ) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, input: data });
    } else {
      await createMutation.mutateAsync({ input: data, pendingFiles });
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

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground md:text-3xl">
            <LayoutDashboard
              className="h-6 w-6 text-primary"
              strokeWidth={1.75}
            />
            Painel de registros
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada de todos os atendimentos com filtros.
          </p>
        </div>
        {hasAny && childrenList.length > 0 && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-1 h-4 w-4" strokeWidth={2} />
            Novo registro
          </Button>
        )}
      </header>

      {hasAny && (
        <div className="mb-6">
          <RecordFilters
            value={filters}
            onChange={setFilters}
            childrenList={childrenList}
            professionals={professionalsList}
          />
        </div>
      )}

      {!hasAny ? (
        <EmptyAttendance onAdd={handleOpenCreate} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-foreground">
            Nenhum registro encontrado para os filtros aplicados.
          </p>
          {filtersActive && (
            <Button
              variant="ghost"
              onClick={() => setFilters(EMPTY_RECORD_FILTERS)}
              className="mt-2 text-primary hover:text-primary"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            {filtered.length}{" "}
            {filtered.length === 1 ? "registro encontrado" : "registros encontrados"}
            {filtersActive ? " com os filtros aplicados" : ""}.
          </p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((r) => (
              <AttendanceCard
                key={r.id}
                record={r}
                showChild
                onEdit={(rec) => {
                  setEditing(rec);
                  setFormOpen(true);
                }}
                onDelete={(rec) => setDeleting(rec)}
              />
            ))}
          </div>
        </>
      )}

      <AttendanceFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            setPrefill(null);
          }
        }}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        childrenList={childrenList}
        professionals={professionalsList}
        initial={editing}
        prefill={prefill}
      />

      <DeleteAttendanceDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
        attachmentCount={deletingAttachmentsQuery.data ?? 0}
      />
    </AppShell>
  );
}
