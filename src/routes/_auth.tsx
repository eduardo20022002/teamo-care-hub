import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { signOut } from "@/services/auth.service";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos (recomendação HIPAA/LGPD para sistemas com dados sensíveis de saúde)

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!user.email_confirmed_at) {
      navigate({ to: "/verificar-conta" });
    }
  }, [loading, user, navigate]);

  useIdleTimeout(
    IDLE_TIMEOUT_MS,
    async () => {
      await signOut("idle");
      toast.info("Sua sessão expirou por inatividade. Entre novamente.");
      navigate({ to: "/login" });
    },
    !!user,
  );

  if (loading || !user || !user.email_confirmed_at) return <LoadingSpinner label="Carregando..." />;
  return <Outlet />;
}
