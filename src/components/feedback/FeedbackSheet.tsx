import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { submitFeedbackServer } from "@/lib/feedback.functions";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RATINGS = [
  { value: 1 as const, emoji: "😔", label: "Difícil" },
  { value: 2 as const, emoji: "😊", label: "Ok" },
  { value: 3 as const, emoji: "🤩", label: "Incrível" },
];

export function FeedbackSheet({ open, onOpenChange }: Props) {
  const [rating, setRating] = useState<1 | 2 | 3 | null>(null);
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      return submitFeedbackServer({
        data: { rating: rating!, message: message.trim() || undefined },
        headers,
      } as any);
    },
    onSuccess: () => {
      toast.success("Obrigado pelo seu feedback! 💜");
      onOpenChange(false);
      setRating(null);
      setMessage("");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Não foi possível enviar o feedback.");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar feedback"
        className="absolute inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      {/* Painel */}
      <div className="relative w-full sm:w-[440px] animate-in slide-in-from-bottom sm:fade-in duration-200 bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:shadow-[0_20px_60px_rgba(15,23,42,0.2)] rounded-t-3xl sm:rounded-3xl px-5 pt-3 pb-8">
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />

        <h2 className="mb-1 text-base font-semibold text-[#212529]">Como está sendo o TEAmo?</h2>
        <p className="mb-5 text-[13px] text-[#6B7280]">
          Seu feedback nos ajuda a melhorar para você e sua família.
        </p>

        {/* Rating */}
        <div className="mb-5 flex gap-2.5">
          {RATINGS.map((r) => {
            const selected = rating === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setRating(r.value)}
                className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border-2 py-4 transition-all"
                style={
                  selected
                    ? { borderColor: "#4F46E5", background: "#EEF1FF" }
                    : { borderColor: "#E5E7EB", background: "#F6F7FB" }
                }
              >
                <span className="text-3xl leading-none">{r.emoji}</span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: selected ? "#4F46E5" : "#6B7280" }}
                >
                  {r.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Mensagem opcional */}
        <textarea
          rows={3}
          maxLength={1000}
          placeholder="Conta mais (opcional)..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mb-5 w-full resize-none rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] px-3.5 py-3 text-sm text-[#212529] placeholder:text-[#9CA3AF] focus:border-[#4F46E5] focus:outline-none transition-colors"
        />

        {/* Botão enviar */}
        <button
          type="button"
          disabled={!rating || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="w-full rounded-[14px] py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)",
            boxShadow: "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)",
          }}
        >
          {mutation.isPending ? "Enviando…" : "Enviar feedback"}
        </button>
      </div>
    </div>
  );
}
