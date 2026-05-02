import { FolderOpen } from "lucide-react";

export function EmptyAttachments() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <FolderOpen
        className="mx-auto mb-2 h-8 w-8 text-muted-foreground"
        strokeWidth={1.5}
      />
      <p className="text-sm font-medium text-foreground">
        Nenhum documento por aqui ainda.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use o botão acima para adicionar laudos, relatórios e prescrições.
      </p>
    </div>
  );
}
