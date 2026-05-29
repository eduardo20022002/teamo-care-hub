import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, Eye, EyeOff, User, Baby } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordStrengthBar, PasswordRules } from "@/components/auth/PasswordStrengthBar";
import { signUp } from "@/services/auth.service";
import { signUpSchema } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";

const TEAL = "#0D9488";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — TEAmo" },
      { name: "description", content: "Crie sua conta no TEAmo em poucos segundos." },
    ],
  }),
  validateSearch: z.object({ invite: z.string().optional() }).parse,
  component: SignupPage,
});

function InviteBanner() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
      style={{ background: "#F0FDFA", border: "1px solid #99F6E4" }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: "#CCFBF1" }}
      >
        <Baby size={18} color={TEAL} strokeWidth={1.8} />
      </div>
      <p className="text-sm leading-snug" style={{ color: "#0F766E" }}>
        Crie sua conta para aceitar o convite e acompanhar o cuidado no TEAmo.
      </p>
    </div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { invite } = Route.useSearch();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && user) {
      if (invite) {
        navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  }, [loading, user, navigate, invite]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const f: typeof errors = {};

    const parsed = signUpSchema.safeParse({ displayName, email, password, confirmPassword });
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof typeof f;
        if (k && !f[k]) f[k] = i.message;
      }
    }
    if (!agreedToTerms) {
      f.terms = "Você precisa aceitar os Termos de Uso para continuar.";
    }
    if (Object.keys(f).length > 0) {
      setErrors(f);
      return;
    }

    setErrors({});
    setSubmitting(true);
    const res = await signUp(parsed.data!.email, parsed.data!.password, parsed.data!.displayName);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível criar a conta.");
      if (res.rateLimitSeconds) setCooldown(res.rateLimitSeconds);
      return;
    }
    if (res.needsConfirmation) {
      try { sessionStorage.setItem("teamo:pendingEmail", email); } catch { /* não crítico */ }
      if (invite) {
        try { sessionStorage.setItem("teamo:pendingInvite", invite); } catch { /* não crítico */ }
      }
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate({ to: "/verificar-conta" });
    } else {
      toast.success("Conta criada com sucesso!");
      if (invite) {
        navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  };

  return (
    <AuthShell>
      <div>
        {/* Banner de convite */}
        {invite && <InviteBanner />}

        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
          {invite ? "Criar conta para aceitar convite" : "Crie sua conta gratuita"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {invite
            ? "Crie sua conta e aceite o convite para acompanhar o cuidado."
            : "Comece a organizar o cuidado de quem você ama em poucos minutos."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Como prefere ser chamado(a)?
            </label>
            <AuthInput
              type="text"
              autoComplete="given-name"
              placeholder="Seu nome ou apelido"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={submitting}
              error={!!errors.displayName}
              leadingIcon={<User size={16} />}
            />
            {errors.displayName && (
              <p className="text-xs text-red-500">{errors.displayName}</p>
            )}
          </div>

          {/* E-mail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              E-mail
            </label>
            <AuthInput
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              error={!!errors.email}
              leadingIcon={<Mail size={16} />}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Senha
            </label>
            <AuthInput
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Crie uma senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              error={!!errors.password}
              leadingIcon={<Lock size={16} />}
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
            <PasswordStrengthBar password={password} />
            <PasswordRules password={password} />
          </div>

          {/* Confirmar senha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Confirmar senha
            </label>
            <AuthInput
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repita sua senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              error={!!errors.confirmPassword}
              leadingIcon={<Lock size={16} />}
              trailingIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Termos */}
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <span
                className={`mt-0.5 flex-shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border transition-colors ${
                  agreedToTerms ? "border-primary bg-primary" : "border-border bg-white"
                }`}
              >
                {agreedToTerms && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6l3 3 6-6" />
                  </svg>
                )}
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
              </span>
              <span className="text-sm leading-snug text-muted-foreground">
                Concordo com os{" "}
                <a
                  href="#"
                  className="font-semibold text-primary hover:underline"
                  onClick={(e) => e.preventDefault()}
                >
                  Termos de Uso
                </a>{" "}
                e a{" "}
                <a
                  href="#"
                  className="font-semibold text-primary hover:underline"
                  onClick={(e) => e.preventDefault()}
                >
                  Política de Privacidade
                </a>
                .
              </span>
            </label>
            {errors.terms && (
              <p className="text-xs text-red-500">{errors.terms}</p>
            )}
          </div>

          {/* Botão criar conta */}
          <button
            type="submit"
            disabled={submitting || cooldown > 0}
            className="btn-brand"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando conta…
              </>
            ) : cooldown > 0 ? (
              `Aguarde ${cooldown}s`
            ) : (
              "Criar minha conta"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link
            to="/login"
            search={invite ? { invite } : {}}
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
