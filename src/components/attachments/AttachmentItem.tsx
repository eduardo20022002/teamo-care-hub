import { useEffect, useState } from "react";
import { FileText, Film, Image as ImageIcon, Loader2, Music, Trash2 } from "lucide-react";
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

type Kind = "image" | "video" | "audio" | "other";

function kindOf(mime: string): Kind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "other";
}

export function AttachmentItem({ attachment, onDelete, deleting }: Props) {
  const kind = kindOf(attachment.mime_type);
  const isMedia = kind === "image" || kind === "video" || kind === "audio";
  const [url, setUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // Mídia (imagem/vídeo/áudio) é exibida inline; gera URL assinada com validade
  // maior para permitir reprodução. PDFs/outros abrem em nova aba sob demanda.
  useEffect(() => {
    if (!isMedia) return;
    let cancelled = false;
    getAttachmentSignedUrl(attachment.storage_path, 3600)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        /* silencioso: sem preview — ainda dá pra abrir pelo nome */
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storage_path, isMedia]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const signed = url ?? (await getAttachmentSignedUrl(attachment.storage_path));
      window.open(signed, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  const Icon = kind === "video" ? Film : kind === "audio" ? Music : kind === "image" ? ImageIcon : FileText;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft">
          {kind === "image" && url ? (
            <img src={url} alt={attachment.file_name} className="h-full w-full object-cover" />
          ) : (
            <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
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

      {/* Player inline para vídeo e áudio */}
      {kind === "video" && url && (
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          className="mt-3 max-h-72 w-full rounded-lg bg-black"
        />
      )}
      {kind === "audio" && url && (
        <audio src={url} controls preload="metadata" className="mt-3 w-full" />
      )}
    </div>
  );
}
