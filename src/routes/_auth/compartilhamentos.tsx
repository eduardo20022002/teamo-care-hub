import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Share2,
  ShieldOff,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  buildPublicShareUrl,
  deriveShareStatus,
  useListShares,
  useRevokeShare,
  useRenewShare,
  type ShareSummary,
} from "@/services/sharing.service";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { RenewShareDialog } from "@/components/sharing/RenewShareDialog";
import type { ExpiryHours } from "@/components/sharing/ShareExpiryStep";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
const PASTEL_GRADIENT =
  "linear-gradient(140deg, #E5E9FF 0%, #ECE5FE 45%, #FDE8F3 100%)";

const SHARE_COLOR = "#EA7B3D";
const SHARE_TINT = "#FFF4ED";

interface SharesSearch {
  prefillEventId?: string;
}

export const Route = createFileRoute("/_auth/compartilhamentos")({
  head: () => ({ meta: [{ title: "Compartilhamentos — TEAmo" }] }),
  validateSearch: (search: Record<string, unknown>): SharesSearch => ({
    prefillEventId:
      typeof search.prefillEventId === "string"
        ? search.prefillEventId
        : undefined,
  }),
  component: SharesPage,
});

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (
    (parts[0][0]?.toUpperCase() ?? "") +
    (parts[parts.length - 1][0]?.toUpperCase() ?? "")
  );
}

const STATUS_CONFIG = {
  active: {
    label: "Ativo",
    borderColor: "#2F9E44",
    badgeBg: "rgba(47,158,68,0.12)",
    badgeColor: "#2F9E44",
  },
  expired: {
    label: "Expirado",
    borderColor: "#9CA3AF",
    badgeBg: "rgba(156,163,175,0.15)",
    badgeColor: "#6B7280",
  },
  revoked: {
    label: "Revogado",
    borderColor: "#EF4444",
    badgeBg: "rgba(239,68,68,0.1)",
    badgeColor: "#DC2626",
  },
} as const;

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ background: cfg.badgeBg, color: cfg.badgeColor }}
    >
      {cfg.label}
    </span>
  );
}

function ShareCard({
  share,
  status,
  onCopy,
  onRenew,
  onRevoke,
  revoking,
}: {
  share: ShareSummary;
  status: keyof typeof STATUS_CONFIG;
  onCopy: () => void;
  onRenew: () => void;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const cfg = STATUS_CONFIG[status];
  const initials = getInitials(share.professional_name);

  return (
    <div
      className="overflow-hidden rounded-[16px] border border-[#EEF0F4] bg-white shadow-sm"
      style={{ borderLeftWidth: 3, borderLeftColor: cfg.borderColor }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{ background: PASTEL_GRADIENT, color: "#4F46E5" }}
          >
            {initials}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[15px] font-semibold text-foreground">
                {share.professional_name}
              </p>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{share.professional_email}</span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              {share.item_count} {share.item_count === 1 ? "item" : "itens"} ·
              Expira {formatDateTime(share.expires_at)}
              {share.renewals_count > 0 && (
                <> · Renovado {share.renewals_count}x</>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        {status === "active" && (
          <div className="mt-3 flex gap-2 border-t border-[#EEF0F4] pt-3">
            <button
              type="button"
              onClick={onCopy}
              className="flex-1 rounded-[10px] border border-[#EEF0F4] bg-[#F6F7FB] py-2 text-xs font-semibold text-foreground transition-colors hover:bg-[#EEF1FF] hover:text-[#4F46E5]"
            >
              Copiar link
            </button>
            <button
              type="button"
              onClick={onRenew}
              className="flex items-center gap-1.5 rounded-[10px] border border-[#EEF0F4] bg-[#F6F7FB] px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-[#EEF1FF] hover:text-[#4F46E5]"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              Renovar
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Revogar acesso"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#EEF0F4] bg-[#F6F7FB] text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                >
                  <ShieldOff className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O profissional perderá o acesso imediatamente. Esta ação
                    não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onRevoke}
                    disabled={revoking}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {revoking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Revogar"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {status === "expired" && (
          <div className="mt-3 border-t border-[#EEF0F4] pt-3">
            <button
              type="button"
              onClick={onRenew}
              className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#EEF0F4] bg-[#F6F7FB] py-2 text-xs font-semibold text-foreground transition-colors hover:bg-[#EEF1FF] hover:text-[#4F46E5]"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              Renovar acesso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyShares({ onNew }: { onNew: () => void }) {
  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center rounded-[20px] p-8 text-center"
        style={{ background: PASTEL_GRADIENT }}
      >
        <div
          className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[22px]"
          style={{ background: SHARE_TINT }}
        >
          <Share2 className="h-8 w-8" style={{ color: SHARE_COLOR }} strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Nada compartilhado ainda
        </h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Gere um link seguro e envie por e-mail, com prazo e código de 6
          dígitos para o profissional.
        </p>
        <button
          type="button"
          onClick={onNew}
          className="mt-6 flex h-[50px] items-center gap-2 rounded-[12px] px-8 text-sm font-semibold text-white"
          style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Criar compartilhamento
        </button>
      </div>

      <div className="rounded-[16px] border border-[#EEF0F4] bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Como funciona
        </p>
        <div className="space-y-3">
          {[
            { n: "1", t: "Você escolhe o conteúdo", d: "Registros e documentos da criança." },
            { n: "2", t: "O profissional recebe um e-mail", d: "Com link e código de 6 dígitos." },
            { n: "3", t: "Acesso expira no prazo", d: "Você pode revogar a qualquer momento." },
          ].map(({ n, t, d }) => (
            <div key={n} className="flex items-start gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                {n}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SharesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useListShares();
  const revokeFn = useRevokeShare();
  const renewFn = useRenewShare();
  const { prefillEventId } = Route.useSearch();
  const [shareOpen, setShareOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<ShareSummary | null>(null);

  useEffect(() => {
    if (prefillEventId) {
      setShareOpen(true);
      toast.message(
        "Pré-selecione conteúdo do evento abaixo (anexos/registros associados).",
      );
    }
  }, [prefillEventId]);

  const sharesQuery = useQuery({
    queryKey: ["shares"],
    queryFn: async () => (await listFn({ data: undefined as never })).shares,
    enabled: !!user,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { shareId: id } }),
    onSuccess: () => {
      toast.success("Compartilhamento revogado.");
      qc.invalidateQueries({ queryKey: ["shares"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: (input: { shareId: string; expiresInHours: ExpiryHours }) =>
      renewFn({ data: input }),
    onSuccess: () => {
      toast.success(
        "Compartilhamento renovado. O profissional precisará validar um novo código no próximo acesso.",
      );
      setRenewTarget(null);
      qc.invalidateQueries({ queryKey: ["shares"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const all = sharesQuery.data ?? [];
    const buckets: Record<"active" | "expired" | "revoked", ShareSummary[]> = {
      active: [],
      expired: [],
      revoked: [],
    };
    for (const s of all) buckets[deriveShareStatus(s)].push(s);
    return buckets;
  }, [sharesQuery.data]);

  const hasAny = (sharesQuery.data ?? []).length > 0;

  return (
    <AppShell>
      {/* Back link */}
      <div className="mb-5">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Voltar ao início
        </Link>
      </div>

      {/* Header */}
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: SHARE_TINT }}
          >
            <Share2 className="h-5 w-5" style={{ color: SHARE_COLOR }} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-foreground leading-tight">
              Compartilhamentos
            </h1>
            <p className="text-xs text-muted-foreground">
              Envie informações e documentos para profissionais com um link seguro.
            </p>
          </div>
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold text-white"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Novo</span>
          </button>
        )}
      </header>

      {/* Loading */}
      {sharesQuery.isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !hasAny ? (
        <EmptyShares onNew={() => setShareOpen(true)} />
      ) : (
        <div className="space-y-6">
          {(["active", "expired", "revoked"] as const).map((status) =>
            grouped[status].length === 0 ? null : (
              <section key={status}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {status === "active"
                    ? "Ativos"
                    : status === "expired"
                      ? "Expirados"
                      : "Revogados"}
                </h2>
                <div className="space-y-3">
                  {grouped[status].map((s) => (
                    <ShareCard
                      key={s.id}
                      share={s}
                      status={status}
                      onCopy={() => {
                        navigator.clipboard.writeText(buildPublicShareUrl(s.token));
                        toast.success("Link copiado.");
                      }}
                      onRenew={() => setRenewTarget(s)}
                      onRevoke={() => revoke.mutate(s.id)}
                      revoking={revoke.isPending}
                    />
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <RenewShareDialog
        open={!!renewTarget}
        onOpenChange={(o) => !o && setRenewTarget(null)}
        professionalName={renewTarget?.professional_name ?? ""}
        pending={renew.isPending}
        onConfirm={(hours) =>
          renewTarget &&
          renew.mutate({ shareId: renewTarget.id, expiresInHours: hours })
        }
      />
      <span className="hidden">{String(!!navigate)}</span>
    </AppShell>
  );
}
