import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { CategoryBadge } from "@/components/attendance/CategoryBadge";
import { formatDateBR, formatFileSize } from "@/lib/formatters";
import { WatermarkOverlay } from "@/components/sharing/public/WatermarkOverlay";
import {
  requestShareOtp,
  validateShareOtp,
  getSharedDocumentUrl,
  type ValidateOtpResponse,
} from "@/services/sharing-public.service";

export const Route = createFileRoute("/compartilhamento/$token")({
  head: () => ({
    meta: [
      { title: "Compartilhamento seguro — TEAmo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicSharePage,
});

type Phase = "idle" | "loading" | "otp" | "ok" | "error";

function PublicSharePage() {
  const { token } = Route.useParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [emailMasked, setEmailMasked] = useState<string>("");
  const [ttl, setTtl] = useState<number>(10);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [validated, setValidated] = useState<ValidateOtpResponse | null>(null);

  const handleRequestCode = async () => {
    setPhase("loading");
    const res = await requestShareOtp(token);
    if (res.ok) {
      setEmailMasked(res.professionalEmailMasked ?? "");
      setTtl(res.ttlMinutes ?? 10);
      setPhase("otp");
    } else {
      setPhase("error");
      setErrorMsg(translateError(res.error, res.detail));
    }
  };

  const handleSubmit = async () => {
    if (otp.length !== 6) return;
    setSubmitting(true);
    try {
      const res = await validateShareOtp(token, otp);
      if (res.ok) {
        setValidated(res);
        setPhase("ok");
      } else {
        if (typeof res.attemptsRemaining === "number") {
          setAttemptsRemaining(res.attemptsRemaining);
        }
        setErrorMsg(translateError(res.error));
        if (
          res.error === "expired" ||
          res.error === "revoked" ||
          res.error === "too_many_attempts"
        ) {
          setPhase("error");
        }
        setOtp("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    try {
      const res = await requestShareOtp(token);
      if (res.ok) {
        setEmailMasked(res.professionalEmailMasked ?? emailMasked);
        setTtl(res.ttlMinutes ?? 10);
        setErrorMsg("");
        setAttemptsRemaining(null);
      } else {
        setErrorMsg(translateError(res.error, res.detail));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <BrandLogo className="text-xl" />
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" strokeWidth={1.75} />
            Conexão segura
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {phase === "idle" && (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Conteúdo protegido</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Para acessar, enviaremos um código de verificação para o e-mail cadastrado neste
              compartilhamento.
            </p>
            <Button className="mt-5 w-full" onClick={handleRequestCode}>
              Receber código por e-mail
            </Button>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "otp" && (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-foreground">Confirme seu acesso</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviamos um código de 6 dígitos para{" "}
              <strong className="text-foreground">{emailMasked || "o e-mail cadastrado"}</strong>.
              Ele é válido por {ttl} minutos.
            </p>

            <div className="mt-5 flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(v) => setOtp(v.replace(/\D/g, ""))}
                inputMode="numeric"
                autoFocus
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-11 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {errorMsg && (
              <p className="mt-3 text-center text-xs text-destructive">
                {errorMsg}
                {attemptsRemaining !== null && attemptsRemaining > 0 && (
                  <> · {attemptsRemaining} tentativa(s) restantes</>
                )}
              </p>
            )}

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || otp.length !== 6}
              className="mt-5 w-full"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Acessar conteúdo
            </Button>

            <button
              type="button"
              onClick={handleResend}
              disabled={submitting}
              className="mt-3 block w-full text-center text-xs font-medium text-primary hover:underline"
            >
              Reenviar código
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" strokeWidth={1.75} />
            <h1 className="text-lg font-semibold text-foreground">Não foi possível abrir</h1>
            <p className="mt-1 text-sm text-muted-foreground">{errorMsg}</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Entre em contato com o responsável que enviou o link.
            </p>
          </div>
        )}

        {phase === "ok" && validated && <SharedContentView data={validated} />}
      </main>
    </div>
  );
}

function SharedContentView({ data }: { data: ValidateOtpResponse }) {
  const profName = data.professional?.name ?? "Profissional";
  const stamp = new Date().toLocaleString("pt-BR");
  const watermarkText = `${profName} · ${stamp}`;

  return (
    <>
      <WatermarkOverlay text={watermarkText} />
      <div className="relative z-10 space-y-6">
        <header className="rounded-2xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.75} />
            Acesso liberado para {profName}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Conteúdo protegido por marca d'água. O link expira em{" "}
            {data.shareExpiresAt ? new Date(data.shareExpiresAt).toLocaleString("pt-BR") : "—"}.
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3 shrink-0" />
            Esta sessão é válida apenas nesta guia. Recarregar pedirá um novo código.
          </p>
        </header>

        {(data.content?.records.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Registros ({data.content!.records.length})
            </h2>
            <div className="space-y-2">
              {data.content!.records.map((r) => (
                <article
                  key={r.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <CategoryBadge category={r.category} />
                    <span className="text-xs text-muted-foreground">
                      {formatDateBR(r.record_date)}
                    </span>
                    {r.child_name && (
                      <span className="text-xs font-medium text-foreground">· {r.child_name}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">{r.professional_name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{r.content}</p>
                  {r.attachments.length > 0 && (
                    <ul className="mt-3 space-y-2 border-t border-border pt-3">
                      {r.attachments.map((d) => (
                        <SharedDocItem key={d.id} doc={d} accessToken={data.accessToken!} />
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {(data.content?.documents.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documentos ({data.content!.documents.length})
            </h2>
            <ul className="space-y-2">
              {data.content!.documents.map((d) => (
                <SharedDocItem
                  key={`${d.source}-${d.id}`}
                  doc={d}
                  accessToken={data.accessToken!}
                />
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Área de resposta — disponível em breve
          </p>
        </section>

        <div className="pb-8" />
      </div>
    </>
  );
}

function SharedDocItem({
  doc,
  accessToken,
}: {
  doc: {
    id: string;
    source: "child" | "record";
    file_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
  };
  accessToken: string;
}) {
  const [opening, setOpening] = useState(false);
  const isImage = doc.mime_type.startsWith("image/");
  const handleOpen = async () => {
    setOpening(true);
    try {
      const url = await getSharedDocumentUrl(accessToken, doc.source, doc.id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  };
  return (
    <li>
      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-primary-soft/30"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          {isImage ? (
            <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <FileText className="h-4 w-4" strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {doc.file_name}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {formatFileSize(doc.size_bytes)} · {formatDateBR(doc.created_at.slice(0, 10))}
          </span>
        </span>
        {opening && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </button>
    </li>
  );
}

function translateError(code?: string, detail?: string): string {
  switch (code) {
    case "not_found":
      return "Link inválido. Verifique se você abriu a URL completa.";
    case "expired":
      return "Este link expirou.";
    case "revoked":
      return "O acesso foi revogado pelo responsável.";
    case "otp_expired":
      return "O código expirou. Solicite um novo.";
    case "otp_invalid":
      return "Código incorreto. Tente novamente.";
    case "otp_not_requested":
      return "Solicite um novo código para continuar.";
    case "too_many_attempts":
      return "Muitas tentativas. Este link foi bloqueado por segurança.";
    case "email_failed":
      return detail ?? "Não foi possível enviar o código agora. Tente reenviar.";
    case "cooldown":
      return detail
        ? `Aguarde alguns instantes antes de solicitar um novo código. (${detail})`
        : "Aguarde antes de solicitar um novo código.";
    case "too_many_requests":
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
    default:
      return detail ?? "Não foi possível concluir. Tente novamente.";
  }
}
