import { useState } from "react";
import { Check, Copy, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

interface Props {
  url: string;
  professionalName: string;
  expiresAt: string;
  onClose: () => void;
}

export function ShareConfirmationStep({ url, professionalName, expiresAt, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const expiresLabel = (() => {
    try {
      return new Date(expiresAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return expiresAt;
    }
  })();

  const handleSend = async () => {
    const text = `Compartilhei conteúdo com você no TEAmo. Acesse: ${url}\nVocê receberá um código de 6 dígitos por e-mail.`;
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "TEAmo — Compartilhamento",
          text,
          url,
        });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await handleCopy(true);
  };

  const handleCopy = async (silent = false) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (!silent) setTimeout(() => setCopied(false), 2500);
      else setTimeout(() => setCopied(false), 2500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.75} />
          Link gerado com segurança
        </div>
        <p className="text-xs text-muted-foreground">
          Quando <strong>{professionalName}</strong> abrir o link, vai receber um código de 6
          dígitos no e-mail cadastrado para confirmar o acesso. Expira em <strong>{expiresLabel}</strong>.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Link
        </label>
        <div className="flex items-stretch gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleCopy()}
            aria-label="Copiar link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" strokeWidth={2} />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.75} />
            )}
          </Button>
        </div>
      </div>

      <Button type="button" onClick={handleSend} className="w-full">
        <Send className="mr-2 h-4 w-4" strokeWidth={1.75} />
        Enviar link
      </Button>

      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <Link
          to="/compartilhamentos"
          onClick={onClose}
          className="font-medium text-primary hover:underline"
        >
          Ver compartilhamentos ativos
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="font-medium text-muted-foreground hover:text-foreground"
        >
          Concluir
        </button>
      </div>
    </div>
  );
}
