import { FileText, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/formatters";

interface Props {
  files: File[];
  onRemove: (index: number) => void;
}

export function PendingAttachmentsList({ files, onRemove }: Props) {
  if (files.length === 0) return null;
  return (
    <div className="space-y-2">
      {files.map((file, idx) => {
        const isImage = file.type.startsWith("image/");
        return (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              {isImage ? (
                <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <FileText className="h-4 w-4" strokeWidth={1.75} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {file.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatFileSize(file.size)} · pendente
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover ${file.name}`}
              onClick={() => onRemove(idx)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
