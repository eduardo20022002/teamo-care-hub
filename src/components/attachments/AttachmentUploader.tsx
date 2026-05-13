import { useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ALLOWED_ATTACHMENT_MIME,
  validateAttachmentFile,
} from "@/lib/validation";

interface Props {
  onFiles: (files: File[]) => void | Promise<void>;
  uploading?: boolean;
  disabled?: boolean;
  label?: string;
}

const ACCEPT = ALLOWED_ATTACHMENT_MIME.join(",");

export function AttachmentUploader({
  onFiles,
  uploading,
  disabled,
  label = "Anexar arquivo",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileList = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const valid: File[] = [];
    for (const file of Array.from(list)) {
      const result = validateAttachmentFile(file);
      if (!result.ok) {
        toast.error(`${file.name}: ${result.error}`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      await onFiles(valid);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (disabled || uploading) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (disabled || uploading) return;
        e.preventDefault();
        setDragOver(false);
        void handleFileList(e.dataTransfer.files);
      }}
      className={`rounded-xl border border-dashed p-4 text-center transition-colors ${
        dragOver
          ? "border-primary bg-primary-soft/40"
          : "border-border bg-card"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFileList(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Paperclip
        className="mx-auto mb-2 h-5 w-5 text-muted-foreground"
        strokeWidth={1.75}
      />
      <p className="mb-2 text-xs text-muted-foreground">
        PDF, JPG ou PNG · até 10 MB por arquivo
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {uploading ? "Enviando..." : label}
      </Button>
    </div>
  );
}
