import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BILLING_ENABLED } from "@/lib/plan-limits";

export const Route = createFileRoute("/_auth/premium/ativado")({
  // Cobrança desligada → sem tela de ativação; volta ao dashboard.
  beforeLoad: () => {
    if (!BILLING_ENABLED) throw redirect({ to: "/dashboard" });
  },
  validateSearch: (s: Record<string, unknown>): { scope?: string } => ({
    scope: typeof s.scope === "string" ? s.scope : undefined,
  }),
  head: () => ({ meta: [{ title: "Premium Ativado — TEAmo" }] }),
  component: PremiumAtivadoPage,
});

function PremiumAtivadoPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate({ to: "/dashboard" });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <AppShell onBack={() => navigate({ to: "/dashboard" })}>
      <div className="mx-auto flex h-[70vh] max-w-sm flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Premium ativado!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bem-vindo ao TEAmo Premium. Seu período de trial começou e todos os recursos estão desbloqueados.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Redirecionando em {countdown}s…
        </p>
      </div>
    </AppShell>
  );
}
