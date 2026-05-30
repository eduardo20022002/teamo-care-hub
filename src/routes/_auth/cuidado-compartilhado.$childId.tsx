import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Mail,
  ArrowLeft,
  XCircle,
  Users,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import {
  useCareInvites,
  useSendCareInvite,
  useCancelCareInvite,
  useResendCareInvite,
  useRevokeAccess,
} from "@/services/care-sharing.service";
import {
  CARE_RELATION_LABELS,
  CARE_RELATIONS,
  CARE_ROLES,
  CARE_ROLE_LABELS,
  careInviteSchema,
  type CareRelation,
  type CareRole,
} from "@/lib/validation";
import type { CareInviteInput } from "@/lib/validation";

// Tipos locais para evitar importação de arquivos .server em rotas cliente
interface CareInviteRow {
  id: string;
  child_id: string;
  owner_id: string;
  invitee_email: string;
  invitee_alias: string;
  relation: string;
  role: "admin" | "viewer";
  token: string;
  status: "pending" | "accepted" | "approved" | "denied" | "revoked";
  accepted_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface CareAccessRow {
  id: string;
  owner_id: string;
  caregiver_id: string;
  child_id: string;
  invite_id: string;
  role: "admin" | "viewer";
  relation: string;
  alias: string;
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
}

const TEAL = "#0D9488";

export const Route = createFileRoute("/_auth/cuidado-compartilhado/$childId")({
  head: () => ({
    meta: [{ title: "Cuidado compartilhado — TEAmo" }],
  }),
  component: ManageCarePage,
});

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    approved: { bg: "#ECFDF5", text: "#059669", label: "Ativo" },
    pending: { bg: "#FFFBEB", text: "#D97706", label: "Aguardando aceite" },
    accepted: { bg: "#EFF6FF", text: "#2563EB", label: "Aguardando aprovação" },
  };
  const s = styles[status] ?? { bg: "#F3F4F6", text: "#6B7280", label: status };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

// ─── InviteSheet (Tela 3) ─────────────────────────────────────────────────────

function InviteSheet({
  childId,
  onClose,
}: {
  childId: string;
  onClose: () => void;
}) {
  const sendInvite = useSendCareInvite(childId);
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [relation, setRelation] = useState<CareRelation>("cuidador");
  const [role, setRole] = useState<CareRole>("viewer");
  const [errors, setErrors] = useState<Partial<Record<keyof CareInviteInput, string>>>({});

  const onSubmit = async () => {
    const parsed = careInviteSchema.safeParse({ childId, inviteeEmail: email, alias, relation, role });
    if (!parsed.success) {
      const f: typeof errors = {};
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof typeof f;
        if (k && !f[k]) f[k] = i.message;
      }
      setErrors(f);
      return;
    }
    setErrors({});
    try {
      const res = (await sendInvite.mutateAsync(parsed.data)) as { emailSent?: boolean };
      if (res?.emailSent === false) {
        toast.warning(
          "Convite criado, mas o e-mail não pôde ser enviado agora. Use \"Reenviar\" na lista.",
        );
      } else {
        toast.success("Convite enviado!");
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar convite.";
      toast.error(msg.includes("409") ? "Já existe um convite ativo para este e-mail." : msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[90vh] overflow-y-auto">
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#E5E7EB]" />

        <h2 className="text-[18px] font-bold text-[#0F172A] mb-1">Convidar co-cuidador</h2>
        <p className="text-sm text-[#6B7280] mb-5">O convite é válido por 48 horas.</p>

        {/* E-mail */}
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-[#374151]">E-mail do co-cuidador</label>
          <input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl border border-[#E2E8F0] px-4 text-sm outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] transition-all"
          />
          {errors.inviteeEmail && <p className="text-xs text-red-500">{errors.inviteeEmail}</p>}
        </div>

        {/* Alias */}
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-[#374151]">Como chamar essa pessoa?</label>
          <input
            type="text"
            placeholder="Ex.: Joana, Vovó"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="h-11 rounded-xl border border-[#E2E8F0] px-4 text-sm outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#CCFBF1] transition-all"
          />
          {errors.alias && <p className="text-xs text-red-500">{errors.alias}</p>}
        </div>

        {/* Relação */}
        <div className="flex flex-col gap-2 mb-4">
          <label className="text-sm font-medium text-[#374151]">Relação com a criança</label>
          <div className="flex flex-wrap gap-2">
            {CARE_RELATIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRelation(r)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold border transition-all"
                style={
                  relation === r
                    ? { background: TEAL, color: "#fff", borderColor: TEAL }
                    : { background: "#F9FAFB", color: "#374151", borderColor: "#E2E8F0" }
                }
              >
                {CARE_RELATION_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Nível de acesso */}
        <div className="flex flex-col gap-2 mb-5">
          <label className="text-sm font-medium text-[#374151]">Nível de acesso</label>
          <div className="flex gap-3">
            {CARE_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className="flex-1 rounded-xl border p-3 text-left transition-all"
                style={
                  role === r
                    ? { borderColor: TEAL, background: "#F0FDFA" }
                    : { borderColor: "#E2E8F0", background: "#F9FAFB" }
                }
              >
                <p className="text-sm font-bold text-[#0F172A]">{CARE_ROLE_LABELS[r]}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {r === "admin"
                    ? "Edita agenda, acessa documentos"
                    : "Visualiza tudo, cria registros"}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={sendInvite.isPending}
            className="flex items-center justify-center h-12 rounded-xl text-white text-[15px] font-bold disabled:opacity-60"
            style={{ background: TEAL }}
          >
            {sendInvite.isPending ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Enviando…</>
            ) : (
              <><Mail size={16} className="mr-2" /> Enviar convite</>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl text-[15px] font-semibold border border-[#E2E8F0] text-[#6B7280]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RevokeConfirm (Tela 4) ───────────────────────────────────────────────────

function RevokeConfirm({
  accessId,
  name,
  childId,
  onCancel,
  onDone,
}: {
  accessId: string;
  name: string;
  childId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const revoke = useRevokeAccess(childId);

  const onConfirm = async () => {
    try {
      await revoke.mutateAsync(accessId);
      toast.success(`Acesso de ${name} revogado.`);
      onDone();
    } catch {
      toast.error("Erro ao revogar acesso.");
    }
  };

  return (
    <div
      className="mt-3 rounded-xl px-4 py-4"
      style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
    >
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle size={18} color="#DC2626" className="flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#DC2626] leading-snug">
          <strong>{name}</strong> perderá o acesso imediatamente e não poderá mais ver os dados.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 rounded-lg border border-[#E2E8F0] text-sm font-semibold text-[#374151]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={revoke.isPending}
          className="flex-1 h-9 rounded-lg text-sm font-bold text-white disabled:opacity-60"
          style={{ background: "#DC2626" }}
        >
          {revoke.isPending ? <Loader2 size={14} className="inline animate-spin" /> : "Sim, revogar"}
        </button>
      </div>
    </div>
  );
}

// ─── CaregiverRow ─────────────────────────────────────────────────────────────

function ActiveRow({
  access,
  childId,
}: {
  access: CareAccessRow & { caregiver: any };
  childId: string;
}) {
  const [revokeOpen, setRevokeOpen] = useState(false);
  const name = access.alias;
  const email = access.caregiver?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className="rounded-xl border border-[#EEF0F4] p-4 bg-white"
      style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full font-bold flex-shrink-0"
          style={{ background: "#F0FDFA", color: TEAL }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#0F172A] text-[14px]">{name}</p>
          <p className="text-xs text-[#6B7280] truncate">{email}</p>
          <p className="text-xs text-[#6B7280]">{CARE_RELATION_LABELS[access.relation as CareRelation] ?? access.relation} · {CARE_ROLE_LABELS[access.role]}</p>
        </div>
        <StatusPill status="approved" />
      </div>
      {!revokeOpen ? (
        <button
          type="button"
          onClick={() => setRevokeOpen(true)}
          className="mt-3 text-xs font-semibold text-red-500 hover:text-red-600"
        >
          Revogar acesso
        </button>
      ) : (
        <RevokeConfirm
          accessId={access.id}
          name={name}
          childId={childId}
          onCancel={() => setRevokeOpen(false)}
          onDone={() => setRevokeOpen(false)}
        />
      )}
    </div>
  );
}

function PendingRow({
  invite,
  childId,
}: {
  invite: CareInviteRow;
  childId: string;
}) {
  const cancel = useCancelCareInvite(childId);
  const resend = useResendCareInvite(childId);
  const navigate = useNavigate();

  if (invite.status === "accepted") {
    return (
      <div
        className="rounded-xl border border-[#BFDBFE] p-4 bg-[#EFF6FF]"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full font-bold flex-shrink-0"
            style={{ background: "#DBEAFE", color: "#2563EB" }}
          >
            {invite.invitee_alias.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#0F172A] text-[14px]">{invite.invitee_alias}</p>
            <p className="text-xs text-[#6B7280] truncate">{invite.invitee_email}</p>
            <StatusPill status="accepted" />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/cuidado-compartilhado/$childId/aprovar/$inviteId", params: { childId, inviteId: invite.id } })}
            className="flex-1 h-9 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1"
            style={{ background: TEAL }}
          >
            <CheckCircle2 size={13} /> Revisar e aprovar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-[#EEF0F4] p-4 bg-white"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full font-bold flex-shrink-0"
          style={{ background: "#FFFBEB", color: "#D97706" }}
        >
          {invite.invitee_alias.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#0F172A] text-[14px]">{invite.invitee_alias}</p>
          <p className="text-xs text-[#6B7280] truncate">{invite.invitee_email}</p>
          <StatusPill status="pending" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => resend.mutate(invite.id, {
            onSuccess: () => toast.success("Convite reenviado!"),
            onError: () => toast.error("Erro ao reenviar convite."),
          })}
          className="flex-1 h-9 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#374151] flex items-center justify-center gap-1"
        >
          {resend.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Reenviar
        </button>
        <button
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate(invite.id, {
            onSuccess: () => toast.success("Convite cancelado."),
            onError: () => toast.error("Erro ao cancelar convite."),
          })}
          className="flex-1 h-9 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-red-500 flex items-center justify-center gap-1"
        >
          {cancel.isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function ManageCarePage() {
  const { childId } = Route.useParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useCareInvites(childId);

  const totalPending =
    (data?.aguardandoAprovacao?.length ?? 0) + (data?.aguardandoAceite?.length ?? 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Voltar — padrão consistente com os demais módulos */}
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
        <div className="flex items-center justify-between mb-6">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold text-[#0F172A] leading-tight">Cuidado compartilhado</h1>
            {data?.childName && (
              <p className="text-sm text-[#6B7280] truncate">{data.childName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: TEAL }}
          >
            <Plus size={20} strokeWidth={2.2} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} color={TEAL} className="animate-spin" />
          </div>
        ) : isError ? (
          <div className="text-center py-12">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "#FEF2F2" }}
            >
              <AlertTriangle size={26} color="#DC2626" strokeWidth={1.7} />
            </div>
            <h3 className="text-[16px] font-bold text-[#0F172A] mb-1">Não foi possível carregar</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Houve um erro ao buscar os co-cuidadores. Tente novamente.
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="inline-flex items-center gap-2 h-11 rounded-xl px-5 text-white text-[14px] font-bold"
              style={{ background: TEAL }}
            >
              <RefreshCw size={16} /> Tentar novamente
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Ativos */}
            {(data?.ativos?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-[#9CA3AF] mb-3">
                  Ativos
                </p>
                <div className="flex flex-col gap-3">
                  {data!.ativos.map((a) => (
                    <ActiveRow key={a.id} access={a as any} childId={childId} />
                  ))}
                </div>
              </div>
            )}

            {/* Aguardando aprovação */}
            {(data?.aguardandoAprovacao?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-[#9CA3AF] mb-3">
                  Aguardando sua aprovação
                </p>
                <div className="flex flex-col gap-3">
                  {data!.aguardandoAprovacao.map((i) => (
                    <PendingRow key={i.id} invite={i} childId={childId} />
                  ))}
                </div>
              </div>
            )}

            {/* Aguardando aceite */}
            {(data?.aguardandoAceite?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-[#9CA3AF] mb-3">
                  Aguardando aceite
                </p>
                <div className="flex flex-col gap-3">
                  {data!.aguardandoAceite.map((i) => (
                    <PendingRow key={i.id} invite={i} childId={childId} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {(data?.ativos?.length ?? 0) === 0 && totalPending === 0 && (
              <div className="text-center py-12">
                <div
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "#F0FDFA" }}
                >
                  <Users size={26} color={TEAL} strokeWidth={1.7} />
                </div>
                <h3 className="text-[16px] font-bold text-[#0F172A] mb-1">Nenhum co-cuidador ainda</h3>
                <p className="text-sm text-[#6B7280] mb-4">
                  Convide avós, tios ou cuidadores para acompanhar o cuidado.
                </p>
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="inline-flex items-center gap-2 h-11 rounded-xl px-5 text-white text-[14px] font-bold"
                  style={{ background: TEAL }}
                >
                  <Plus size={16} /> Convidar alguém
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {sheetOpen && (
        <InviteSheet childId={childId} onClose={() => setSheetOpen(false)} />
      )}
    </AppShell>
  );
}
