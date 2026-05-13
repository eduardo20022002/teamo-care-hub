import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ATTENDANCE_CATEGORIES,
  ATTENDANCE_CATEGORY_LABELS,
  attendanceRecordSchema,
  type AttendanceRecordInput,
} from "@/lib/validation";
import type { AttendanceRecord, Child, Professional } from "@/types/database";
import {
  ProfessionalCombobox,
  type ProfessionalSelection,
} from "./ProfessionalCombobox";
import { RecordAttachmentsSection } from "@/components/attachments/RecordAttachmentsSection";
import { AttachmentUploader } from "@/components/attachments/AttachmentUploader";
import { PendingAttachmentsList } from "@/components/attachments/PendingAttachmentsList";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AttendanceRecordInput, pendingFiles?: File[]) => Promise<void> | void;
  submitting?: boolean;
  childrenList: Child[];
  professionals: Professional[];
  initial?: AttendanceRecord | null;
  defaultChildId?: string;
}

type FieldErrors = Partial<Record<keyof AttendanceRecordInput, string>>;

const todayISO = () => new Date().toISOString().slice(0, 10);

export function AttendanceFormDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  childrenList,
  professionals,
  initial,
  defaultChildId,
}: Props) {
  const [childId, setChildId] = useState("");
  const [professional, setProfessional] = useState<ProfessionalSelection>({
    professional_id: null,
    professional_name: "",
  });
  const [category, setCategory] = useState<string>("");
  const [content, setContent] = useState("");
  const [recordDate, setRecordDate] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setChildId(initial.child_id);
      setProfessional({
        professional_id: initial.professional_id,
        professional_name: initial.professional_name,
      });
      setCategory(initial.category);
      setContent(initial.content);
      setRecordDate(initial.record_date);
    } else {
      setChildId(defaultChildId ?? (childrenList.length === 1 ? childrenList[0].id : ""));
      setProfessional({ professional_id: null, professional_name: "" });
      setCategory("");
      setContent("");
      setRecordDate(todayISO());
    }
    setErrors({});
    setPendingFiles([]);
  }, [open, initial, defaultChildId, childrenList]);

  const isEdit = !!initial;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = attendanceRecordSchema.safeParse({
      child_id: childId,
      professional_id: professional.professional_id,
      professional_name: professional.professional_name,
      category,
      content,
      record_date: recordDate,
    });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof AttendanceRecordInput;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data, isEdit ? undefined : pendingFiles);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setErrors({});
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar registro" : "Registrar atendimento"}
          </DialogTitle>
          <DialogDescription>
            Anote o que aconteceu no atendimento. Você pode escolher um
            profissional cadastrado ou digitar o nome.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="att-child">Criança</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger id="att-child">
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
            {errors.child_id && (
              <p className="text-xs text-destructive">{errors.child_id}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="att-professional">Profissional emissor</Label>
            <ProfessionalCombobox
              id="att-professional"
              value={professional}
              onChange={setProfessional}
              professionals={professionals}
            />
            {errors.professional_name && (
              <p className="text-xs text-destructive">
                {errors.professional_name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="att-category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="att-category">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {ATTENDANCE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="att-date">Data</Label>
              <Input
                id="att-date"
                type="date"
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                max={todayISO()}
              />
              {errors.record_date && (
                <p className="text-xs text-destructive">{errors.record_date}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="att-content">Conteúdo</Label>
            <Textarea
              id="att-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva o que foi orientado, observado ou conduzido no atendimento."
              rows={6}
              maxLength={5000}
            />
            <div className="flex justify-between">
              {errors.content ? (
                <p className="text-xs text-destructive">{errors.content}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-muted-foreground">
                {content.length}/5000
              </span>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label>Anexos</Label>
            {isEdit && initial ? (
              <RecordAttachmentsSection recordId={initial.id} />
            ) : (
              <div className="space-y-3">
                <AttachmentUploader
                  onFiles={(files) => {
                    setPendingFiles((prev) => [...prev, ...files]);
                  }}
                  uploading={false}
                  label="Selecionar arquivos"
                />
                <PendingAttachmentsList
                  files={pendingFiles}
                  onRemove={(idx) =>
                    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
                {pendingFiles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {pendingFiles.length === 1
                      ? "1 arquivo será enviado após salvar o registro."
                      : `${pendingFiles.length} arquivos serão enviados após salvar o registro.`}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
