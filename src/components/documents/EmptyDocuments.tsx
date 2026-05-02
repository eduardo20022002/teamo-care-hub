import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hasChildren: boolean;
  onAdd?: () => void;
}

export function EmptyDocuments({ hasChildren, onAdd }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <FolderOpen
        className="mx-auto mb-3 h-10 w-10 text-muted-foreground"
        strokeWidth={1.5}
      />
      <p className="text-base font-semibold text-foreground">
        Nenhum documento por aqui ainda.
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Anexe laudos, relatórios e prescrições para encontrá-los facilmente
        depois. Eles também aparecem nos registros de atendimento.
      </p>
      {hasChildren && onAdd && (
        <Button onClick={onAdd} className="mt-4">
          Adicionar documento
        </Button>
      )}
    </div>
  );
}
