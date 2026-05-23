import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { BRAND_GRADIENT, BRAND_SHADOW } from "@/lib/agenda/tokens";
import { FeedbackSheet } from "./FeedbackSheet";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Enviar feedback"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white transition-transform hover:-translate-y-0.5 active:scale-95"
        style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
      >
        <MessageCircle className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <FeedbackSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
