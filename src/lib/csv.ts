// Geração de CSV client-side, sem dependência externa (issue #9).
// Escapa aspas, vírgulas, ponto-e-vírgula e quebras de linha conforme RFC 4180.

export interface CsvColumn<T> {
  key: keyof T | ((row: T) => unknown);
  header: string;
}

function escapeCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) =>
          escapeCell(typeof c.key === "function" ? c.key(row) : (row as Record<string, unknown>)[c.key as string]),
        )
        .join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

/** Dispara o download de um CSV no navegador. Prefixa BOM p/ Excel abrir acentos. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
