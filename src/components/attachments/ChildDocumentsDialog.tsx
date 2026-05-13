import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" strokeWidth={1.75} />
            Documentos {child ? `de ${child.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Laudos, relatórios escolares, prescrições e outros documentos da
            criança.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <AttachmentUploader
            onFiles={async (files) => {
              await uploadMutation.mutateAsync(files);
            }}
            uploading={uploadMutation.isPending}
            label="Adicionar documento"
          />

          {isLoading ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
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
