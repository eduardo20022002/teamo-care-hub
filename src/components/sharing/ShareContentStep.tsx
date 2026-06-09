import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Image as ImageIcon,
  List,
  Search,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RECORD_TYPE_CONFIG, RECORD_TYPES, type RecordType } from "@/lib/validation";
import { RecordTypeChip } from "@/components/records/RecordTypeChip";
import { RecordDetailSheet } from "@/components/records/RecordDetailSheet";
import { ShareDocumentPreviewSheet } from "./ShareDocumentPreviewSheet";
import { normalizeForSearch, type UnifiedDocument } from "@/services/documents.service";
import type { DiaryRecordWithRelations } from "@/services/attendance.service";
import { CATEGORIES } from "@/components/documents/AddChildDocumentDialog";
import { formatDateBR, formatFileSize } from "@/lib/formatters";

// ── helpers ───────────────────────────────────────────────────────────────────

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

// ── MonthCalendar ─────────────────────────────────────────────────────────────

function MonthCalendar({
  calMonth,
  setCalMonth,
  recordsByDate,
  selectedDay,
  setSelectedDay,
}: {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  recordsByDate: Map<string, DiaryRecordWithRelations[]>;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
}) {
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const days = getCalendarDays(year, month);
  const today = toIsoDate(new Date());
  const monthLabel = calMonth.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCalMonth(new Date(year, month - 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#F3F4F8]"
        >
          <ChevronLeft size={14} strokeWidth={2.5} />
        </button>
        <span className="text-[12.5px] font-semibold capitalize text-[#374151]">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => setCalMonth(new Date(year, month + 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-[#F3F4F8]"
        >
          <ChevronRight size={14} strokeWidth={2.5} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span
            key={i}
            className="py-1 text-center text-[10px] font-semibold text-muted-foreground"
          >
            {d}
          </span>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          if (!d) return <div key={i} className="h-10" />;
          const iso = toIsoDate(d);
          const recs = recordsByDate.get(iso) ?? [];
          const hasRecs = recs.length > 0;
          const isSelected = selectedDay === iso;
          const isToday = iso === today;
          const types = [
            ...new Set(recs.map((r) => r.record_type).filter(Boolean)),
          ].slice(0, 3) as RecordType[];

          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : iso)}
              disabled={!hasRecs}
              className="flex h-10 flex-col items-center justify-center rounded-[8px] transition-colors"
              style={
                isSelected
                  ? { background: "#4F46E5" }
                  : isToday
                  ? { background: "#EEF1FF" }
                  : {}
              }
            >
              <span
                className="text-[12px] font-medium leading-none"
                style={{
                  color: isSelected
                    ? "#fff"
                    : isToday
                    ? "#4F46E5"
                    : hasRecs
                    ? "#0F172A"
                    : "#D1D5DB",
                }}
              >
                {d.getDate()}
              </span>
              {hasRecs && (
                <div className="mt-0.5 flex gap-0.5">
                  {types.map((type, ti) => (
                    <div
                      key={ti}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: isSelected
                          ? "#fff"
                          : RECORD_TYPE_CONFIG[type]?.color ?? "#9CA3AF",
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── RecordRow — shared between list and calendar day views ────────────────────

function RecordRow({
  record,
  checked,
  onToggle,
  onPreview,
  showDate = true,
}: {
  record: DiaryRecordWithRelations;
  checked: boolean;
  onToggle: () => void;
  onPreview: () => void;
  showDate?: boolean;
}) {
  const cfg = RECORD_TYPE_CONFIG[record.record_type as RecordType];
  const displayTitle =
    record.title?.trim() ||
    record.content?.trim()?.slice(0, 80) ||
    cfg?.label ||
    "Registro";

  return (
    <div
      className="flex items-center gap-2 rounded-[10px] border border-[#EEF0F4] bg-white"
      style={{ borderLeftWidth: 3, borderLeftColor: cfg?.color ?? "#9CA3AF" }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="ml-3 shrink-0"
      />
      <div
        className="min-w-0 flex-1 cursor-pointer px-2 py-2.5"
        onClick={onToggle}
      >
        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
          {record.record_type && (
            <RecordTypeChip type={record.record_type as RecordType} size="sm" />
          )}
          {showDate && (
            <span className="text-[11px] text-muted-foreground">
              {formatDateBR(record.record_date)}
            </span>
          )}
          {record.child?.name && (
            <span className="text-[11px] text-muted-foreground">
              · {record.child.name}
            </span>
          )}
        </div>
        <p className="line-clamp-1 text-[12.5px] font-medium text-[#111827]">
          {displayTitle}
        </p>
      </div>
      <button
        type="button"
        onClick={onPreview}
        className="mr-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#F3F4F8]"
        title="Ver detalhes"
      >
        <Eye size={14} strokeWidth={1.75} className="text-muted-foreground" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  records: DiaryRecordWithRelations[];
  documents: UnifiedDocument[];
  selectedRecordIds: Set<string>;
  selectedDocChildIds: Set<string>;
  selectedDocRecordIds: Set<string>;
  onToggleRecord: (id: string) => void;
  onToggleDoc: (doc: UnifiedDocument) => void;
}

export function ShareContentStep({
  records,
  documents,
  selectedRecordIds,
  selectedDocChildIds,
  selectedDocRecordIds,
  onToggleRecord,
  onToggleDoc,
}: Props) {
  const [activeTab, setActiveTab] = useState<"records" | "documents">("documents");
  const [recordViewMode, setRecordViewMode] = useState<"lista" | "calendario">("lista");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<RecordType | "all">("all");
  const [previewDoc, setPreviewDoc] = useState<UnifiedDocument | null>(null);
  const [previewRecord, setPreviewRecord] = useState<DiaryRecordWithRelations | null>(null);
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [query, setQuery] = useState("");

  const q = useMemo(() => normalizeForSearch(query), [query]);

  const totalSelected =
    selectedRecordIds.size + selectedDocChildIds.size + selectedDocRecordIds.size;

  // ── Records: filtered for list view ──────────────────────────────────────
  const filteredRecords = useMemo(
    () =>
      records.filter((r) => {
        const matchQ =
          !q ||
          normalizeForSearch(
            `${r.content ?? ""} ${r.title ?? ""} ${
              RECORD_TYPE_CONFIG[r.record_type as RecordType]?.label ?? ""
            } ${r.child?.name ?? ""}`,
          ).includes(q);
        const matchType = typeFilter === "all" || r.record_type === typeFilter;
        return matchQ && matchType;
      }),
    [records, q, typeFilter],
  );

  // ── Records: grouped by date for calendar dots ────────────────────────────
  const recordsByDate = useMemo(() => {
    const map = new Map<string, DiaryRecordWithRelations[]>();
    records.forEach((r) => {
      if (!map.has(r.record_date)) map.set(r.record_date, []);
      map.get(r.record_date)!.push(r);
    });
    return map;
  }, [records]);

  // ── Records: for the selected calendar day ────────────────────────────────
  const dayRecords = useMemo(() => {
    if (!selectedDay) return [];
    return (recordsByDate.get(selectedDay) ?? []).filter(
      (r) => typeFilter === "all" || r.record_type === typeFilter,
    );
  }, [recordsByDate, selectedDay, typeFilter]);

  // ── Documents: filtered ───────────────────────────────────────────────────
  const filteredDocs = useMemo(
    () =>
      documents.filter((d) => {
        const cat = CATEGORIES.find((c) => c.id === d.category);
        const catLabel = cat ? `${cat.emoji} ${cat.label}` : "";
        const matchQ =
          !q ||
          normalizeForSearch(
            `${d.file_name} ${d.child_name ?? ""} ${catLabel}`,
          ).includes(q);
        const matchCat = categoryFilter === "all" || d.category === categoryFilter;
        return matchQ && matchCat;
      }),
    [documents, q, categoryFilter],
  );

  return (
    <div className="space-y-3">
      {/* ── Abas ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {(["records", "documents"] as const).map((tab) => {
          const count =
            tab === "records"
              ? selectedRecordIds.size
              : selectedDocChildIds.size + selectedDocRecordIds.size;
          const label = tab === "records" ? "Registros" : "Documentos";
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                active
                  ? { background: "#4F46E5", color: "#fff" }
                  : { background: "#F1F5F9", color: "#6B7280" }
              }
            >
              {label}
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 text-[10px] font-bold leading-5"
                  style={
                    active
                      ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                      : { background: "#4F46E5", color: "#fff" }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Busca ─────────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            activeTab === "records" ? "Buscar registros…" : "Buscar documentos…"
          }
          className="pl-9"
        />
      </div>

      {/* ══════════════ ABA REGISTROS ══════════════ */}
      {activeTab === "records" && (
        <div className="space-y-3">
          {/* Filtros de tipo + toggle Lista/Calendário */}
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={
                  typeFilter === "all"
                    ? { background: "#4F46E5", color: "#fff" }
                    : { background: "#F1F5F9", color: "#6B7280" }
                }
              >
                Todos
              </button>
              {RECORD_TYPES.map((type) => {
                const cfg = RECORD_TYPE_CONFIG[type];
                const active = typeFilter === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(active ? "all" : type)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                    style={
                      active
                        ? { background: cfg.color, color: "#fff" }
                        : { background: "#F1F5F9", color: "#6B7280" }
                    }
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Toggle Lista / Calendário */}
            <div
              className="flex shrink-0 rounded-[8px] p-0.5"
              style={{ background: "#F1F5F9" }}
            >
              <button
                type="button"
                onClick={() => setRecordViewMode("lista")}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] transition-all"
                style={
                  recordViewMode === "lista"
                    ? { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.10)" }
                    : {}
                }
                title="Visão lista"
              >
                <List
                  size={13}
                  strokeWidth={2.2}
                  style={{ color: recordViewMode === "lista" ? "#4F46E5" : "#9CA3AF" }}
                />
              </button>
              <button
                type="button"
                onClick={() => setRecordViewMode("calendario")}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] transition-all"
                style={
                  recordViewMode === "calendario"
                    ? { background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.10)" }
                    : {}
                }
                title="Visão calendário"
              >
                <CalendarDays
                  size={13}
                  strokeWidth={2.2}
                  style={{ color: recordViewMode === "calendario" ? "#4F46E5" : "#9CA3AF" }}
                />
              </button>
            </div>
          </div>

          {/* ── Lista ── */}
          {recordViewMode === "lista" && (
            <div className="max-h-[38vh] space-y-1.5 overflow-y-auto pr-0.5">
              {filteredRecords.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">
                  Nenhum registro disponível.
                </p>
              ) : (
                filteredRecords.map((r) => (
                  <RecordRow
                    key={r.id}
                    record={r}
                    checked={selectedRecordIds.has(r.id)}
                    onToggle={() => onToggleRecord(r.id)}
                    onPreview={() => setPreviewRecord(r)}
                    showDate
                  />
                ))
              )}
            </div>
          )}

          {/* ── Calendário ── */}
          {recordViewMode === "calendario" && (
            <div className="space-y-3">
              <MonthCalendar
                calMonth={calMonth}
                setCalMonth={setCalMonth}
                recordsByDate={recordsByDate}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
              />

              {selectedDay ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}{" "}
                    ({dayRecords.length})
                  </p>
                  {dayRecords.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum registro para este dia com o filtro selecionado.
                    </p>
                  ) : (
                    <div className="max-h-[28vh] space-y-1.5 overflow-y-auto pr-0.5">
                      {dayRecords.map((r) => (
                        <RecordRow
                          key={r.id}
                          record={r}
                          checked={selectedRecordIds.has(r.id)}
                          onToggle={() => onToggleRecord(r.id)}
                          onPreview={() => setPreviewRecord(r)}
                          showDate={false}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                records.length > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Toque em uma data marcada para ver os registros.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ ABA DOCUMENTOS ══════════════ */}
      {activeTab === "documents" && (
        <div className="space-y-3">
          {/* Filtro por categoria */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
              style={
                categoryFilter === "all"
                  ? { background: "#7C3AED", color: "#fff" }
                  : { background: "#F1F5F9", color: "#6B7280" }
              }
            >
              Todas
            </button>
            {CATEGORIES.map((cat) => {
              const active = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(active ? "all" : cat.id)}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={
                    active
                      ? { background: cat.activeBg, borderColor: cat.activeBorder }
                      : { background: "#F1F5F9", borderColor: "transparent", color: "#6B7280" }
                  }
                >
                  <span className={active ? cat.color : ""}>
                    {cat.emoji} {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Lista de documentos */}
          <div className="max-h-[38vh] space-y-1.5 overflow-y-auto pr-0.5">
            {filteredDocs.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                Nenhum documento disponível.
              </p>
            ) : (
              filteredDocs.map((d) => {
                const checked =
                  d.source === "child"
                    ? selectedDocChildIds.has(d.id)
                    : selectedDocRecordIds.has(d.id);
                const cat = CATEGORIES.find((c) => c.id === d.category);
                const catLabel =
                  cat?.id === "outros" && d.category_description
                    ? d.category_description
                    : cat?.label;
                const isImage = d.mime_type.startsWith("image/");

                return (
                  <div
                    key={`${d.source}-${d.id}`}
                    className="flex items-center gap-2 rounded-[10px] border border-[#EEF0F4] bg-white p-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => onToggleDoc(d)}
                      className="ml-1 shrink-0"
                    />
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#F3F4F8]">
                      {isImage ? (
                        <ImageIcon size={18} strokeWidth={1.5} className="text-primary" />
                      ) : (
                        <FileText size={18} strokeWidth={1.5} className="text-primary" />
                      )}
                    </div>
                    {/* Info */}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => onToggleDoc(d)}
                    >
                      <p className="truncate text-[12.5px] font-semibold text-[#111827]">
                        {d.file_name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {cat && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold ${cat.color}`}
                            style={{ background: cat.activeBg }}
                          >
                            {cat.emoji} {catLabel}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {d.child_name} · {formatFileSize(d.size_bytes)} ·{" "}
                          {formatDateBR(d.created_at.slice(0, 10))}
                        </span>
                      </div>
                    </div>
                    {/* Preview button */}
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(d)}
                      className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#F3F4F8]"
                      title="Ver documento"
                    >
                      <Eye size={14} strokeWidth={1.75} className="text-muted-foreground" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Counter ───────────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground">
        {totalSelected === 0
          ? "Selecione ao menos um item para continuar."
          : `${totalSelected} ${totalSelected === 1 ? "item selecionado" : "itens selecionados"}.`}
      </p>

      {/* ── Preview sheets ────────────────────────────────────────────────── */}
      <RecordDetailSheet
        record={previewRecord}
        open={!!previewRecord}
        onOpenChange={(o) => { if (!o) setPreviewRecord(null); }}
        readOnly
        onEdit={() => {}}
        onShare={() => {}}
        onDelete={() => {}}
      />
      <ShareDocumentPreviewSheet
        doc={previewDoc}
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
