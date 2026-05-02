import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Share2, ShieldOff, Clock, Mail, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";

export const Route = createFileRoute("/_auth/compartilhamentos")({
  head: () => ({ meta: [{ title: "Compartilhamentos — TEAmo" }] }),
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

function StatusBadge({ status }: { status: "active" | "expired" | "revoked" }) {
  const map = {
    active: { label: "Ativo", cls: "bg-success/15 text-success" },
    expired: { label: "Expirado", cls: "bg-muted text-muted-foreground" },
    revoked: { label: "Revogado", cls: "bg-destructive/15 text-destructive" },
  } as const;
  const v = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

function SharesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const listFn = useListShares();
  const revokeFn = useRevokeShare();
  const renewFn = useRenewShare();
  const [shareOpen, setShareOpen] = useState(false);
  const [renewTarget, setRenewTarget] = useState<ShareSummary | null>(null);

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

  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Compartilhamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os links seguros enviados aos profissionais.
          </p>
        </div>
        <Button onClick={() => setShareOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
          Novo
        </Button>
      </header>

      {sharesQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (sharesQuery.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <Share2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground">
            Nenhum compartilhamento ainda
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crie seu primeiro link seguro para um profissional.
          </p>
          <Button className="mt-4" onClick={() => setShareOpen(true)}>
            Criar compartilhamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(["active", "expired", "revoked"] as const).map((status) =>
            grouped[status].length === 0 ? null : (
              <section key={status}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {status === "active"
                    ? "Ativos"
                    : status === "expired"
                      ? "Expirados"
                      : "Revogados"}
                </h2>
                <ul className="space-y-2">
                  {grouped[status].map((s) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {s.professional_name}
                            </p>
                            <StatusBadge status={status} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <Mail className="mr-1 inline h-3 w-3" strokeWidth={1.75} />
                            {s.professional_email}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {s.item_count} {s.item_count === 1 ? "item" : "itens"} ·{" "}
                            <Clock className="inline h-3 w-3" strokeWidth={1.75} /> Expira{" "}
                            {formatDateTime(s.expires_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {status === "active" && (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(buildPublicShareUrl(s.token));
                                  toast.success("Link copiado.");
                                }}
                              >
                                Copiar link
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    aria-label="Revogar"
                                  >
                                    <ShieldOff className="h-4 w-4" strokeWidth={1.75} />
                                  </Button>
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
                                      onClick={() => revoke.mutate(s.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Revogar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <span className="hidden">{String(!!navigate)}</span>
    </AppShell>
  );
}
