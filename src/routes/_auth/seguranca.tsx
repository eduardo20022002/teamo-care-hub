import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  listFactors,
  enrollTotp,
  challengeAndVerify,
  unenroll,
  type MfaFactor,
  type MfaEnrollResponse,
} from "@/services/mfa.service";
import { formatDateBR } from "@/lib/formatters";

export const Route = createFileRoute("/_auth/seguranca")({
  head: () => ({
    meta: [{ title: "Segurança — TEAmo" }],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [enrolling, setEnrolling] = useState<MfaEnrollResponse | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const all = await listFactors();
      setFactors(all);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar fatores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const verifiedTotp = factors.find((f) => f.factor_type === "totp" && f.status === "verified");

  const handleEnroll = async () => {
    setEnrollLoading(true);
    try {
      // Limpa enrollments incompletos prévios para evitar acúmulo
      const unverified = factors.filter((f) => f.status === "unverified");
      for (const f of unverified) {
        await unenroll(f.id);
      }
      const enrollData = await enrollTotp();
      setEnrolling(enrollData);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar enrollment.");
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!enrolling || code.length !== 6) return;
    setVerifying(true);
    try {
      await challengeAndVerify(enrolling.factorId, code);
      toast.success("Autenticação em dois fatores habilitada!");
      setEnrolling(null);
      setCode("");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Código inválido. Tente novamente.");
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (!enrolling) return;
    try {
      await unenroll(enrolling.factorId);
    } catch {
      /* noop */
    }
    setEnrolling(null);
    setCode("");
  };

  const handleRemove = async (factorId: string) => {
    if (!confirm("Remover este fator de autenticação? Você poderá habilitar novamente depois.")) {
      return;
    }
    setRemoving(factorId);
    try {
      await unenroll(factorId);
      toast.success("Fator removido.");
      await refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover fator.");
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <LoadingSpinner label="Carregando..." />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-foreground">Segurança da conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a autenticação em dois fatores (2FA) para proteger os dados clínicos da sua família.
        </p>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            {verifiedTotp ? (
              <ShieldCheck className="mt-1 h-5 w-5 text-success" strokeWidth={1.75} />
            ) : (
              <ShieldAlert className="mt-1 h-5 w-5 text-amber-500" strokeWidth={1.75} />
            )}
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">
                Autenticação em dois fatores (TOTP)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {verifiedTotp
                  ? `Ativada em ${formatDateBR(verifiedTotp.created_at)}. A cada login você precisará informar um código do seu app autenticador.`
                  : "Use um app como Google Authenticator, 1Password ou Authy para gerar códigos temporários."}
              </p>
              {verifiedTotp ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleRemove(verifiedTotp.id)}
                  disabled={removing === verifiedTotp.id}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Remover 2FA
                </Button>
              ) : (
                <Button onClick={handleEnroll} disabled={enrollLoading} className="mt-3" size="sm">
                  {enrollLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ativar 2FA
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog open={!!enrolling} onOpenChange={(o) => !o && void handleCancelEnroll()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar autenticador</DialogTitle>
            <DialogDescription>
              Escaneie o QR code com seu app autenticador e informe o código gerado.
            </DialogDescription>
          </DialogHeader>
          {enrolling && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-lg border border-border bg-white p-4">
                <img
                  src={enrolling.qrCode}
                  alt="QR code para configurar 2FA"
                  className="h-48 w-48"
                />
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  Não consegue escanear? Digite manualmente:
                </p>
                <code className="mt-1 block break-all font-mono text-xs text-foreground">
                  {enrolling.secret}
                </code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-code">Código de 6 dígitos</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  autoFocus
                  className="font-mono text-center text-lg tracking-widest"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => void handleCancelEnroll()} disabled={verifying}>
              Cancelar
            </Button>
            <Button onClick={() => void handleVerify()} disabled={verifying || code.length !== 6}>
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
