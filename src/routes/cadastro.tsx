import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type FC } from "react";
import { Loader2, Mail, Lock, Eye, EyeOff, User, Baby, Stethoscope, Building2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordStrengthBar, PasswordRules } from "@/components/auth/PasswordStrengthBar";
import { signUp, signInWithGoogle } from "@/services/auth.service";
import { signUpSchema } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";
import { checkEmailTypeServer } from "@/lib/auth.functions";
import type { UserType } from "@/lib/validation";

const TEAL = "#0D9488";
const BRAND_GRADIENT = "linear-gradient(135deg, #4F46E5 0%, #6D3FE0 45%, #C13A8C 85%, #EC4899 100%)";
const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === "true";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta — TEAmo" },
      { name: "description", content: "Crie sua conta no TEAmo em poucos segundos." },
    ],
  }),
  validateSearch: z.object({
    invite:             z.string().optional(),
    therapistInvite:    z.string().optional(),
    profissionalInvite: z.string().optional(),
    userType:           z.string().optional(),
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

type IconComponent = FC<{ size: number; color: string; strokeWidth: number }>;
const USER_TYPE_OPTIONS: Array<{ type: UserType; icon: IconComponent; label: string; desc: string }> = [
  { type: "parent",             icon: Baby,        label: "Responsável / Familiar",    desc: "Pai, mãe, cuidador" },
  { type: "therapist",          icon: Stethoscope, label: "Terapeuta / Profissional",  desc: "Psicólogo, fonoaudiólogo…" },
  { type: "clinic_coordinator", icon: Building2,   label: "Clínica / Coordenador",     desc: "Clínica ABA, coordenador" },
];

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
      <div className="grid grid-cols-3 gap-2">
        {USER_TYPE_OPTIONS.map(({ type, icon: Icon, label, desc }) => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange(type)}
              className="flex flex-col items-center gap-2 rounded-xl border-2 px-2 py-4 text-center transition-all"
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
                <p className="text-xs font-semibold leading-tight" style={{ color: selected ? "#0F766E" : "#374151" }}>
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
  const { invite, therapistInvite, profissionalInvite, userType: userTypeParam } = Route.useSearch();
  const [userType, setUserType] = useState<UserType>(
    userTypeParam === "therapist" ? "therapist" : "parent",
  );
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
      } else if (profissionalInvite) {
        navigate({ to: "/convite-profissional/$token", params: { token: profissionalInvite } });
      } else if (invite) {
        navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
      } else {
        navigate({ to: "/onboarding" });
      }
    }
  }, [loading, user, navigate, invite, therapistInvite, profissionalInvite]);

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
      if (profissionalInvite) {
        try { sessionStorage.setItem("teamo:pendingProfissionalInvite", profissionalInvite); } catch { /* não crítico */ }
      }
      if (userType === "therapist") {
        try { sessionStorage.setItem("teamo:pendingUserType", "therapist"); } catch { /* não crítico */ }
      } else if (userType === "clinic_coordinator") {
        try { sessionStorage.setItem("teamo:pendingUserType", "clinic_coordinator"); } catch { /* não crítico */ }
      }
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate({ to: "/verificar-conta" });
    } else {
      toast.success("Conta criada com sucesso!");
      if (therapistInvite) {
        navigate({ to: "/convite-terapeuta/$token/aceitar", params: { token: therapistInvite } });
      } else if (profissionalInvite) {
        navigate({ to: "/convite-profissional/$token", params: { token: profissionalInvite } });
      } else if (invite) {
        navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
      } else if (userType === "therapist") {
        navigate({ to: "/onboarding/terapeuta" });
      } else if (userType === "clinic_coordinator") {
        navigate({ to: "/clinica/onboarding" });
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
            <label htmlFor="signup-name" className="text-sm font-medium text-foreground">
              Como prefere ser chamado(a)?
            </label>
            <AuthInput
              id="signup-name"
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
            <label htmlFor="signup-email" className="text-sm font-medium text-foreground">E-mail</label>
            <AuthInput
              id="signup-email"
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
            <label htmlFor="signup-password" className="text-sm font-medium text-foreground">Senha</label>
            <AuthInput
              id="signup-password"
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
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="text-muted-foreground hover:text-foreground transition-colors"
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
            <label htmlFor="signup-confirm" className="text-sm font-medium text-foreground">Confirmar senha</label>
            <AuthInput
              id="signup-confirm"
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
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  className="text-muted-foreground hover:text-foreground transition-colors"
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

        {/* Google OAuth — apenas para responsáveis, não para convites de terapeuta */}
        {GOOGLE_ENABLED && !therapistInvite && (
          <>
            <div className="relative flex items-center gap-3 mt-6 mb-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">ou entre com</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={() => void signInWithGoogle({ invite: invite ?? undefined })}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border-[1.5px] border-border bg-white text-sm font-medium text-foreground transition-colors hover:bg-gray-50 active:bg-gray-100"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Cadastrar com Google
            </button>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              Apenas para responsáveis e familiares.
            </p>
          </>
        )}

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
