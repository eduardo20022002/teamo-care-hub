import { createFileRoute, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import {
  listDiaryRecords,
  createDiaryRecord,
  updateDiaryRecord,
  deleteAttendanceRecord,
  type DiaryRecordWithRelations,
} from "@/services/attendance.service";
import { uploadRecordAttachment } from "@/services/attachments.service";
import { type RecordType, type DiaryRecordInput } from "@/lib/validation";
import { RecordFilterPills } from "@/components/records/RecordFilterPills";
import { RecordCard } from "@/components/records/RecordCard";
import { RecordTypePicker } from "@/components/records/RecordTypePicker";
import { RecordFormSheet } from "@/components/records/RecordFormSheet";
import { RecordDetailSheet } from "@/components/records/RecordDetailSheet";
import { DeleteAttendanceDialog } from "@/components/attendance/DeleteAttendanceDialog";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { countRecordAttachments } from "@/services/attachments.service";
import { track } from "@/lib/analytics";
import { usePlan } from "@/services/subscription.service";
import { useUpgrade } from "@/components/premium/PremiumGate";
import { UsageBar } from "@/components/premium/UsageBar";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

export const Route = createFileRoute("/_auth/registros")({
  head: () => ({
    meta: [{ title: "Registros — TEAmo" }],
  }),
  validateSearch: z.object({
    new: z.string().optional(),
    childId: z.string().optional(),
  }).parse,
  component: RegistrosPage,
});

// ─── Date header formatting ──────────────────────────────────────────────────
const MONTHS_SHORT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function formatDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);
  const shortDate = `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]}`;
  if (diff === 0) return `HOJE · ${shortDate}`;
  if (diff === 1) return `ONTEM · ${shortDate}`;
  return shortDate;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function RegistrosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { isParentPremium, parentLimits } = usePlan();
  const { openUpgrade } = useUpgrade();
  const openNew = new URLSearchParams(location.search).get("new") === "1";
  // Captura uma única vez no mount (antes de navigate limpar a URL)
  const [savedDefaultChildId] = useState<string | undefined>(
    () => new URLSearchParams(location.search).get("childId") ?? undefined,
  );

  // UI state
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<RecordType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DiaryRecordWithRelations | null>(null);
  const [detailRecord, setDetailRecord] = useState<DiaryRecordWithRelations | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<DiaryRecordWithRelations | null>(null);
  const [shareRecord, setShareRecord] = useState<DiaryRecordWithRelations | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | RecordType>("all");

  // Ref para distinguir fechamento do picker por seleção vs cancelamento
  const typeJustSelectedRef = useRef(false);

  // Analytics: módulo aberto
  useEffect(() => {
    track("module.open", { module: "registros", route: "/registros" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open type picker when coming from dashboard "Registrar"
  useEffect(() => {
    if (openNew) {
      setTypePickerOpen(true);
      // Clean the search params so back/refresh doesn't re-open
      void navigate({ to: "/registros", replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Queries
  const childrenQuery = useQuery({ queryKey: ["children"], queryFn: listChildren, enabled: !!user });
  const profsQuery = useQuery({ queryKey: ["professionals"], queryFn: listProfessionals, enabled: !!user });
  const recordsQuery = useQuery({ queryKey: ["diary-records"], queryFn: () => listDiaryRecords(), enabled: !!user });

  // Gate freemium do responsável: free = até 10 registros.
  const recordCount = recordsQuery.data?.length ?? 0;
  const atRecordLimit = !isParentPremium && recordCount >= parentLimits.records;
  const handleNewRecord = () => {
    if (atRecordLimit) {
      openUpgrade("registros");
      return;
    }
    setTypePickerOpen(true);
  };

  // Attachment count for delete dialog
  const attachCountQuery = useQuery({
    queryKey: ["record-attachments-count", deletingRecord?.id],
    queryFn: () => countRecordAttachments(deletingRecord!.id),
    enabled: !!deletingRecord,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (vars: { input: DiaryRecordInput; files: File[] }) => {
      const record = await createDiaryRecord(user!.id, vars.input);
      // Anexos: não engolir falhas — o usuário precisa saber se um vídeo/foto
      // não subiu (formato, tamanho, conexão). Reporta cada arquivo que falhou.
      const failed: string[] = [];
      for (const file of vars.files) {
        try {
          await uploadRecordAttachment(user!.id, record.id, file);
        } catch (e) {
          failed.push(`${file.name}: ${(e as Error).message ?? "Falha no envio."}`);
        }
      }
      return { record, failed };
    },
    onSuccess: ({ failed }, vars) => {
      track("record.create", {
        module: "registros",
        properties: { record_type: vars.input.record_type },
      });
      if (failed.length > 0) {
        toast.success("Registro criado.");
        for (const msg of failed) toast.error(`Anexo não enviado — ${msg}`);
      } else {
        toast.success("Registro criado.");
      }
      qc.invalidateQueries({ queryKey: ["diary-records"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setFormOpen(false);
      setSelectedType(null);
    },
    onError: (e: Error) => {
      // Backstop: o trigger do banco bloqueia o 11º registro no free.
      if (e.message.includes("PREMIUM_REQUIRED")) {
        setFormOpen(false);
        openUpgrade("registros");
        return;
      }
      toast.error(e.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: DiaryRecordInput }) =>
      updateDiaryRecord(vars.id, vars.input),
    onSuccess: () => {
      toast.success("Registro atualizado.");
      qc.invalidateQueries({ queryKey: ["diary-records"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setFormOpen(false);
      setEditingRecord(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAttendanceRecord(id),
    onSuccess: (_data, id) => {
      toast.success("Registro excluído.");
      qc.invalidateQueries({ queryKey: ["diary-records"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["record-attachments-count", id] });
      setDeletingRecord(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Data
  const records = recordsQuery.data ?? [];
  const childrenList = childrenQuery.data ?? [];
  const professionals = profsQuery.data ?? [];
  const isLoading = childrenQuery.isLoading || recordsQuery.isLoading;

  // Filter + group
  const filtered = useMemo(() =>
    typeFilter === "all"
      ? records
      : records.filter((r) => r.record_type === typeFilter),
    [records, typeFilter],
  );

  const grouped = useMemo(() => {
    const byDate = new Map<string, DiaryRecordWithRelations[]>();
    for (const r of filtered) {
      const list = byDate.get(r.record_date) ?? [];
      list.push(r);
      byDate.set(r.record_date, list);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  }, [filtered]);

  // Counts for pills
  const counts = useMemo(() => {
    const c: Partial<Record<RecordType | "all", number>> = { all: records.length };
    for (const r of records) {
      if (r.record_type) {
        c[r.record_type as RecordType] = (c[r.record_type as RecordType] ?? 0) + 1;
      }
    }
    return c;
  }, [records]);

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const handleTypeSelected = (type: RecordType) => {
    typeJustSelectedRef.current = true; // sinaliza: fechou por seleção, não por cancel
    setSelectedType(type);
    setEditingRecord(null);
    setFormOpen(true);
  };

  const handleEditRecord = (record: DiaryRecordWithRelations) => {
    setSelectedType(record.record_type as RecordType);
    setEditingRecord(record);
    setFormOpen(true);
  };

  const handleSave = async (input: DiaryRecordInput, files: File[]) => {
    if (editingRecord) {
      await updateMutation.mutateAsync({ id: editingRecord.id, input });
    } else {
      await createMutation.mutateAsync({ input, files });
    }
  };

  const hasAny = records.length > 0;

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

      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: "#FDF2F8" }}
          >
            <ClipboardList className="h-5 w-5" style={{ color: "#EC4899" }} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-foreground leading-tight">
              Registros
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasAny && (
            <button
              type="button"
              aria-label="Buscar registros"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#EEF0F4] bg-white text-muted-foreground hover:bg-[#F6F7FB]"
            >
              <Search className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
          {childrenList.length > 0 && (
            <button
              type="button"
              onClick={handleNewRecord}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white"
              style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
              aria-label="Novo registro"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </header>

      {/* Indicador de uso (plano gratuito do responsável) */}
      {!isParentPremium && childrenList.length > 0 && (
        <UsageBar
          used={recordCount}
          total={parentLimits.records}
          noun={["registro", "registros"]}
          onUpgrade={() => openUpgrade("registros")}
        />
      )}

      {/* Filter pills */}
      {hasAny && (
        <div className="mb-5">
          <RecordFilterPills
            value={typeFilter}
            onChange={setTypeFilter}
            counts={counts}
          />
        </div>
      )}

      {/* List */}
      {!hasAny ? (
        <div className="flex flex-col items-center gap-5 py-12 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[20px]"
            style={{ background: "#FDF2F8" }}
          >
            <ClipboardList className="h-7 w-7" style={{ color: "#EC4899" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">
              Nenhum registro ainda
            </p>
            <p className="mt-1 text-sm text-muted-foreground max-w-[280px]">
              Toque no + para registrar comportamentos, conquistas, sono e muito mais.
            </p>
          </div>
          {childrenList.length > 0 && (
            <button
              type="button"
              onClick={handleNewRecord}
              className="flex h-[50px] w-full max-w-[260px] items-center justify-center gap-2 rounded-[12px] text-sm font-semibold text-white"
              style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Criar primeiro registro
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum registro encontrado para esse tipo.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, items }) => (
            <section key={date}>
              {/* Date group header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#EC4899]" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatDateHeader(date)}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    onClick={setDetailRecord}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Type picker → Form */}
      <RecordTypePicker
        open={typePickerOpen}
        onOpenChange={setTypePickerOpen}
        onSelect={handleTypeSelected}
      />

      {selectedType && (
        <RecordFormSheet
          open={formOpen}
          onOpenChange={(o) => {
            setFormOpen(o);
            if (!o) { setEditingRecord(null); }
          }}
          recordType={selectedType}
          childrenList={childrenList}
          professionals={professionals}
          initial={editingRecord}
          defaultChildId={editingRecord ? undefined : savedDefaultChildId}
          onSave={handleSave}
          submitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Detail sheet */}
      <RecordDetailSheet
        record={detailRecord}
        open={!!detailRecord}
        onOpenChange={(o) => { if (!o) setDetailRecord(null); }}
        onEdit={handleEditRecord}
        onShare={(r) => setShareRecord(r)}
        onDelete={(r) => setDeletingRecord(r)}
      />

      {/* Delete confirmation */}
      <DeleteAttendanceDialog
        open={!!deletingRecord}
        onOpenChange={(o) => { if (!o) setDeletingRecord(null); }}
        onConfirm={() => deletingRecord && deleteMutation.mutate(deletingRecord.id)}
        loading={deleteMutation.isPending}
        attachmentCount={attachCountQuery.data ?? 0}
      />

      {/* Share dialog */}
      {shareRecord && (
        <ShareDialog
          open={!!shareRecord}
          onOpenChange={(o) => { if (!o) setShareRecord(null); }}
          preSelectedRecordIds={[shareRecord.id]}
        />
      )}
    </AppShell>
  );
}
