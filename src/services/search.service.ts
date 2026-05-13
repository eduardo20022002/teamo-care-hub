import { listAttendanceRecords, type AttendanceRecordWithRelations } from "./attendance.service";
import { listProfessionals } from "./professionals.service";
import { listAllDocuments, normalizeForSearch, type UnifiedDocument } from "./documents.service";
import { ATTENDANCE_CATEGORY_LABELS, type AttendanceCategoryValue } from "@/lib/validation";
import type { Professional } from "@/types/database";

export type SearchKind = "record" | "professional" | "document";

export type SearchPayload =
  | { kind: "record"; record: AttendanceRecordWithRelations }
  | { kind: "professional"; professional: Professional }
  | { kind: "document"; doc: UnifiedDocument };

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  date?: string; // ISO para ordenação
  payload: SearchPayload;
}

export interface SearchSourceOpts {
  childId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  category?: AttendanceCategoryValue;
}

export interface SearchSource {
  kind: SearchKind;
  search(query: string, opts: SearchSourceOpts): Promise<SearchHit[]>;
}

const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  record: "Registros",
  professional: "Profissionais",
  document: "Documentos",
};

export function getSearchKindLabel(kind: SearchKind): string {
  return SEARCH_KIND_LABELS[kind];
}

function truncate(s: string, max = 80): string {
  const trimmed = s.trim().replace(/\s+/g, " ");
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1) + "…";
}

function dateInRange(date: string, from?: string, to?: string): boolean {
  // Compara apenas a parte YYYY-MM-DD
  const d = date.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

// ===== Fonte: Registros =====
const recordsSource: SearchSource = {
  kind: "record",
  async search(query, { childId, dateFrom, dateTo, category }) {
    const records = await listAttendanceRecords();
    const q = normalizeForSearch(query);
    return records
      .filter((r) => !childId || r.child_id === childId)
      .filter((r) => !category || r.category === category)
      .filter((r) => dateInRange(r.record_date, dateFrom, dateTo))
      .filter((r) => {
        if (!q) return true;
        const categoryLabel =
          ATTENDANCE_CATEGORY_LABELS[r.category as AttendanceCategoryValue] ?? r.category;
        const haystack = normalizeForSearch(
          [r.content, categoryLabel, r.professional_name, r.child?.name ?? ""].join(" "),
        );
        return haystack.includes(q);
      })
      .map<SearchHit>((r) => {
        const categoryLabel =
          ATTENDANCE_CATEGORY_LABELS[r.category as AttendanceCategoryValue] ?? r.category;
        const childPart = r.child?.name ? ` · ${r.child.name}` : "";
        return {
          kind: "record",
          id: r.id,
          title: truncate(r.content, 90),
          subtitle: `${categoryLabel}${childPart} · ${r.professional_name}`,
          date: r.record_date,
          payload: { kind: "record", record: r },
        };
      });
  },
};

// ===== Fonte: Profissionais =====
const professionalsSource: SearchSource = {
  kind: "professional",
  async search(query) {
    const items = await listProfessionals();
    const q = normalizeForSearch(query);
    return items
      .filter((p) =>
        !q || normalizeForSearch(`${p.name} ${p.specialty}`).includes(q),
      )
      .map<SearchHit>((p) => ({
        kind: "professional",
        id: p.id,
        title: p.name,
        subtitle: p.specialty,
        payload: { kind: "professional", professional: p },
      }));
  },
};

// ===== Fonte: Documentos =====
const documentsSource: SearchSource = {
  kind: "document",
  async search(query, { childId, dateFrom, dateTo }) {
    const docs = await listAllDocuments();
    const q = normalizeForSearch(query);
    return docs
      .filter((d) => !childId || d.child_id === childId)
      .filter((d) => dateInRange(d.created_at, dateFrom, dateTo))
      .filter((d) => !q || normalizeForSearch(d.file_name).includes(q))
      .map<SearchHit>((d) => {
        const origin = d.source === "child" ? "Documento da criança" : "Anexo de registro";
        return {
          kind: "document",
          id: `${d.source}-${d.id}`,
          title: d.file_name,
          subtitle: `${d.child_name} · ${origin}`,
          date: d.created_at,
          payload: { kind: "document", doc: d },
        };
      });
  },
};

/**
 * Lista de fontes consultadas pela busca global.
 * Ciclos futuros (C7+) devem adicionar suas fontes aqui para que apareçam
 * automaticamente nos resultados sem alterar a UI.
 */
export const SEARCH_SOURCES: SearchSource[] = [
  recordsSource,
  professionalsSource,
  documentsSource,
];

export type SearchResults = Record<SearchKind, SearchHit[]>;

export async function searchAll(
  query: string,
  opts: {
    childId?: string;
    kinds?: SearchKind[];
    dateFrom?: string;
    dateTo?: string;
    category?: AttendanceCategoryValue;
  } = {},
): Promise<SearchResults> {
  const empty: SearchResults = { record: [], professional: [], document: [] };
  const trimmed = query.trim();

  const sources = opts.kinds
    ? SEARCH_SOURCES.filter((s) => opts.kinds!.includes(s.kind))
    : SEARCH_SOURCES;

  const settled = await Promise.allSettled(
    sources.map((s) =>
      s.search(trimmed, {
        childId: opts.childId,
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
        category: opts.category,
      }),
    ),
  );

  const results: SearchResults = { ...empty };
  settled.forEach((res, i) => {
    const kind = sources[i].kind;
    if (res.status === "fulfilled") {
      results[kind] = res.value;
    }
  });
  return results;
}

/**
 * Achata e ordena resultados por data desc. Itens sem data (ex: profissionais)
 * vão para o final, ordenados por título asc.
 */
export function flattenAndSortByDate(results: SearchResults): SearchHit[] {
  const all: SearchHit[] = [
    ...results.record,
    ...results.document,
    ...results.professional,
  ];
  return all.sort((a, b) => {
    if (a.date && b.date) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    }
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  });
}
