import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderOpen, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteChildAttachment,
  listChildAttachments,
  uploadChildAttachment,
} from "@/services/attachments.service";
import { AttachmentUploader } from "./AttachmentUploader";
import { AttachmentList } from "./AttachmentList";
import { DeleteAttachmentDialog } from "./DeleteAttachmentDialog";
import { EmptyAttachments } from "./EmptyAttachments";
import type { AttachmentItemData } from "./AttachmentItem";
import type { Child } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: Child | null;
}

export function ChildDocumentsDialog({ open, onOpenChange, child }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<AttachmentItemData | null>(null);

  const childId = child?.id ?? "";
  const queryKey = ["child-attachments", childId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listChildAttachments(childId),
    enabled: open && !!user && !!childId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let success = 0;
      for (const file of files) {
        try {
          await uploadChildAttachment(user!.id, childId, file);
          success++;
        } catch (e) {
          toast.error(
            `${file.name}: ${(e as Error).message ?? "Falha no envio."}`,
          );
        }
      }
      return success;
    },
    onSuccess: (success) => {
      if (success > 0) {
        toast.success(
          success === 1 ? "Documento enviado." : `${success} documentos enviados.`,
        );
        qc.invalidateQueries({ queryKey });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (a: AttachmentItemData) => deleteChildAttachment(a),
    onSuccess: () => {
      toast.success("Documento removido.");
      qc.invalidateQueries({ queryKey });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden"
        style={{
          borderRadius: 20,
          maxWidth: 480,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #F1F2F6",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: "#EEF1FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <FolderOpen size={18} strokeWidth={1.75} color="#4F46E5" />
            </div>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>
              Documentos{child ? ` de ${child.name}` : ""}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: "#F4F5FA",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Fechar"
          >
            <X size={16} strokeWidth={2} color="#6B7280" />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "16px 20px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <AttachmentUploader
            onFiles={async (files) => {
              await uploadMutation.mutateAsync(files);
            }}
            uploading={uploadMutation.isPending}
          />

          {isLoading ? (
            <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
              Carregando...
            </p>
          ) : list.length === 0 ? (
            <EmptyAttachments />
          ) : (
            <AttachmentList
              attachments={list}
              onDelete={(a) => setDeleting(a)}
              deletingId={deleteMutation.isPending ? deleting?.id : null}
            />
          )}
        </div>

        <DeleteAttachmentDialog
          open={!!deleting}
          fileName={deleting?.file_name}
          onOpenChange={(o) => {
            if (!o) setDeleting(null);
          }}
          onConfirm={() => deleting && deleteMutation.mutate(deleting)}
          loading={deleteMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
