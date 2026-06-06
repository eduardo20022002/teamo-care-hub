import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthShell } from "@/components/auth/AuthShell";
import { PasswordStrengthBar, PasswordRules } from "@/components/auth/PasswordStrengthBar";
import { TrustBadge } from "@/components/auth/TrustBadge";
import { updatePassword } from "@/services/auth.service";
import { passwordSchema } from "@/lib/validation";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — TEAmo" },
      { name: "description", content: "Crie uma nova senha para sua conta TEAmo." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase envia PASSWORD_RECOVERY quando o link de redefinição é seguido.
    // Aguardamos esse evento antes de liberar o formulário.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setSessionReady(true);
      } else if (event === "SIGNED_OUT") {
        setSessionError(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Se o evento PASSWORD_RECOVERY não chegar em 12s, o link é inválido ou expirado.
  useEffect(() => {
    if (sessionReady) return;
    const timer = setTimeout(() => {
      setSessionError(true);
    }, 30_000);
    return () => clearTimeout(timer);
  }, [sessionReady]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    const f: typeof errors = {};
    if (!parsed.success) {
      f.password = parsed.error.issues[0]?.message;
    }
    if (password !== confirmPassword) {
      f.confirmPassword = "As senhas não coincidem.";
    }
    if (Object.keys(f).length > 0) {
      setErrors(f);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const res = await updatePassword(password);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível redefinir a senha.");
      return;
    }
    setDone(true);
    toast.success("Senha redefinida com sucesso!");
    setTimeout(() => navigate({ to: "/login" }), 2500);
  };

  if (sessionError) {
    return (
      <AuthShell>
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Link expirado</h1>
          <p className="text-sm text-muted-foreground">
            Este link de redefinição de senha expirou ou já foi utilizado.
          </p>
          <Link
            to="/recuperar-senha"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Solicitar novo link
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell>
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Senha redefinida!</h1>
          <p className="text-sm text-muted-foreground">
            Você será redirecionado para o login em instantes…
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Redefinir senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma senha forte para proteger sua conta.
        </p>

        {!sessionReady && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando link de recuperação…
          </div>
        )}

        {sessionReady && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
              <PasswordStrengthBar password={password} />
              <PasswordRules password={password} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
              />
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir senha
            </Button>
          </form>
        )}

        <TrustBadge />
      </div>
    </AuthShell>
  );
}
