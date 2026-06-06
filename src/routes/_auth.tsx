import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { signOut } from "@/services/auth.service";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos (recomendação HIPAA/LGPD)
const IDLE_WARN_BEFORE_MS = 60 * 1000; // avisa 1 minuto antes

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [warnOpen, setWarnOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    // Defesa em profundidade: bloqueia usuários sem e-mail confirmado.
    // Após habilitar "Confirm email" no Supabase Dashboard, novos cadastros
    // só chegam aqui após confirmar. Esta guarda cobre edge-cases.
    if (!user.email_confirmed_at) {
      try { sessionStorage.setItem("teamo:pendingEmail", user.email ?? ""); } catch { /* ok */ }
      navigate({ to: "/verificar-conta" });
      return;
    }
  }, [loading, user, navigate]);

  const handleTimeout = useCallback(async () => {
    setWarnOpen(false);
    await signOut("idle");
    toast.info("Sua sessão expirou por inatividade. Entre novamente.");
    navigate({ to: "/login" });
  }, [navigate]);

  const handleWarn = useCallback(() => {
    setWarnOpen(true);
  }, []);

  useIdleTimeout(IDLE_TIMEOUT_MS, handleTimeout, !!user, {
    warnBeforeMs: IDLE_WARN_BEFORE_MS,
    onWarn: handleWarn,
  });

  // Continuar — qualquer atividade reseta ambos os timers
  const handleContinue = () => {
    setWarnOpen(false);
    // Disparar evento de atividade para que useIdleTimeout resete os timers
    window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  };

  if (loading || !user || !user.email_confirmed_at) return <LoadingSpinner label="Carregando..." />;

  return (
    <>
      <Outlet />

      <Dialog
        open={warnOpen}
        onOpenChange={(open) => {
          if (!open) handleContinue();
        }}
      >
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Sua sessão vai expirar</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Por inatividade, sua sessão vai expirar em{" "}
              <strong className="text-foreground">1 minuto</strong>. Deseja continuar conectado?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void handleTimeout()}
            >
              Sair agora
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleContinue}>
              Continuar conectado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
