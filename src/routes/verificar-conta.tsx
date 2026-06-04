import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { resendVerification, verifySignupOtp } from "@/services/auth.service";
import { useAuth } from "@/hooks/useAuth";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #6D3FE0 45%, #C13A8C 85%, #EC4899 100%)";
const RESEND_COOLDOWN_S = 60;
// Comprimento do código OTP — deve corresponder ao "Email OTP Length" no Supabase
const OTP_LENGTH = 8;

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
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
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

  // Quando o usuário fica autenticado (código validado, ou confirmou em outra
  // aba), encaminha para o aceite de convite pendente ou onboarding.
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

  const handleVerify = async (value?: string) => {
    const otp = (value ?? code).trim();
    if (!email || otp.length !== OTP_LENGTH || verifying) return;
    setVerifying(true);
    const res = await verifySignupOtp(email, otp);
    setVerifying(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível confirmar o código.");
      setCode("");
      return;
    }
    // Sucesso: a sessão é criada pelo Supabase; o useEffect acima detecta o
    // usuário autenticado e redireciona para o destino correto.
    toast.success("E-mail confirmado!");
  };

  const handleResend = async () => {
    if (!email || resending || cooldown > 0) return;
    setResending(true);
    const res = await resendVerification(email);
    setResending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível reenviar o código.");
      if (res.rateLimitSeconds) setCooldown(res.rateLimitSeconds);
      return;
    }
    toast.success("Código reenviado. Verifique seu e-mail.");
    setCode("");
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
          Enviamos um código de {OTP_LENGTH} dígitos para{" "}
          <span className="font-semibold" style={{ color: "#1F2937" }}>{maskedEmail}</span>.
          <br />
          Digite o código abaixo para ativar sua conta.
        </p>

        {/* Entrada do código */}
        <div className="mt-7 flex justify-center">
          <InputOTP
            maxLength={OTP_LENGTH}
            value={code}
            onChange={(v) => {
              const digits = v.replace(/\D/g, "").slice(0, OTP_LENGTH);
              setCode(digits);
              if (digits.length === OTP_LENGTH) void handleVerify(digits);
            }}
            inputMode="numeric"
            disabled={verifying}
            containerClassName="gap-1.5"
          >
            <InputOTPGroup className="gap-1.5">
              {Array.from({ length: OTP_LENGTH }, (_, i) => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-9 rounded-xl border border-[#E5E7EB] text-lg font-bold"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Botão confirmar */}
        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={code.length !== OTP_LENGTH || verifying}
          className="mt-7 flex items-center justify-center gap-2 w-full text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{
            height: 52,
            borderRadius: 12,
            background: BRAND_GRADIENT,
            boxShadow: "0 10px 24px -8px rgba(79,70,229,0.5), 0 4px 12px -4px rgba(236,72,153,0.3)",
          }}
        >
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirmando…
            </>
          ) : (
            "Confirmar código"
          )}
        </button>

        <div
          className="mt-6 rounded-2xl p-4 text-sm"
          style={{ background: "#F9FAFB", color: "#6B7280", lineHeight: 1.5 }}
        >
          <p>
            <span className="font-semibold" style={{ color: "#1F2937" }}>Não recebeu?</span>{" "}
            Verifique a caixa de spam ou solicite o reenvio abaixo.
          </p>
        </div>

        {/* Reenviar código */}
        <button
          type="button"
          onClick={handleResend}
          disabled={!email || resending || cooldown > 0}
          className="mt-4 flex items-center justify-center gap-2 w-full text-sm font-semibold rounded-xl border border-[#E5E7EB] text-[#4F46E5] transition-colors hover:bg-[#F8FAFC] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ height: 48 }}
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Reenviando…
            </>
          ) : cooldown > 0 ? (
            `Aguarde ${cooldown}s para reenviar`
          ) : (
            "Reenviar código"
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
