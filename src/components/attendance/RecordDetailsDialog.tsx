import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CategoryBadge } from "./CategoryBadge";
import { RecordAttachmentsSection } from "@/components/attachments/RecordAttachmentsSection";
import { formatDateBR } from "@/lib/formatters";
import { User } from "lucide-react";
import type { AttendanceRecordWithRelations } from "@/services/attendance.service";

interface Props {
  record: AttendanceRecordWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecordDetailsDialog({ record, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalhes do registro</DialogTitle>
          <DialogDescription className="sr-only">
            Visualização completa do registro de atendimento.
          </DialogDescription>
        </DialogHeader>

        {record && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={record.category} />
              <span className="text-xs text-muted-foreground">
                {formatDateBR(record.record_date)}
              </span>
              {record.child && (
                <span className="text-xs font-medium text-foreground">
                  · {record.child.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-sm text-foreground">
              <User
                className="h-3.5 w-3.5 text-muted-foreground"
                strokeWidth={1.75}
              />
              <span className="font-medium">{record.professional_name}</span>
              {!record.professional_id && (
                <span className="text-xs text-muted-foreground">
                  (não cadastrado)
                </span>
              )}
            </div>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {record.content}
            </p>

            <div className="border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Anexos
              </h3>
              <RecordAttachmentsSection recordId={record.id} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
