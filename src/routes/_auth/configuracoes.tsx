import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Loader2, Lock, Settings, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  challengeAndVerify,
  enrollTotp,
  listFactors,
  unenroll,
  type MfaEnrollResponse,
  type MfaFactor,
} from "@/services/mfa.service";
import { formatDateBR } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_auth/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações — TEAmo" }],
  }),
  component: ConfiguracoesPage,
});

// ─── Helper row components ────────────────────────────────────────────────────
function NavRow({
  icon,
  label,
  subtitle,
  right,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const isClickable = !!onClick && !disabled;
  const Tag = isClickable ? "button" : "div";
  return (
    <Tag
      {...(isClickable ? { type: "button" as const, onClick } : {})}
      className={`flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-0 ${
        isClickable ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right ??
        (isClickable ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.75} />
        ) : null)}
    </Tag>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {children}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── MFA state (from seguranca.tsx) ─────────────────────────────────────────
  const [mfaLoading, setMfaLoading] = useState(true);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [enrolling, setEnrolling] = useState<MfaEnrollResponse | null>(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);

  const verifiedTotp = factors.find((f) => f.factor_type === "totp" && f.status === "verified");

  const refreshFactors = async () => {
    setMfaLoading(true);
    try {
      const all = await listFactors();
      setFactors(all);
    } catch {
      /* silently ignore — 2FA row will just show as OFF */
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    void refreshFactors();
  }, []);

  // ── MFA handlers ─────────────────────────────────────────────────────────────
  const handleMfaToggle = async (on: boolean) => {
    if (on) {
      // Enroll
      setEnrollLoading(true);
      try {
        const unverified = factors.filter((f) => f.status === "unverified");
        for (const f of unverified) await unenroll(f.id);
        const data = await enrollTotp();
        setEnrolling(data);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Falha ao iniciar configuração.");
      } finally {
        setEnrollLoading(false);
      }
    } else {
      // Unenroll
      if (!verifiedTotp) return;
      setRemoving(true);
      try {
        await unenroll(verifiedTotp.id);
        toast.success("Autenticação em 2 etapas desativada.");
        await refreshFactors();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Falha ao remover 2FA.");
      } finally {
        setRemoving(false);
      }
    }
  };

  const handleVerify = async () => {
    if (!enrolling || code.length !== 6) return;
    setVerifying(true);
    try {
      await challengeAndVerify(enrolling.factorId, code);
      toast.success("Autenticação em 2 etapas ativada!");
      setEnrolling(null);
      setCode("");
      await refreshFactors();
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

  // ── Password subtitle ─────────────────────────────────────────────────────
  const lastSignIn = user?.last_sign_in_at;
  const passwordSubtitle = lastSignIn
    ? `Atualizada em ${formatDateBR(lastSignIn)}`
    : "Alterar senha da conta";

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar
          </button>
        </div>

        {/* Title */}
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Settings className="h-6 w-6 text-primary" strokeWidth={1.75} />
            Configurações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Por enquanto, o essencial: segurança da conta e informações do app.
          </p>
        </header>

        {/* SEGURANÇA */}
        <SectionCard title="Segurança">
          <NavRow
            icon={<Lock className="h-4 w-4" strokeWidth={1.75} />}
            label="Alterar senha"
            subtitle={passwordSubtitle}
            onClick={() => navigate({ to: "/recuperar-senha" })}
          />
          <NavRow
            icon={<Shield className="h-4 w-4" strokeWidth={1.75} />}
            label="Autenticação em 2 etapas"
            subtitle={
              verifiedTotp
                ? `Ativa desde ${formatDateBR(verifiedTotp.created_at)}`
                : "Código por autenticador"
            }
            right={
              <Switch
                checked={!!verifiedTotp}
                onCheckedChange={handleMfaToggle}
                disabled={mfaLoading || enrollLoading || removing}
                aria-label="Ativar autenticação em 2 etapas"
              />
            }
          />
        </SectionCard>

        {/* SOBRE */}
        <SectionCard title="Sobre">
          <NavRow
            icon={<span className="text-xs font-bold text-muted-foreground">v</span>}
            label="Versão"
            right={<span className="text-sm text-muted-foreground">1.0.0</span>}
          />
          <NavRow
            icon={<span className="text-xs text-muted-foreground">📋</span>}
            label="Termos de uso"
            onClick={() => toast("Termos de uso em breve.")}
          />
          <NavRow
            icon={<span className="text-xs text-muted-foreground">🔒</span>}
            label="Política de privacidade"
            onClick={() => toast("Política de privacidade em breve.")}
          />
          <NavRow
            icon={<span className="text-xs text-muted-foreground">💬</span>}
            label="Fale com a gente"
            onClick={() => navigate({ to: "/ajuda" })}
          />
        </SectionCard>
      </div>

      {/* ── MFA Enrollment Dialog ────────────────────────────────────────────── */}
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
                <Label htmlFor="totp-code-cfg">Código de 6 dígitos</Label>
                <Input
                  id="totp-code-cfg"
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
