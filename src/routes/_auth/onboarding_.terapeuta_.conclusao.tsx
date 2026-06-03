import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Users, UserRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/onboarding/terapeuta/conclusao")({
  head: () => ({
    meta: [{ title: "Bem-vindo ao TEAmo!" }],
  }),
  component: TherapistConclusaoPage,
});

type OnboardingResult = "comEmails" | "semEmails" | "semPacientes";

function getDisplayName(user: ReturnType<typeof useAuth>["user"]): string {
  const meta = user?.user_metadata as { display_name?: string } | undefined;
  if (meta?.display_name?.trim()) return meta.display_name.trim().split(" ")[0];
  return user?.email?.split("@")[0] ?? "Terapeuta";
}

function TherapistConclusaoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = getDisplayName(user);

  const [result, setResult] = useState<OnboardingResult>("semPacientes");

  useEffect(() => {
    const stored = sessionStorage.getItem("teamo:onboarding:therapist:result") as OnboardingResult | null;
    if (stored) {
      setResult(stored);
      sessionStorage.removeItem("teamo:onboarding:therapist:result");
    }
  }, []);

  const config: Record<
    OnboardingResult,
    {
      icon: typeof CheckCircle2;
      iconColor: string;
      title: string;
      text: string;
      cta: string;
      ctaAction: () => void;
      secondary?: string;
      secondaryAction?: () => void;
    }
  > = {
    comEmails: {
      icon: CheckCircle2,
      iconColor: TEAL,
      title: `Tudo pronto, ${firstName}!`,
      text: "Seus pacientes foram cadastrados e os convites foram enviados. Assim que os responsáveis aceitarem, você poderá registrar sessões e acompanhar a evolução.",
      cta: "Ir para o painel",
      ctaAction: () => navigate({ to: "/dashboard" }),
    },
    semEmails: {
      icon: Users,
      iconColor: TEAL,
      title: "Pacientes cadastrados!",
      text: "Lembre-se de convidar os responsáveis para ativar o acesso completo. Você encontra essa opção no perfil de cada paciente.",
      cta: "Ir para o painel",
      ctaAction: () => navigate({ to: "/dashboard" }),
    },
    semPacientes: {
      icon: UserRound,
      iconColor: "#7C3AED",
      title: "Bem-vindo ao TEAmo!",
      text: "Quando estiver pronto, adicione seus pacientes pelo painel para começar a organizar os atendimentos.",
      cta: "Adicionar meu primeiro paciente",
      ctaAction: () => navigate({ to: "/onboarding/terapeuta/pacientes" }),
      secondary: "Explorar o painel primeiro",
      secondaryAction: () => navigate({ to: "/dashboard" }),
    },
  };

  const c = config[result];
  const Icon = c.icon;

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-[400px] px-4 py-12 flex flex-col items-center text-center">
        {/* Ícone animado */}
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: result === "semPacientes" ? "#F3E8FF" : TEAL_SOFT }}
        >
          <Icon
            size={40}
            strokeWidth={1.5}
            color={c.iconColor}
            className={result !== "semPacientes" ? "animate-[scale-in_0.4s_ease-out]" : ""}
          />
        </div>

        {/* Título */}
        <h1 className="text-[26px] font-extrabold text-[#0F172A] leading-tight mb-3">
          {c.title}
        </h1>

        {/* Texto */}
        <p className="text-sm text-[#6B7280] leading-relaxed mb-8 max-w-[320px]">
          {c.text}
        </p>

        {/* CTA principal */}
        <button
          type="button"
          onClick={c.ctaAction}
          className="h-12 w-full rounded-xl text-white text-[15px] font-bold transition-all hover:-translate-y-px mb-3"
          style={{
            background:
              result === "semPacientes"
                ? "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)"
                : TEAL,
          }}
        >
          {c.cta}
        </button>

        {/* CTA secundário */}
        {c.secondary && (
          <button
            type="button"
            onClick={c.secondaryAction}
            className="text-sm text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
          >
            {c.secondary}
          </button>
        )}

        {/* Barra de progresso completa (decorativa) */}
        <div className="mt-12 flex items-center gap-2 w-full max-w-[200px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 flex-1 rounded-full"
              style={{ background: TEAL }}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#9CA3AF]">Etapa 3 de 3 concluída</p>
      </div>
    </AppShell>
  );
}
