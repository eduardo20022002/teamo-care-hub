import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
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
  validateSearch: z.object({ email: z.string().optional() }).parse,
  component: RecoverPasswordPage,
});

function RecoverPasswordPage() {
  const { email: initialEmail } = Route.useSearch();
  const [email, setEmail] = useState(initialEmail ?? "");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message);
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    const res = await requestPasswordReset(parsed.data);
    setSubmitting(false);
    // Rate limit: único erro que expomos explicitamente (os demais são genéricos para evitar enumeração)
    if (!res.ok && res.rateLimitSeconds) {
      toast.error(res.error ?? "Muitas tentativas. Aguarde antes de tentar novamente.");
      setCooldown(res.rateLimitSeconds);
      return;
    }
    // Para todos os outros casos (sucesso ou e-mail não encontrado), mostramos sucesso genérico
    setSent(true);
  };

  return (
    <AuthShell>
      <div>
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
              rel="noreferrer"
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
              rel="noreferrer"
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

              <Button type="submit" className="w-full" disabled={submitting || cooldown > 0}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {cooldown > 0 ? `Aguarde ${cooldown}s` : "Enviar link de recuperação"}
              </Button>
            </form>
          </>
        )}

        <TrustBadge />
      </div>
    </AuthShell>
  );
}
