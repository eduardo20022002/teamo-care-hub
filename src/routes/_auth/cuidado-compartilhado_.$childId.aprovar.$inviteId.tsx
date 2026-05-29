import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, User, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useCareInviteForApproval, useApproveAccess, useDenyAccess } from "@/services/care-sharing.service";
import { CARE_RELATION_LABELS, type CareRelation } from "@/lib/validation";

const TEAL = "#0D9488";

export const Route = createFileRoute("/_auth/cuidado-compartilhado_/$childId/aprovar/$inviteId")({
  head: () => ({
    meta: [{ title: "Revisar aprovação — TEAmo" }],
  }),
  component: ApprovalReviewPage,
});

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 mt-0.5"
        style={{ background: "#F0FDFA" }}
      >
        <Icon size={15} color={TEAL} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#9CA3AF]">{label}</p>
        <p className="text-sm font-medium text-[#0F172A] break-all">{value}</p>
      </div>
    </div>
  );
}

function ApprovalReviewPage() {
  const { childId, inviteId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useCareInviteForApproval(inviteId);
  const approve = useApproveAccess(childId);
  const deny = useDenyAccess(childId);

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(inviteId);
      toast.success("Acesso aprovado! Co-cuidador pode entrar agora.");
      navigate({ to: "/cuidado-compartilhado/$childId", params: { childId } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao aprovar acesso.";
      toast.error(msg);
    }
  };

  const handleDeny = async () => {
    try {
      await deny.mutateAsync(inviteId);
      toast.success("Acesso negado.");
      navigate({ to: "/cuidado-compartilhado/$childId", params: { childId } });
    } catch {
      toast.error("Erro ao negar acesso.");
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={28} color={TEAL} className="animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!data || !data.invite) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[420px] px-4 py-10 text-center">
          <p className="text-[#6B7280]">Convite não encontrado ou já processado.</p>
        </div>
      </AppShell>
    );
  }

  const { invite, acceptedBy, childName, emailsMatch } = data;

  return (
    <AppShell>
      <div className="mx-auto max-w-[420px] px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "#F0FDFA" }}
          >
            <ShieldCheck size={28} color={TEAL} strokeWidth={1.7} />
          </div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">Revisão de aprovação</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Confirme os dados antes de liberar o acesso a <strong>{childName}</strong>
          </p>
        </div>

        {/* Card: quem aceitou */}
        <div className="bg-white rounded-2xl border border-[#EEF0F4] px-4 py-4 mb-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide font-semibold text-[#9CA3AF] mb-3">
            Quem aceitou
          </p>
          {acceptedBy ? (
            <>
              <InfoRow icon={User} label="Nome na conta" value={acceptedBy.displayName || "(sem nome)"} />
              <InfoRow icon={Mail} label="E-mail da conta" value={acceptedBy.email} />
              {invite.accepted_at && (
                <InfoRow
                  icon={Clock}
                  label="Data do aceite"
                  value={new Date(invite.accepted_at).toLocaleString("pt-BR")}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-[#6B7280]">Dados indisponíveis.</p>
          )}
        </div>

        {/* Card: convite original */}
        <div className="bg-white rounded-2xl border border-[#EEF0F4] px-4 py-4 mb-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide font-semibold text-[#9CA3AF] mb-3">
            Dados do convite original
          </p>
          <InfoRow icon={Mail} label="E-mail destinatário" value={invite.invitee_email} />
          <InfoRow icon={User} label="Como você chamou" value={`${invite.invitee_alias} · ${CARE_RELATION_LABELS[invite.relation as CareRelation] ?? invite.relation}`} />
          <InfoRow icon={Clock} label="Enviado em" value={new Date(invite.created_at).toLocaleString("pt-BR")} />
        </div>

        {/* Banner de consistência de e-mail */}
        <div
          className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
          style={
            emailsMatch
              ? { background: "#ECFDF5", border: "1px solid #A7F3D0" }
              : { background: "#FEF2F2", border: "1px solid #FECACA" }
          }
        >
          {emailsMatch ? (
            <CheckCircle2 size={18} color="#059669" />
          ) : (
            <XCircle size={18} color="#DC2626" />
          )}
          <p
            className="text-sm font-medium"
            style={{ color: emailsMatch ? "#065F46" : "#991B1B" }}
          >
            {emailsMatch
              ? "E-mail confere com o convite original."
              : "⚠️ E-mail diferente do convite! Verifique antes de aprovar."}
          </p>
        </div>

        {/* Aviso LGPD */}
        <div
          className="rounded-xl px-4 py-3 mb-6 text-xs leading-relaxed"
          style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}
        >
          Ao aprovar, esta pessoa terá acesso a <strong>dados sensíveis de saúde</strong> de{" "}
          {childName}. Você pode revogar o acesso a qualquer momento.
        </div>

        {/* Botões */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={approve.isPending || deny.isPending}
            className="flex items-center justify-center h-12 rounded-xl text-white text-[15px] font-bold disabled:opacity-60"
            style={{ background: TEAL }}
          >
            {approve.isPending ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Aprovando…</>
            ) : (
              <><CheckCircle2 size={18} className="mr-2" /> Aprovar acesso</>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDeny()}
            disabled={approve.isPending || deny.isPending}
            className="flex items-center justify-center h-12 rounded-xl text-[15px] font-bold border disabled:opacity-60"
            style={{ borderColor: "#DC2626", color: "#DC2626" }}
          >
            {deny.isPending ? (
              <><Loader2 size={16} className="mr-2 animate-spin" /> Negando…</>
            ) : (
              <><XCircle size={18} className="mr-2" /> Negar acesso</>
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
