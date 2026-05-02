import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/attendance/CategoryBadge";
import { formatDateBR } from "@/lib/formatters";
import { normalizeForSearch, type UnifiedDocument } from "@/services/documents.service";
import type { AttendanceRecordWithRelations } from "@/services/attendance.service";

interface Props {
  records: AttendanceRecordWithRelations[];
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
  const [query, setQuery] = useState("");
  const q = normalizeForSearch(query);

  const filteredRecords = useMemo(
    () =>
      records.filter((r) =>
        !q
          ? true
          : normalizeForSearch(
              `${r.content} ${r.professional_name} ${r.child?.name ?? ""}`,
            ).includes(q),
      ),
    [records, q],
  );
  const filteredDocs = useMemo(
    () =>
      documents.filter((d) =>
        !q ? true : normalizeForSearch(`${d.file_name} ${d.child_name}`).includes(q),
      ),
    [documents, q],
  );

  const totalSelected =
    selectedRecordIds.size + selectedDocChildIds.size + selectedDocRecordIds.size;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar registros e documentos…"
          className="pl-9"
        />
      </div>

      <div className="max-h-[42vh] space-y-4 overflow-y-auto pr-1">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Registros ({filteredRecords.length})
          </h3>
          {filteredRecords.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum registro disponível.</p>
          ) : (
            <ul className="space-y-1.5">
              {filteredRecords.map((r) => (
                <li key={r.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-primary-soft/30">
                    <Checkbox
                      checked={selectedRecordIds.has(r.id)}
                      onCheckedChange={() => onToggleRecord(r.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <CategoryBadge category={r.category} />
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateBR(r.record_date)}
                        </span>
                        {r.child?.name && (
                          <span className="text-[11px] font-medium text-foreground">
                            · {r.child.name}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground">{r.content}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.professional_name}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Documentos ({filteredDocs.length})
          </h3>
          {filteredDocs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum documento disponível.</p>
          ) : (
            <ul className="space-y-1.5">
              {filteredDocs.map((d) => {
                const checked =
                  d.source === "child"
                    ? selectedDocChildIds.has(d.id)
                    : selectedDocRecordIds.has(d.id);
                return (
                  <li key={`${d.source}-${d.id}`}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-primary-soft/30">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => onToggleDoc(d)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {d.file_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {d.child_name} ·{" "}
                          {d.source === "child" ? "Documento da criança" : "Anexo de registro"}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        {totalSelected === 0
          ? "Selecione ao menos um item para continuar."
          : `${totalSelected} ${totalSelected === 1 ? "item selecionado" : "itens selecionados"}.`}
      </p>
    </div>
  );
}
