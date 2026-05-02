import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Paperclip, Pencil, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "./CategoryBadge";
import { formatDateBR } from "@/lib/formatters";
import { countRecordAttachments } from "@/services/attachments.service";
import { RecordAttachmentsSection } from "@/components/attachments/RecordAttachmentsSection";
import { ShareTriggerButton } from "@/components/sharing/ShareTriggerButton";
import type { AttendanceRecordWithRelations } from "@/services/attendance.service";

interface Props {
  record: AttendanceRecordWithRelations;
  showChild?: boolean;
  onEdit?: (record: AttendanceRecordWithRelations) => void;
  onDelete?: (record: AttendanceRecordWithRelations) => void;
}

export function AttendanceCard({ record, showChild, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isUnregistered = !record.professional_id;

  const { data: attachmentCount = 0 } = useQuery({
    queryKey: ["record-attachments-count", record.id],
    queryFn: () => countRecordAttachments(record.id),
  });

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <CategoryBadge category={record.category} />
        <span className="text-xs text-muted-foreground">
          {formatDateBR(record.record_date)}
        </span>
        {showChild && record.child && (
          <span className="text-xs font-medium text-foreground">
            · {record.child.name}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!isUnregistered && (
            <ShareTriggerButton
              variant="icon"
              preSelectedRecordIds={[record.id]}
              preSelectedProfessionalId={record.professional_id ?? undefined}
              label="Compartilhar registro"
            />
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Editar registro"
              onClick={() => onEdit(record)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Excluir registro"
              onClick={() => onDelete(record)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </header>

      <div className="mb-2 flex items-center gap-1.5 text-sm text-foreground">
        <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <span className="font-medium">{record.professional_name}</span>
        {isUnregistered && (
          <span className="text-xs text-muted-foreground">(não cadastrado)</span>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {record.content}
      </p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
        Anexos
        {attachmentCount > 0 && (
          <span className="rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
            {attachmentCount}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <RecordAttachmentsSection recordId={record.id} />
        </div>
      )}
    </article>
  );
}
