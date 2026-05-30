import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { resendVerification } from "@/services/auth.service";
import { useAuth } from "@/hooks/useAuth";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #6D3FE0 45%, #C13A8C 85%, #EC4899 100%)";
const RESEND_COOLDOWN_S = 60;

export const Route = createFileRoute("/verificar-conta")({
  head: () => ({
    meta: [
      { title: "Verificar conta — TEAmo" },
      { name: "description", content: "Confirme seu e-mail para continuar." },
    ],
  }),
  component: VerifyAccountPage,
});

function VerifyAccountPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState<string>("");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Carrega o e-mail do sessionStorage (vindo do /cadastro) ou da sessão atual.
  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("teamo:pendingEmail") : null;
    if (stored) {
      setEmail(stored);
    } else if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Se o usuário já está autenticado (confirmou o e-mail em outra aba, ou voltou
  // depois de confirmar), encaminha para o aceite de convite pendente ou onboarding.
  useEffect(() => {
    if (loading || !user) return;
    const pendingInvite =
      typeof window !== "undefined" ? sessionStorage.getItem("teamo:pendingInvite") : null;
    const pendingTherapistInvite =
      typeof window !== "undefined" ? sessionStorage.getItem("teamo:pendingTherapistInvite") : null;
    const pendingUserType =
      typeof window !== "undefined" ? sessionStorage.getItem("teamo:pendingUserType") : null;

    sessionStorage.removeItem("teamo:pendingEmail");
    sessionStorage.removeItem("teamo:pendingInvite");
    sessionStorage.removeItem("teamo:pendingTherapistInvite");
    sessionStorage.removeItem("teamo:pendingUserType");

    if (pendingTherapistInvite) {
      navigate({ to: "/convite-terapeuta/$token/aceitar", params: { token: pendingTherapistInvite } });
    } else if (pendingInvite) {
      navigate({ to: "/convite/$token/aceitar", params: { token: pendingInvite } });
    } else if (pendingUserType === "therapist") {
      navigate({ to: "/onboarding/terapeuta" });
    } else {
      navigate({ to: "/onboarding" });
    }
  }, [loading, user, navigate]);

  // Countdown do botão de reenvio.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    const res = await resendVerification(email);
    setResending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível reenviar o link.");
      return;
    }
    toast.success("Link reenviado. Verifique seu e-mail.");
    setCooldown(RESEND_COOLDOWN_S);
  };

  const maskedEmail = email
    ? email.replace(/^(.)(.*)(@.*)$/, (_, a, mid, dom) => `${a}${"•".repeat(Math.max(1, mid.length))}${dom}`)
    : "seu e-mail";

  return (
    <AuthShell>
      <div>
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "rgba(79,70,229,0.08)" }}
        >
          <Mail size={26} style={{ color: "#4F46E5" }} />
        </div>

        <h1
          className="text-[28px] font-extrabold leading-tight tracking-tight text-center"
          style={{ color: "#0F172A" }}
        >
          Confirme seu e-mail
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-center" style={{ color: "#6B7280" }}>
          Enviamos um link de confirmação para{" "}
          <span className="font-semibold" style={{ color: "#1F2937" }}>{maskedEmail}</span>.
          <br />
          Clique no link recebido para ativar sua conta e continuar.
        </p>

        <div
          className="mt-6 rounded-2xl p-4 text-sm"
          style={{ background: "#F9FAFB", color: "#6B7280", lineHeight: 1.5 }}
        >
          <p>
            <span className="font-semibold" style={{ color: "#1F2937" }}>Não recebeu?</span>{" "}
            Verifique a caixa de spam ou solicite o reenvio abaixo.
          </p>
          <p className="mt-2 text-xs">
            Em breve você poderá receber o código também por SMS.
          </p>
        </div>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || resending || cooldown > 0}
          className="mt-6 flex items-center justify-center gap-2 w-full text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{
            height: 52,
            borderRadius: 12,
            background: BRAND_GRADIENT,
            boxShadow: "0 10px 24px -8px rgba(79,70,229,0.5), 0 4px 12px -4px rgba(236,72,153,0.3)",
          }}
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reenviando…
            </>
          ) : cooldown > 0 ? (
            `Aguarde ${cooldown}s para reenviar`
          ) : (
            "Reenviar link de confirmação"
          )}
        </button>

        <p className="mt-8 text-center text-sm" style={{ color: "#6B7280" }}>
          E-mail errado?{" "}
          <Link
            to="/cadastro"
            className="font-semibold hover:underline"
            style={{ color: "#4F46E5" }}
          >
            Voltar e corrigir
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
