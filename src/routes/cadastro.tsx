import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, Eye, EyeOff, User, Baby, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordStrengthBar, PasswordRules } from "@/components/auth/PasswordStrengthBar";
import { signUp } from "@/services/auth.service";
import { signUpSchema } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { checkEmailTypeServer } from "@/lib/auth.functions";
import type { UserType } from "@/lib/validation";

const TEAL = "#0D9488";
const BRAND_GRADIENT = "linear-gradient(135deg, #4F46E5 0%, #6D3FE0 45%, #C13A8C 85%, #EC4899 100%)";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — TEAmo" },
      { name: "description", content: "Crie sua conta no TEAmo em poucos segundos." },
    ],
  }),
  validateSearch: z.object({
    invite:          z.string().optional(),
    therapistInvite: z.string().optional(),
  }).parse,
  component: SignupPage,
});

function InviteBanner({ therapistName }: { therapistName?: string }) {
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
        {therapistName ? (
          <>
            Crie sua conta para aceitar o convite de <strong>{therapistName}</strong> e acompanhar a evolução no TEAmo.
          </>
        ) : (
          "Crie sua conta para aceitar o convite e acompanhar o cuidado no TEAmo."
        )}
      </p>
    </div>
  );
}

function UserTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: UserType;
  onChange: (v: UserType) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">Você é:</label>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { type: "parent" as UserType, icon: Baby, label: "Responsável / Familiar", desc: "Pai, mãe, cuidador" },
            { type: "therapist" as UserType, icon: Stethoscope, label: "Terapeuta / Profissional", desc: "Psicólogo, fonoaudiólogo…" },
          ] as const
        ).map(({ type, icon: Icon, label, desc }) => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type)}
              className="flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all"
              style={{
                borderColor: selected ? TEAL : "#E5E7EB",
                background:  selected ? "#F0FDFA" : "#FAFAFA",
                boxShadow:   selected ? `0 0 0 1px ${TEAL}` : "none",
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: selected ? "#CCFBF1" : "#F3F4F6" }}
              >
                <Icon size={20} color={selected ? TEAL : "#9CA3AF"} strokeWidth={1.7} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight" style={{ color: selected ? "#0F766E" : "#374151" }}>
                  {label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { invite, therapistInvite } = Route.useSearch();
  const [userType, setUserType] = useState<UserType>(therapistInvite ? "parent" : "parent");
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
  const [linkNotice, setLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && user) {
      if (therapistInvite) {
        navigate({ to: "/convite-terapeuta/$token/aceitar", params: { token: therapistInvite } });
      } else if (invite) {
        navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  }, [loading, user, navigate, invite, therapistInvite]);

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
    setLinkNotice(null);
    setSubmitting(true);
    const res = await signUp(parsed.data!.email, parsed.data!.password, parsed.data!.displayName, { userType });

    // E-mail já cadastrado → descobre qual tipo e exibe mensagem orientativa.
    // Regra: 1 e-mail = 1 tipo de perfil. Não há adição de papel secundário.
    if (!res.ok && res.emailExists) {
      setSubmitting(false);
      try {
        const check = await checkEmailTypeServer({ data: { email: parsed.data!.email } });
        if (check.found) {
          const existingLabel = check.userType === "therapist" ? "Terapeuta" : "Responsável";
          const attemptedLabel = userType === "therapist" ? "Terapeuta" : "Responsável";
          if (check.userType === userType) {
            setLinkNotice(
              `Este e-mail já está cadastrado como ${existingLabel}. Faça login para acessar sua conta.`,
            );
          } else {
            setLinkNotice(
              `Este e-mail já está cadastrado como ${existingLabel}. Para usar o TEAmo como ${attemptedLabel}, cadastre-se com outro e-mail.`,
            );
          }
        } else {
          setLinkNotice("Este e-mail já está em uso. Faça login ou use outro e-mail.");
        }
      } catch {
        setLinkNotice("Este e-mail já está em uso. Faça login ou use outro e-mail.");
      }
      return;
    }

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
      if (therapistInvite) {
        try { sessionStorage.setItem("teamo:pendingTherapistInvite", therapistInvite); } catch { /* não crítico */ }
      }
      if (userType === "therapist") {
        try { sessionStorage.setItem("teamo:pendingUserType", "therapist"); } catch { /* não crítico */ }
      }
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate({ to: "/verificar-conta" });
    } else {
      toast.success("Conta criada com sucesso!");
      if (therapistInvite) {
        navigate({ to: "/convite-terapeuta/$token/aceitar", params: { token: therapistInvite } });
      } else if (invite) {
        navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
      } else if (userType === "therapist") {
        navigate({ to: "/onboarding/terapeuta" });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  };

  const hasAnyInvite = !!(invite || therapistInvite);
  const titleText = hasAnyInvite ? "Criar conta para aceitar convite" : "Crie sua conta gratuita";
  const subtitleText = hasAnyInvite
    ? "Crie sua conta e aceite o convite para acompanhar."
    : "Comece a organizar o cuidado de quem você ama em poucos minutos.";

  return (
    <AuthShell>
      <div>
        {/* Banner de convite */}
        {(invite || therapistInvite) && <InviteBanner />}

        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
          {titleText}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitleText}</p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
          {/* Tipo de conta — só mostra se não vier de convite de terapeuta (que assume "parent") */}
          {!therapistInvite && (
            <UserTypeSelector value={userType} onChange={setUserType} disabled={submitting} />
          )}

          {/* Aviso: e-mail já existe (fluxo de adicionar papel de terapeuta) */}
          {linkNotice && (
            <div
              className="flex flex-col gap-2 rounded-xl px-4 py-3"
              style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
            >
              <p className="text-sm leading-snug" style={{ color: "#92400E" }}>{linkNotice}</p>
              <Link
                to="/login"
                className="text-sm font-semibold underline"
                style={{ color: "#0D9488" }}
              >
                Ir para o login
              </Link>
            </div>
          )}

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
            <label className="text-sm font-medium text-foreground">E-mail</label>
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
            <label className="text-sm font-medium text-foreground">Senha</label>
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
            <label className="text-sm font-medium text-foreground">Confirmar senha</label>
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
                <Link
                  to="/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link
                  to="/privacidade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary hover:underline"
                >
                  Política de Privacidade
                </Link>
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
            className="flex h-[52px] items-center justify-center gap-2 w-full rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{ background: BRAND_GRADIENT, boxShadow: "0 10px 24px -8px rgba(79,70,229,0.5)" }}
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
            search={invite ? { invite } : therapistInvite ? { therapistInvite } : {}}
            className="font-semibold text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
