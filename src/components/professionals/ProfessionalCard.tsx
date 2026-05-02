import { Mail, Pencil, Phone, Trash2 } from "lucide-react";
import type { Professional } from "@/types/database";
import { getInitial } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

interface Props {
  professional: Professional;
  onEdit: (p: Professional) => void;
  onDelete: (p: Professional) => void;
}

export function ProfessionalCard({ professional, onEdit, onDelete }: Props) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {getInitial(professional.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">
            {professional.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {professional.specialty}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-2 truncate">
          <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{professional.email}</span>
        </p>
        {professional.phone && (
          <p className="flex items-center gap-2 truncate">
            <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{professional.phone}</span>
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(professional)}
          aria-label={`Editar ${professional.name}`}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(professional)}
          aria-label={`Excluir ${professional.name}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.75} />
          Excluir
        </Button>
      </div>
    </div>
  );
}
