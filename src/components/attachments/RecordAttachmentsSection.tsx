import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteRecordAttachment,
  listRecordAttachments,
  uploadRecordAttachment,
} from "@/services/attachments.service";
import { AttachmentUploader } from "./AttachmentUploader";
import { AttachmentList } from "./AttachmentList";
import { DeleteAttachmentDialog } from "./DeleteAttachmentDialog";
import type { AttachmentItemData } from "./AttachmentItem";

interface Props {
  recordId: string;
}

export function RecordAttachmentsSection({ recordId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState<AttachmentItemData | null>(null);

  const queryKey = ["record-attachments", recordId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => listRecordAttachments(recordId),
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      let success = 0;
      let failed = 0;
      for (const file of files) {
        try {
          await uploadRecordAttachment(user!.id, recordId, file);
          success++;
        } catch (e) {
          failed++;
          toast.error(
            `${file.name}: ${(e as Error).message ?? "Falha no envio."}`,
          );
        }
      }
      return { success, failed };
    },
    onSuccess: ({ success, failed }) => {
      if (success > 0) {
        toast.success(
          success === 1 ? "Anexo enviado." : `${success} anexos enviados.`,
        );
        qc.invalidateQueries({ queryKey });
        qc.invalidateQueries({ queryKey: ["record-attachments-count", recordId] });
      }
      if (success === 0 && failed === 0) {
        // nada a fazer
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (a: AttachmentItemData) => deleteRecordAttachment(a),
    onSuccess: () => {
      toast.success("Anexo removido.");
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["record-attachments-count", recordId] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <AttachmentUploader
        onFiles={(files) => uploadMutation.mutateAsync(files)}
        uploading={uploadMutation.isPending}
      />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando anexos...</p>
      ) : (
        <AttachmentList
          attachments={data ?? []}
          onDelete={(a) => setDeleting(a)}
          deletingId={deleteMutation.isPending ? deleting?.id : null}
        />
      )}

      <DeleteAttachmentDialog
        open={!!deleting}
        fileName={deleting?.file_name}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
