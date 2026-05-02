import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttendanceCard } from "@/components/attendance/AttendanceCard";
import { AttendanceFormDialog } from "@/components/attendance/AttendanceFormDialog";
import { DeleteAttendanceDialog } from "@/components/attendance/DeleteAttendanceDialog";
import { EmptyAttendance } from "@/components/attendance/EmptyAttendance";
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
import { uploadRecordAttachment } from "@/services/attachments.service";
import { formatDateRelative } from "@/lib/formatters";
import type { AttendanceRecordInput } from "@/lib/validation";

export const Route = createFileRoute("/_auth/registros")({
  head: () => ({
    meta: [{ title: "Registros — TEAmo" }],
  }),
  component: RegistrosPage,
});

function RegistrosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecordWithRelations | null>(
    null,
  );
  const [deleting, setDeleting] = useState<AttendanceRecordWithRelations | null>(
    null,
  );
  const [childFilter, setChildFilter] = useState<string>("all");

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
    onSuccess: () => {
      toast.success("Registro excluído.");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const records = recordsQuery.data ?? [];
  const filtered = useMemo(
    () =>
      childFilter === "all"
        ? records
        : records.filter((r) => r.child_id === childFilter),
    [records, childFilter],
  );

  // Agrupa por criança → data
  const grouped = useMemo(() => {
    const byChild = new Map<
      string,
      {
        childName: string;
        byDate: Map<string, AttendanceRecordWithRelations[]>;
      }
    >();
    for (const r of filtered) {
      const childName = r.child?.name ?? "Sem criança";
      if (!byChild.has(r.child_id)) {
        byChild.set(r.child_id, { childName, byDate: new Map() });
      }
      const grp = byChild.get(r.child_id)!;
      const list = grp.byDate.get(r.record_date) ?? [];
      list.push(r);
      grp.byDate.set(r.record_date, list);
    }
    return Array.from(byChild.entries()).map(([childId, { childName, byDate }]) => ({
      childId,
      childName,
      dates: Array.from(byDate.entries())
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([date, items]) => ({ date, items })),
    }));
  }, [filtered]);

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

  const childrenList = childrenQuery.data ?? [];
  const professionalsList = professionalsQuery.data ?? [];
  const hasAny = records.length > 0;

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
            <ClipboardList className="h-6 w-6 text-primary" strokeWidth={1.75} />
            Registros de atendimento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Histórico de orientações, observações, condutas e evoluções.
          </p>
        </div>
        {hasAny && childrenList.length > 0 && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-1 h-4 w-4" strokeWidth={2} />
            Novo registro
          </Button>
        )}
      </header>

      {hasAny && childrenList.length > 1 && (
        <div className="mb-6 max-w-xs">
          <Select value={childFilter} onValueChange={setChildFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as crianças</SelectItem>
              {childrenList.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!hasAny ? (
        <EmptyAttendance onAdd={handleOpenCreate} />
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum registro para o filtro selecionado.
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.childId}>
              <h2 className="mb-3 text-base font-semibold text-foreground">
                {group.childName}
              </h2>
              <div className="space-y-5">
                {group.dates.map(({ date, items }) => (
                  <div key={date}>
                    <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {formatDateRelative(date)}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {items.map((r) => (
                        <AttendanceCard
                          key={r.id}
                          record={r}
                          onEdit={(rec) => {
                            setEditing(rec);
                            setFormOpen(true);
                          }}
                          onDelete={(rec) => setDeleting(rec)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <AttendanceFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        childrenList={childrenList}
        professionals={professionalsList}
        initial={editing}
      />

      <DeleteAttendanceDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </AppShell>
  );
}
