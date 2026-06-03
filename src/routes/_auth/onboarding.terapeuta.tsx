// Redirect transparente para o novo fluxo de onboarding do terapeuta.
// O fluxo foi migrado para 3 etapas separadas:
//   /onboarding/terapeuta/perfil   (perguntas de perfil por chips)
//   /onboarding/terapeuta/pacientes (cadastro de pacientes com responsáveis)
//   /onboarding/terapeuta/conclusao (tela contextual de boas-vindas)
// Este arquivo preserva a rota /onboarding/terapeuta para links existentes.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";

const TEAL = "#0D9488";

export const Route = createFileRoute("/_auth/onboarding/terapeuta")({
  head: () => ({
    meta: [{ title: "Onboarding — TEAmo" }],
  }),
  component: TherapistOnboardingRedirect,
});

function TherapistOnboardingRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/onboarding/terapeuta/perfil" as any });
  }, [navigate]);

  return (
    <AppShell hideMenu>
      <div className="flex min-h-[50vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: TEAL, borderTopColor: "transparent" }}
        />
      </div>
    </AppShell>
  );
}
