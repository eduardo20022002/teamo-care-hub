import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
  attachmentCount?: number;
}

export function DeleteAttendanceDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  attachmentCount = 0,
}: Props) {
  const hasAttachments = attachmentCount > 0;
  const attachmentText =
    attachmentCount === 1
      ? "1 anexo vinculado também será removido permanentemente."
      : `${attachmentCount} anexos vinculados também serão removidos permanentemente.`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este registro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O registro será removido permanentemente.
            {hasAttachments && ` ${attachmentText}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
