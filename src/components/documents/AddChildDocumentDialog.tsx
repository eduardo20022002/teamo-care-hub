import { useEffect, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AttachmentUploader } from "@/components/attachments/AttachmentUploader";
import { PendingAttachmentsList } from "@/components/attachments/PendingAttachmentsList";
import type { Child } from "@/types/database";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

function selectTriggerCls() {
  return "h-[44px] rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] text-sm focus:bg-[#FAFBFF] focus:border-[#4F46E5] focus:ring-[4px] focus:ring-[rgba(79,70,229,0.10)]";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childrenList: Child[];
  defaultChildId?: string;
  onConfirm: (childId: string, files: File[]) => Promise<void>;
  submitting?: boolean;
}

export function AddChildDocumentDialog({
  open,
  onOpenChange,
  childrenList,
  defaultChildId,
  onConfirm,
  submitting,
}: Props) {
  const [childId, setChildId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setChildId(
      defaultChildId ??
        (childrenList.length === 1 ? childrenList[0].id : ""),
    );
    setFiles([]);
    setError(null);
  }, [open, defaultChildId, childrenList]);

  const handleConfirm = async () => {
    if (!childId) {
      setError("Selecione uma criança.");
      return;
    }
    if (files.length === 0) {
      setError("Adicione ao menos um arquivo.");
      return;
    }
    setError(null);
    await onConfirm(childId, files);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[24px] px-0 pb-0 pt-0"
      >
        <SheetTitle className="sr-only">Adicionar documento</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pb-4 pt-3">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">
              Adicionar documento
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Anexe laudos, relatórios escolares, prescrições e outros documentos
              avulsos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6F7FB] text-muted-foreground hover:bg-[#EEF0F4]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="h-px bg-[#EEF0F4]" />

        <div className="space-y-5 px-5 py-5">
          {/* Criança */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Criança
            </label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger className={selectTriggerCls()}>
                <SelectValue placeholder="Selecione a criança" />
              </SelectTrigger>
              <SelectContent>
                {childrenList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Título (optional info) */}
          <div className="rounded-[14px] border border-[#EEF0F4] bg-[#F6F7FB] px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Paperclip className="h-4 w-4 shrink-0" style={{ color: "#7C3AED" }} strokeWidth={1.75} />
              <span>PDF, JPG ou PNG · até 10 MB por arquivo</span>
            </div>
          </div>

          {/* Uploader */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Arquivo
            </label>
            <AttachmentUploader
              onFiles={(newFiles) => {
                setFiles((prev) => [...prev, ...newFiles]);
                setError(null);
              }}
              uploading={false}
              label="Selecionar arquivo"
            />
          </div>

          <PendingAttachmentsList
            files={files}
            onRemove={(idx) =>
              setFiles((prev) => prev.filter((_, i) => i !== idx))
            }
          />

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Botões */}
          <div className="space-y-3 pb-6 pt-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="flex h-[50px] w-full items-center justify-center rounded-[12px] text-sm font-semibold text-white disabled:opacity-60"
              style={{
                background: BRAND_GRADIENT,
                boxShadow: submitting ? "none" : BRAND_SHADOW,
              }}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Enviar"
              )}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full py-2 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
