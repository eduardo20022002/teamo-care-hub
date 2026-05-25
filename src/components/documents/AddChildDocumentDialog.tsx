import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PendingAttachmentsList } from "@/components/attachments/PendingAttachmentsList";
import { cn } from "@/lib/utils";
import type { Child } from "@/types/database";

const BRAND_GRADIENT = "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW = "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

const CATEGORIES = [
  {
    id: "laudo",
    label: "Laudo",
    emoji: "🗂",
    color: "text-rose-500",
    bg: "bg-rose-50 hover:bg-rose-100 border-rose-200",
  },
  {
    id: "relatorio",
    label: "Relatório",
    emoji: "📄",
    color: "text-blue-600",
    bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  {
    id: "prescricao",
    label: "Prescrição",
    emoji: "💊",
    color: "text-rose-500",
    bg: "bg-rose-50 hover:bg-rose-100 border-rose-200",
  },
  {
    id: "escolar",
    label: "Escolar",
    emoji: "📚",
    color: "text-emerald-600",
    bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  },
] as const;

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
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setChildId(defaultChildId ?? (childrenList.length === 1 ? childrenList[0].id : ""));
    setFiles([]);
    setError(null);
  }, [open, defaultChildId, childrenList]);

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => [...prev, ...arr]);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  // Categorias hoje são apenas visuais — o backend não persiste categoria por
  // anexo. Clicar abre o seletor de arquivo. (Futuro: armazenar em coluna
  // child_attachments.category.)
  const handleCategoryClick = () => {
    fileRef.current?.click();
  };

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
            <h2 className="text-[17px] font-bold text-foreground">Adicionar documento</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Selecione a categoria pra a gente organizar melhor — ou arraste o arquivo direto.
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
          {/* Criança selector (hidden when only one child) */}
          {childrenList.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Criança</label>
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
          )}

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
              dragging
                ? "border-primary bg-primary/5"
                : "border-primary/30 bg-primary/[0.03] hover:border-primary/50 hover:bg-primary/5",
            )}
          >
            <Paperclip className="mb-3 h-10 w-10 text-primary/40" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">
              Arraste o arquivo ou toque para enviar
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, JPG ou PNG · até 10 MB por arquivo
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-3 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
            >
              Selecionar do dispositivo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* Category grid */}
          <div>
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ou escolha uma categoria
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={handleCategoryClick}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-colors",
                    cat.bg,
                    cat.color,
                  )}
                >
                  <span className="text-base">{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <PendingAttachmentsList
            files={files}
            onRemove={(idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Buttons */}
          {files.length > 0 && (
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
                `Enviar ${files.length > 1 ? `${files.length} arquivos` : "arquivo"}`
              )}
            </button>
          )}

          <div className="pb-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
