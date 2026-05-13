import { ChevronRight, ClipboardList, FileText, User } from "lucide-react";
import type { SearchHit } from "@/services/search.service";
import { formatDateBR } from "@/lib/formatters";

const ICONS = {
  record: ClipboardList,
  professional: User,
  document: FileText,
} as const;

interface Props {
  hit: SearchHit;
  onClick: () => void;
}

export function SearchResultItem({ hit, onClick }: Props) {
  const Icon = ICONS[hit.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/30"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{hit.title}</p>
        {hit.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{hit.subtitle}</p>
        )}
      </div>
      {hit.date && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {formatDateBR(hit.date.slice(0, 10))}
        </span>
      )}
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        strokeWidth={1.75}
      />
    </button>
  );
}
