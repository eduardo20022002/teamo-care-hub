import { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateBR, formatFileSize } from "@/lib/formatters";
import { getAttachmentSignedUrl } from "@/services/attachments.service";
import { CategoryBadge } from "@/components/attendance/CategoryBadge";
import type { UnifiedDocument } from "@/services/documents.service";
import { CATEGORIES } from "./AddChildDocumentDialog";

interface Props {
  doc: UnifiedDocument;
  onDelete?: (doc: UnifiedDocument) => void;
  deleting?: boolean;
}

export function DocumentCard({ doc, onDelete, deleting }: Props) {
  const isImage = doc.mime_type.startsWith("image/");
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    getAttachmentSignedUrl(doc.storage_path, 300)
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        /* sem miniatura */
      });
    return () => {
      cancelled = true;
    };
  }, [doc.storage_path, isImage]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      const url = await getAttachmentSignedUrl(doc.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  return (
    <article className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-soft">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={doc.file_name}
            className="h-full w-full object-cover"
          />
        ) : isImage ? (
          <ImageIcon className="h-5 w-5 text-primary" strokeWidth={1.75} />
        ) : (
          <FileText className="h-5 w-5 text-primary" strokeWidth={1.75} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={handleOpen}
          disabled={opening}
          className="block w-full text-left"
        >
          <p className="truncate text-sm font-semibold text-foreground hover:underline">
            {doc.file_name}
          </p>
        </button>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {doc.child_name} · {formatFileSize(doc.size_bytes)} ·{" "}
          {formatDateBR(doc.created_at.slice(0, 10))}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {/* Categoria do documento da criança */}
          {doc.source === "child" && (() => {
            const cat = CATEGORIES.find((c) => c.id === doc.category);
            if (cat) {
              const label =
                cat.id === "outros" && doc.category_description
                  ? doc.category_description
                  : cat.label;
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.color}`}
                  style={{ background: cat.activeBg }}
                >
                  {cat.emoji} {label}
                </span>
              );
            }
            return (
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Documento da criança
              </span>
            );
          })()}
          {/* Categoria de anexo de registro */}
          {doc.source === "record" && (
            <>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Anexo de registro
              </span>
              {doc.record_category && (
                <CategoryBadge category={doc.record_category} />
              )}
              {doc.record_date && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDateBR(doc.record_date)}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remover ${doc.file_name}`}
          onClick={() => onDelete(doc)}
          disabled={deleting}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          )}
        </Button>
      )}
    </article>
  );
}
