import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBR, formatFileSize } from "@/lib/formatters";
import { getAttachmentSignedUrl } from "@/services/attachments.service";

export interface AttachmentItemData {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

interface Props {
  attachment: AttachmentItemData;
  onDelete?: (a: AttachmentItemData) => void;
  deleting?: boolean;
}

export function AttachmentItem({ attachment, onDelete, deleting }: Props) {
  const isImage = attachment.mime_type.startsWith("image/");
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    getAttachmentSignedUrl(attachment.storage_path, 300)
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        /* silencioso: sem miniatura */
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path, isImage]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const url = await getAttachmentSignedUrl(attachment.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={attachment.file_name}
            className="h-full w-full object-cover"
          />
        ) : isImage ? (
          <ImageIcon className="h-5 w-5 text-primary" strokeWidth={1.75} />
        ) : (
          <FileText className="h-5 w-5 text-primary" strokeWidth={1.75} />
        )}
      </div>

      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium text-foreground hover:underline">
          {attachment.file_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {formatFileSize(attachment.size_bytes)} ·{" "}
          {formatDateBR(attachment.created_at.slice(0, 10))}
        </p>
      </button>

      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remover ${attachment.file_name}`}
          onClick={() => onDelete(attachment)}
          disabled={deleting}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          )}
        </Button>
      )}
    </div>
  );
}
