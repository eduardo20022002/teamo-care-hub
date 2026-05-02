import { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import type { Child } from "@/types/database";
import { formatAge, formatBirthDate, getInitial } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { ChildDocumentsDialog } from "@/components/attachments/ChildDocumentsDialog";

interface Props {
  child: Child;
  onDelete?: (child: Child) => void;
  onQuickRegister?: (child: Child) => void;
  variant?: "row" | "card";
}

export function ChildCard({ child, onDelete, onQuickRegister, variant = "card" }: Props) {
  const [docsOpen, setDocsOpen] = useState(false);

  if (variant === "row") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {getInitial(child.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{child.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatBirthDate(child.birth_date)} · {formatAge(child.birth_date)}
          </p>
        </div>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remover ${child.name}`}
            onClick={() => onDelete(child)}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {getInitial(child.name)}
        </div>
        <p className="text-base font-semibold text-foreground">{child.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatAge(child.birth_date)}</p>
        <p className="text-xs text-muted-foreground">{formatBirthDate(child.birth_date)}</p>
        <div className="mt-3 flex flex-col gap-2">
          {onQuickRegister && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onQuickRegister(child)}
              className="w-full"
            >
              <Plus className="mr-1 h-3.5 w-3.5" strokeWidth={2} />
              Registrar atendimento
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDocsOpen(true)}
            className="w-full"
          >
            <FolderOpen className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
            Documentos
          </Button>
        </div>
      </div>

      <ChildDocumentsDialog
        open={docsOpen}
        onOpenChange={setDocsOpen}
        child={child}
      />
    </>
  );
}
