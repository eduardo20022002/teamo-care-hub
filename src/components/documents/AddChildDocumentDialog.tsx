import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
    setChildId(defaultChildId ?? (childrenList.length === 1 ? childrenList[0].id : ""));
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar documento</DialogTitle>
          <DialogDescription>
            Anexe laudos, relatórios escolares, prescrições e outros documentos
            avulsos da criança.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-doc-child">Criança</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger id="add-doc-child">
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

          <AttachmentUploader
            onFiles={(newFiles) => {
              setFiles((prev) => [...prev, ...newFiles]);
              setError(null);
            }}
            uploading={false}
            label="Selecionar arquivos"
          />

          <PendingAttachmentsList
            files={files}
            onRemove={(idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))}
          />

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
