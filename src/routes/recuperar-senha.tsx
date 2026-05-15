import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/AuthShell";
import { TrustBadge } from "@/components/auth/TrustBadge";
import { requestPasswordReset } from "@/services/auth.service";
import { emailSchema } from "@/lib/validation";

export const Route = createFileRoute("/recuperar-senha")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — TEAmo" },
      { name: "description", content: "Redefina sua senha do TEAmo." },
    ],
  }),
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message);
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    // Always show success to avoid email enumeration
    await requestPasswordReset(parsed.data);
    setSubmitting(false);
    setSent(true);
  };

  return (
    <AuthShell>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
              <span className="text-2xl">📬</span>
            </div>
            <h1 className="text-xl font-semibold text-foreground">Verifique seu e-mail</h1>
            <p className="text-sm text-muted-foreground">
              Se esse endereço estiver cadastrado, você receberá um link para redefinir sua
              senha em breve.
            </p>
            <p className="text-xs text-muted-foreground">
              Não encontrou? Verifique a caixa de spam.
            </p>
            <Link
              to="/login"
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar para o login
            </Link>
          </div>
        ) : (
          <>
            <Link
              to="/login"
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Recuperar senha</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe seu e-mail e enviaremos um link para você redefinir sua senha.
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
                {emailError && <p className="text-xs text-destructive">{emailError}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar link de recuperação
              </Button>
            </form>
          </>
        )}

        <TrustBadge />
      </div>
    </AuthShell>
  );
}
