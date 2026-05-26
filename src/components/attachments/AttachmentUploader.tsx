import { useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
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
  label = "Selecionar arquivo",
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
      style={{
        background: dragOver ? "#F5F3FF" : "linear-gradient(180deg, #FAFBFF 0%, #F3F4FF 100%)",
        border: dragOver ? "1.5px solid #7C3AED" : "1.5px dashed #C7D2FE",
        borderRadius: 12,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        cursor: disabled || uploading ? "not-allowed" : "default",
        transition: "border-color 0.15s, background 0.15s",
        opacity: disabled ? 0.6 : 1,
      }}
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

      {/* Icon box */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 11,
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Paperclip size={20} strokeWidth={1.75} color="#7C3AED" />
      </div>

      {/* Text */}
      <div style={{ textAlign: "center", lineHeight: 1.4 }}>
        <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
          Arraste o arquivo ou
        </p>
        <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>
          PDF, JPG ou PNG · até 10 MB
        </p>
      </div>

      {/* Button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        style={{
          height: 36,
          paddingLeft: 16,
          paddingRight: 16,
          background: "#fff",
          border: "1px solid #E5E7EB",
          borderRadius: 9,
          fontSize: 13,
          fontWeight: 600,
          color: "#374151",
          cursor: disabled || uploading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          opacity: disabled || uploading ? 0.6 : 1,
        }}
      >
        {uploading && <Loader2 size={14} className="animate-spin" />}
        {uploading ? "Enviando..." : label}
      </button>
    </div>
  );
}
