import { useState } from "react";
import { Check, Copy, Send, ShieldCheck, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listChildren } from "@/services/children.service";
import { sendParentProfessionalInviteServer } from "@/lib/parent-professional.functions";

interface Props {
  url: string;
  professionalName: string;
  professionalEmail?: string;
  expiresAt: string;
  onClose: () => void;
}

export function ShareConfirmationStep({
  url,
  professionalName,
  professionalEmail,
  expiresAt,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [inviteState, setInviteState] = useState<
    "idle" | "sending" | "sent" | "already_active" | "already_pending" | "error"
  >("idle");
  const [showChildPicker, setShowChildPicker] = useState(false);

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!professionalEmail,
  });

  const children = childrenQuery.data ?? [];
  const activeChildId = selectedChildId ?? (children.length === 1 ? children[0]?.id ?? null : null);
  const activeChildName = children.find((c) => c.id === activeChildId)?.name ?? null;

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
        await (navigator as any).share({ title: "TEAmo — Compartilhamento", text, url });
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

  const handleConfirmInvite = async () => {
    if (!professionalEmail || !activeChildId) return;
    setInviteState("sending");
    try {
      const res = await sendParentProfessionalInviteServer({
        data: {
          childId: activeChildId,
          inviteeEmail: professionalEmail,
          inviteeName: professionalName,
          otpShareLink: url,
        },
      });
      if (res.result === "already_active") {
        setInviteState("already_active");
      } else if (res.result === "already_pending") {
        setInviteState("already_pending");
      } else {
        setInviteState("sent");
      }
    } catch {
      setInviteState("error");
    }
  };

  // Dispara automaticamente na primeira renderização se toggle ON e dados disponíveis
  const [autoTriggered, setAutoTriggered] = useState(false);
  if (
    !autoTriggered &&
    inviteEnabled &&
    professionalEmail &&
    activeChildId &&
    inviteState === "idle"
  ) {
    setAutoTriggered(true);
    void handleConfirmInvite();
  }

  return (
    <div className="space-y-4">
      {/* Link seguro */}
      <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
        <div className="mb-1 flex items-center gap-1.5 font-medium">
          <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.75} />
          Link gerado com segurança
        </div>
        <p className="text-xs text-muted-foreground">
          Quando <strong>{professionalName}</strong> abrir o link, vai receber um código de 6
          dígitos no e-mail para confirmar o acesso. Expira em <strong>{expiresLabel}</strong>.
        </p>
      </div>

      {/* Link OTP */}
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

      {/* Convite para o TEAmo */}
      {professionalEmail && (
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: inviteEnabled ? "#99F6E4" : "#E5E7EB", background: inviteEnabled ? "#F0FDFA" : "#F9FAFB" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: inviteEnabled ? "#CCFBF1" : "#E5E7EB" }}
            >
              <Users size={16} color={inviteEnabled ? "#0D9488" : "#9CA3AF"} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-[#0F172A]">
                  Convidar para o TEAmo
                </p>
                <button
                  type="button"
                  onClick={() => setInviteEnabled((v) => !v)}
                  className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                  style={{ background: inviteEnabled ? "#0D9488" : "#D1D5DB" }}
                  aria-checked={inviteEnabled}
                  role="switch"
                >
                  <span
                    className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200"
                    style={{ transform: inviteEnabled ? "translateX(16px)" : "translateX(0)" }}
                  />
                </button>
              </div>
              <p className="mt-0.5 text-[12px] text-[#6B7280] leading-snug">
                {inviteEnabled
                  ? `Enviaremos um convite para ${professionalName} criar conta gratuita e ter acesso contínuo.`
                  : "Somente o link com código será enviado."}
              </p>
            </div>
          </div>

          {inviteEnabled && children.length > 1 && (
            <div>
              <p className="text-[12px] text-[#374151] font-medium mb-1.5">
                Para qual criança?
              </p>
              <div className="flex flex-wrap gap-2">
                {children.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChildId(c.id)}
                    className="rounded-full px-3 py-1 text-[12px] font-medium border transition-colors"
                    style={
                      activeChildId === c.id
                        ? { background: "#0D9488", color: "#fff", borderColor: "#0D9488" }
                        : { background: "#fff", color: "#374151", borderColor: "#D1D5DB" }
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {inviteEnabled && (
            <div className="flex items-center gap-2 text-[12px]">
              {inviteState === "idle" && !activeChildId && children.length > 1 && (
                <span className="text-[#9CA3AF]">Selecione a criança acima para enviar o convite</span>
              )}
              {inviteState === "sending" && (
                <>
                  <Loader2 size={13} className="animate-spin text-[#0D9488]" />
                  <span className="text-[#0D9488]">Enviando convite…</span>
                </>
              )}
              {inviteState === "sent" && (
                <>
                  <Check size={13} className="text-[#16A34A]" />
                  <span className="text-[#16A34A] font-medium">Convite enviado para {professionalEmail}</span>
                </>
              )}
              {inviteState === "already_active" && (
                <>
                  <Check size={13} className="text-[#16A34A]" />
                  <span className="text-[#16A34A] font-medium">{professionalName} já acompanha essa criança no TEAmo</span>
                </>
              )}
              {inviteState === "already_pending" && (
                <>
                  <Check size={13} className="text-[#0D9488]" />
                  <span className="text-[#0D9488]">Convite já enviado anteriormente — reenvie pelo painel se necessário</span>
                </>
              )}
              {inviteState === "error" && (
                <button
                  type="button"
                  onClick={handleConfirmInvite}
                  className="text-red-500 underline"
                >
                  Falha ao enviar convite — tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
