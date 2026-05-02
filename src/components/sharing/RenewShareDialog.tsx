import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShareExpiryStep, type ExpiryHours } from "./ShareExpiryStep";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalName: string;
  defaultHours?: ExpiryHours;
  pending: boolean;
  onConfirm: (hours: ExpiryHours) => void;
}

export function RenewShareDialog({
  open,
  onOpenChange,
  professionalName,
  defaultHours = 2160,
  pending,
  onConfirm,
}: Props) {
  const [hours, setHours] = useState<ExpiryHours>(defaultHours);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" strokeWidth={1.75} />
            Renovar compartilhamento
          </DialogTitle>
          <DialogDescription>
            O mesmo link continua valendo para <strong>{professionalName}</strong>, mas será
            exigido um novo código por e-mail no próximo acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <ShareExpiryStep value={hours} onChange={setHours} />
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => onConfirm(hours)} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar renovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
