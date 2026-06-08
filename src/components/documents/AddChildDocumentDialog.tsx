import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
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

export const CATEGORIES = [
  {
    id: "laudo",
    label: "Laudo",
    emoji: "🗂",
    color: "text-rose-500",
    activeBg: "#FFF1F2",
    activeBorder: "#FDA4AF",
    bg: "bg-rose-50 hover:bg-rose-100 border-rose-200",
  },
  {
    id: "relatorio",
    label: "Relatório",
    emoji: "📄",
    color: "text-blue-600",
    activeBg: "#EFF6FF",
    activeBorder: "#93C5FD",
    bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  {
    id: "prescricao",
    label: "Prescrição",
    emoji: "💊",
    color: "text-rose-500",
    activeBg: "#FFF1F2",
    activeBorder: "#FDA4AF",
    bg: "bg-rose-50 hover:bg-rose-100 border-rose-200",
  },
  {
    id: "escolar",
    label: "Escolar",
    emoji: "📚",
    color: "text-emerald-600",
    activeBg: "#F0FDF4",
    activeBorder: "#6EE7B7",
    bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  },
  {
    id: "outros",
    label: "Outros",
    emoji: "📁",
    color: "text-gray-600",
    activeBg: "#F9FAFB",
    activeBorder: "#D1D5DB",
    bg: "bg-gray-50 hover:bg-gray-100 border-gray-200",
  },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

function selectTriggerCls() {
  return "h-[44px] rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] text-sm focus:bg-[#FAFBFF] focus:border-[#4F46E5] focus:ring-[4px] focus:ring-[rgba(79,70,229,0.10)]";
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childrenList: Child[];
  defaultChildId?: string;
  onConfirm: (
    childId: string,
    files: File[],
    title?: string,
    category?: string,
    categoryDescription?: string,
  ) => Promise<void>;
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
  const [title, setTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | "">("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setChildId(defaultChildId ?? (childrenList.length === 1 ? childrenList[0].id : ""));
    setTitle("");
    setFiles([]);
    setSelectedCategory("");
    setCategoryDescription("");
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
    const catDesc = selectedCategory === "outros" ? categoryDescription.trim() : undefined;
    await onConfirm(childId, files, title || undefined, selectedCategory || undefined, catDesc);
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

        {/* Header — X de fechar é o padrão do SheetContent */}
        <div className="px-5 pb-4 pt-3">
          <h2 className="text-[17px] font-bold text-foreground">Adicionar documento</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Envie o arquivo e selecione a categoria para organizar melhor.
          </p>
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

          {/* Drop zone — área dedicada de upload */}
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-foreground">Arquivo</label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-[12px] border-[1.5px] border-dashed px-5 py-7 text-center transition-colors",
                dragging
                  ? "border-[#7C3AED] bg-[#F3F4FF]"
                  : "border-[#C7D2FE] hover:border-[#7C3AED] hover:bg-[#F3F4FF]",
              )}
              style={{
                background: dragging
                  ? "#F3F4FF"
                  : "linear-gradient(180deg, #FAFBFF 0%, #F3F4FF 100%)",
              }}
            >
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-[12px] bg-white"
                style={{ boxShadow: "0 1px 4px rgba(79,70,229,0.10), 0 0 0 1px #EEF0F4" }}
              >
                <Paperclip className="h-5 w-5" style={{ color: "#7C3AED" }} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Arraste o arquivo ou{" "}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-[#4F46E5] underline-offset-2 hover:underline"
                >
                  selecione
                </button>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, JPG ou PNG · até 10 MB por arquivo
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-3 rounded-[9px] border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F6F7FB]"
              >
                Selecionar arquivo
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
          </div>

          {/* Arquivos selecionados */}
          {files.length > 0 && (
            <PendingAttachmentsList
              files={files}
              onRemove={(idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))}
            />
          )}

          {/* Categoria — seleção independente do upload */}
          <div className="space-y-2">
            <p className="text-[12.5px] font-semibold text-foreground">
              Categoria{" "}
              <span className="rounded-full bg-[#F4F5FA] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                opcional
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory((prev) => (prev === cat.id ? "" : cat.id))
                    }
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border-[1.5px] px-3.5 py-3 text-sm font-semibold transition-all",
                      active ? cat.color : "text-[#374151]",
                    )}
                    style={{
                      background: active ? cat.activeBg : "#F6F7FB",
                      borderColor: active ? cat.activeBorder : "#E5E7EB",
                      boxShadow: active ? `0 0 0 3px ${cat.activeBorder}55` : "none",
                    }}
                  >
                    <span className="text-base">{cat.emoji}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Campo livre para "Outros" */}
            {selectedCategory === "outros" && (
              <input
                type="text"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Descreva o documento (ex: Exame de sangue)"
                className="h-[44px] w-full rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#4F46E5] focus:bg-[#FAFBFF] focus:outline-none focus:ring-4 focus:ring-[rgba(79,70,229,0.10)]"
              />
            )}
          </div>

          {/* Título (opcional) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[12.5px] font-semibold text-foreground">Título</label>
              <span className="rounded-full bg-[#F4F5FA] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                opcional
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Laudo neurológico — abril/2026"
              className="h-[44px] w-full rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#4F46E5] focus:bg-[#FAFBFF] focus:outline-none focus:ring-4 focus:ring-[rgba(79,70,229,0.10)]"
            />
            <p className="text-[11px] text-muted-foreground">
              Damos um nome automático se você deixar em branco.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Botão enviar */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || files.length === 0}
            className="flex h-[50px] w-full items-center justify-center rounded-[12px] text-sm font-semibold text-white disabled:opacity-45"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: submitting || files.length === 0 ? "none" : BRAND_SHADOW,
            }}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : files.length > 1 ? (
              `Enviar ${files.length} arquivos`
            ) : (
              "Enviar arquivo"
            )}
          </button>

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
