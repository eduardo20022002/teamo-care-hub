import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "./ShareDialog";

interface Props {
  variant?: "icon" | "button";
  preSelectedRecordIds?: string[];
  preSelectedDocChildIds?: string[];
  preSelectedDocRecordIds?: string[];
  preSelectedProfessionalId?: string;
  label?: string;
  className?: string;
}

export function ShareTriggerButton({
  variant = "icon",
  preSelectedRecordIds,
  preSelectedDocChildIds,
  preSelectedDocRecordIds,
  preSelectedProfessionalId,
  label = "Compartilhar",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => setOpen(true)}
          className={className ?? "h-8 w-8 text-muted-foreground hover:text-primary"}
        >
          <Share2 className="h-4 w-4" strokeWidth={1.75} />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
          <Share2 className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
          {label}
        </Button>
      )}
      <ShareDialog
        open={open}
        onOpenChange={setOpen}
        preSelectedRecordIds={preSelectedRecordIds}
        preSelectedDocChildIds={preSelectedDocChildIds}
        preSelectedDocRecordIds={preSelectedDocRecordIds}
        preSelectedProfessionalId={preSelectedProfessionalId}
      />
    </>
  );
}
