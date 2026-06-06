import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Lock, Eye, EyeOff, Baby } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthInput } from "@/components/auth/AuthInput";
import { signIn } from "@/services/auth.service";
import { signInSchema } from "@/lib/validation";
import { useAuth } from "@/hooks/useAuth";

const TEAL = "#0D9488";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — TEAmo" },
      { name: "description", content: "Acesse sua conta TEAmo." },
    ],
  }),
  validateSearch: z.object({
    invite:          z.string().optional(),
    therapistInvite: z.string().optional(),
  }).parse,
  component: LoginPage,
});

function InviteBanner({ ownerName }: { ownerName?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
      style={{ background: "#F0FDFA", border: `1px solid #99F6E4` }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: "#CCFBF1" }}
      >
        <Baby size={18} color={TEAL} strokeWidth={1.8} />
      </div>
      <p className="text-sm leading-snug" style={{ color: "#0F766E" }}>
        {ownerName ? (
          <>
            Você foi convidado(a) por <strong>{ownerName}</strong> para acompanhar o cuidado de uma criança no TEAmo.
          </>
        ) : (
          "Faça login para aceitar o convite no TEAmo."
        )}
      </p>
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { invite, therapistInvite } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

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
        navigate({ to: "/dashboard" });
      }
    }
  }, [loading, user, navigate, invite, therapistInvite]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      const f: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof typeof f;
        if (k && !f[k]) f[k] = i.message;
      }
      setErrors(f);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const res = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível entrar.");
      if (res.rateLimitSeconds) setCooldown(res.rateLimitSeconds);
      return;
    }
    toast.success("Bem-vindo de volta!");
    if (therapistInvite) {
      navigate({ to: "/convite-terapeuta/$token/aceitar", params: { token: therapistInvite } });
    } else if (invite) {
      navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <AuthShell>
      <div>
        {/* Banner de convite */}
        {(invite || therapistInvite) && <InviteBanner />}

        {/* Desktop: título caloroso / Mobile: título direto */}
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
          <span className="hidden lg:inline">
            {invite ? "Entre para aceitar o convite" : "Que bom ter você de volta 👋"}
          </span>
          <span className="lg:hidden">Entrar</span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          <span className="hidden lg:inline">Entre para continuar acompanhando o cuidado da sua família.</span>
          <span className="lg:hidden">Acesse sua conta para acompanhar o cuidado da sua família.</span>
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
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
              autoComplete="current-password"
              placeholder="••••••••"
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
          </div>

          {/* Esqueci a senha */}
          <div className="flex items-center justify-end">
            <Link
              to="/recuperar-senha"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          {/* Botão entrar */}
          <button
            type="submit"
            disabled={submitting || cooldown > 0}
            className="btn-brand"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando…
              </>
            ) : cooldown > 0 ? (
              `Aguarde ${cooldown}s`
            ) : invite ? (
              "Entrar e aceitar convite"
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Divisor social */}
        <div className="relative flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">
            ou continue com
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Botão Google */}
        <button
          type="button"
          disabled
          className="flex items-center justify-center gap-3 w-full h-12 rounded-xl border-[1.5px] border-border bg-white text-sm font-medium text-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          {/* Google SVG logo */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Google
        </button>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Ainda não tem conta?{" "}
          <Link
            to="/cadastro"
            search={invite ? { invite } : {}}
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Cadastre-se
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
