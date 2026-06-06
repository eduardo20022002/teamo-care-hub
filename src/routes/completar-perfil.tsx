import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Baby, Lock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";
import { completeOAuthProfileServer } from "@/lib/auth.functions";

const TEAL = "#0D9488";
const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #6D3FE0 45%, #C13A8C 85%, #EC4899 100%)";

export const Route = createFileRoute("/completar-perfil")({
  head: () => ({
    meta: [
      { title: "Completar cadastro — TEAmo" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: z.object({
    invite:          z.string().optional(),
    therapistInvite: z.string().optional(),
  }).parse,
  component: CompletarPerfilPage,
});

function CompletarPerfilPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { invite, therapistInvite } = Route.useSearch();

  const [displayName, setDisplayName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsError, setTermsError] = useState(false);

  // Pré-preenche o nome do Google
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata as Record<string, string> | undefined;
    const name =
      meta?.display_name ?? meta?.full_name ?? meta?.name ?? "";
    if (name) setDisplayName(name);
  }, [user]);

  // Usuário já completou o perfil → redireciona
  useEffect(() => {
    if (loading || !user) return;
    if (user.user_metadata?.terms_accepted === true) {
      redirectAfterCompletion();
    }
  }, [loading, user]);

  // Usuário não autenticado → vai pro login
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  function redirectAfterCompletion() {
    if (therapistInvite) {
      navigate({ to: "/convite-terapeuta/$token/aceitar", params: { token: therapistInvite } });
    } else if (invite) {
      navigate({ to: "/convite/$token/aceitar", params: { token: invite } });
    } else {
      navigate({ to: "/onboarding" });
    }
  }

  const handleSubmit = async () => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    setSubmitting(true);
    try {
      await completeOAuthProfileServer({
        data: { displayName: displayName.trim() || undefined },
      });
      toast.success("Tudo pronto! Bem-vindo(a) ao TEAmo.");
      redirectAfterCompletion();
    } catch {
      toast.error("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <AuthShell>
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: TEAL }} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-foreground">
          Quase lá!
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Confirme seus dados para entrar no TEAmo.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Como prefere ser chamado(a)?
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Seu nome ou apelido"
              disabled={submitting}
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488] disabled:opacity-60"
            />
          </div>

          {/* Tipo de conta — fixo e bloqueado */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Tipo de conta</label>
            <div
              className="flex items-center gap-3 rounded-xl border-2 px-4 py-3"
              style={{ borderColor: TEAL, background: "#F0FDFA" }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0"
                style={{ background: "#CCFBF1" }}
              >
                <Baby size={18} color={TEAL} strokeWidth={1.7} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "#0F766E" }}>
                  Responsável / Familiar
                </p>
                <p className="text-xs" style={{ color: "#6B7280" }}>
                  Pai, mãe, cuidador
                </p>
              </div>
              <Lock size={14} color="#9CA3AF" strokeWidth={2} />
            </div>
            <p className="text-xs text-muted-foreground">
              Login com Google é exclusivo para responsáveis.{" "}
              <Link to="/cadastro" className="font-semibold text-primary hover:underline">
                Terapeuta? Cadastre-se com e-mail →
              </Link>
            </p>
          </div>

          {/* Aceite de termos */}
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
                  onChange={(e) => {
                    setAgreedToTerms(e.target.checked);
                    if (e.target.checked) setTermsError(false);
                  }}
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
            {termsError && (
              <p className="text-xs text-red-500">
                Você precisa aceitar os Termos de Uso para continuar.
              </p>
            )}
          </div>

          {/* Botão */}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex h-[52px] items-center justify-center gap-2 w-full rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: "0 10px 24px -8px rgba(79,70,229,0.5)",
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando…
              </>
            ) : (
              "Entrar no TEAmo"
            )}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
