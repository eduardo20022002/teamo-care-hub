import { useState, useEffect } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CATEGORIES } from "@/components/documents/AddChildDocumentDialog";
import { formatDateBR, formatFileSize } from "@/lib/formatters";
import { getAttachmentSignedUrl } from "@/services/attachments.service";
import type { UnifiedDocument } from "@/services/documents.service";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";

interface Props {
  doc: UnifiedDocument | null;
  open: boolean;
  onClose: () => void;
}

export function ShareDocumentPreviewSheet({ doc, open, onClose }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const isImage = doc?.mime_type.startsWith("image/") ?? false;

  useEffect(() => {
    if (!doc || !isImage) {
      setThumbUrl(null);
      return;
    }
    let cancelled = false;
    getAttachmentSignedUrl(doc.storage_path, 300)
      .then((url) => { if (!cancelled) setThumbUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.storage_path, isImage]);

  const handleOpen = async () => {
    if (!doc) return;
    setOpening(true);
    try {
      const url = await getAttachmentSignedUrl(doc.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };

  if (!doc) return null;

  const cat = CATEGORIES.find((c) => c.id === doc.category);
  const catLabel =
    cat?.id === "outros" && doc.category_description
      ? doc.category_description
      : cat?.label;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-[20px] px-0 pb-0 max-h-[85vh] overflow-y-auto"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#D1D5DB]" />
        </div>

        <div className="px-5 pb-8">
          {/* Icon / thumbnail */}
          <div className="flex justify-center mb-4 mt-3">
            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-[#F3F4F8] flex items-center justify-center">
              {isImage && thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt={doc.file_name}
                  className="h-full w-full object-cover"
                />
              ) : isImage ? (
                <ImageIcon className="h-8 w-8 text-primary" strokeWidth={1.5} />
              ) : (
                <FileText className="h-8 w-8 text-primary" strokeWidth={1.5} />
              )}
            </div>
          </div>

          {/* File name */}
          <p className="break-all text-center text-[17px] font-bold text-foreground mb-2">
            {doc.file_name}
          </p>

          {/* Category badge */}
          {cat && (
            <div className="flex justify-center mb-3">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cat.color}`}
                style={{ background: cat.activeBg, border: `1px solid ${cat.activeBorder}` }}
              >
                {cat.emoji} {catLabel}
              </span>
            </div>
          )}

          {/* Metadata */}
          <p className="text-center text-xs text-muted-foreground mb-1">{doc.child_name}</p>
          <p className="text-center text-xs text-muted-foreground mb-4">
            {formatFileSize(doc.size_bytes)} · {formatDateBR(doc.created_at.slice(0, 10))}
          </p>

          {doc.source === "record" && doc.record_date && (
            <p className="mb-4 text-center text-xs text-muted-foreground">
              Anexo de registro · {formatDateBR(doc.record_date)}
            </p>
          )}

          {/* Open button */}
          <button
            type="button"
            onClick={handleOpen}
            disabled={opening}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[12px] text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: BRAND_GRADIENT }}
          >
            {opening ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="h-4 w-4" strokeWidth={2} />
                Abrir arquivo
              </>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
