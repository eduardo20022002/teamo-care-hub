import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, UserPlus, Mail, Trash2, Loader2, Copy, CheckCircle2,
  Clock, AlertCircle, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  getMyClinicServer, listClinicMembersServer, createClinicInviteServer,
  listClinicInvitesServer, removeClinicMemberServer,
} from "@/lib/clinic.functions";
import { CLINIC_MEMBER_ROLE_LABELS } from "@/types/clinic";
import type { ClinicMemberRole } from "@/types/clinic";

export const Route = createFileRoute("/_auth/clinica/equipe")({
  head: () => ({
    meta: [{ title: "Equipe — Clínica TEAmo" }],
  }),
  component: ClinicEquipePage,
});

const ROLE_COLORS: Record<ClinicMemberRole, { bg: string; color: string }> = {
  coordinator:  { bg: "#EEF2FF", color: "#4F46E5" },
  receptionist: { bg: "#F0FDF4", color: "#16A34A" },
  therapist:    { bg: "#F5F3FF", color: "#7C3AED" },
};

function MemberAvatar({ name, role }: { name: string; role: ClinicMemberRole }) {
  const initials = name.slice(0, 2).toUpperCase();
  const cfg = ROLE_COLORS[role];
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {initials}
    </div>
  );
}

function InviteModal({
  clinicId,
  onClose,
  onInvited,
}: {
  clinicId: string;
  onClose: () => void;
  onInvited: (token: string) => void;
}) {
  const createInvite = useServerFn(createClinicInviteServer);
  const [email, setEmail]  = useState("");
  const [role, setRole]    = useState<ClinicMemberRole>("therapist");
  const [error, setError]  = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createInvite({ data: { clinicId, email: email.trim(), role } }),
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onInvited(res.token);
    },
    onError: () => setError("Não foi possível criar o convite. Tente novamente."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-5"
        style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Convidar membro</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium text-gray-700">
              E-mail <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="profissional@clinica.com"
                autoFocus
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Papel <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {(["coordinator", "receptionist", "therapist"] as const).map((r) => {
                const selected = role === r;
                const cfg = ROLE_COLORS[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex-1 rounded-lg py-2.5 text-sm font-medium transition-all"
                    style={{
                      border: `1.5px solid ${selected ? cfg.color : "#E5E7EB"}`,
                      background: selected ? cfg.bg : "#FAFAFA",
                      color: selected ? cfg.color : "#6B7280",
                    }}
                  >
                    {CLINIC_MEMBER_ROLE_LABELS[r]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400">
              {role === "coordinator" && "Acesso total — convites, configurações, financeiro."}
              {role === "receptionist" && "Fila de espera, agenda e comunicação com famílias."}
              {role === "therapist" && "Agenda própria, registros de sessão e evolução."}
            </p>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-700"
              style={{ background: "#FEF2F2", border: "0.5px solid #FCA5A5" }}
            >
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg py-2.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" />Criando...</>
              ) : (
                <><UserPlus size={14} />Enviar convite</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteLinkModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/convite-clinica/${token}/aceitar`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-white rounded-2xl p-6 w-full max-w-md flex flex-col gap-5"
        style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} color="#16A34A" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Convite criado!</h3>
            <p className="text-sm text-gray-500">Compartilhe o link abaixo com o profissional.</p>
          </div>
        </div>

        <div
          className="rounded-lg px-3 py-3 text-sm text-gray-600 break-all"
          style={{ background: "#F9FAFB", border: "0.5px solid #E5E7EB" }}
        >
          {inviteUrl}
        </div>

        <p className="text-xs text-gray-400 -mt-2">
          O link expira em 7 dias. O profissional precisará criar ou entrar com uma conta TEAmo.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            {copied ? (
              <><CheckCircle2 size={14} />Copiado!</>
            ) : (
              <><Copy size={14} />Copiar link</>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 rounded-lg py-2.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRemoveModal({
  memberName,
  onConfirm,
  onCancel,
  isPending,
}: {
  memberName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onCancel} />
      <div
        className="relative bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
        style={{ border: "0.5px solid #E5E7EB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <h3 className="text-base font-semibold text-gray-900">Remover membro</h3>
        <p className="text-sm text-gray-600">
          Tem certeza que deseja remover <strong>{memberName}</strong> da clínica?
          O acesso será revogado imediatamente.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}

function ClinicEquipePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const getClinic      = useServerFn(getMyClinicServer);
  const listMembers    = useServerFn(listClinicMembersServer);
  const listInvites    = useServerFn(listClinicInvitesServer);
  const removeMember   = useServerFn(removeClinicMemberServer);

  const [showInviteModal,  setShowInviteModal]  = useState(false);
  const [inviteToken,      setInviteToken]      = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [removingName,     setRemovingName]     = useState<string>("");

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: () => getClinic({}),
    enabled: !!user,
    staleTime: 30_000,
  });

  const clinicId = clinicQuery.data?.clinic?.id ?? "";

  const membersQuery = useQuery({
    queryKey: ["clinicMembers", clinicId],
    queryFn: () => listMembers({ data: { clinicId } }),
    enabled: !!clinicId,
  });

  const invitesQuery = useQuery({
    queryKey: ["clinicInvites", clinicId],
    queryFn: () => listInvites({ data: { clinicId } }),
    enabled: !!clinicId,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      removeMember({ data: { clinicId, memberId } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Membro removido.");
      qc.invalidateQueries({ queryKey: ["clinicMembers"] });
      setRemovingMemberId(null);
    },
    onError: () => {
      toast.error("Não foi possível remover o membro.");
      setRemovingMemberId(null);
    },
  });

  const myRole = clinicQuery.data?.role ?? "therapist";
  const canManage = myRole === "coordinator";

  const members = membersQuery.data ?? [];
  const invites = invitesQuery.data ?? [];

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {members.filter(m => m.joined_at).length} membro{members.filter(m => m.joined_at).length !== 1 ? "s" : ""} ativos
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            <UserPlus size={15} />
            Convidar membro
          </button>
        )}
      </div>

      {/* Active members */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Membros ativos</h2>
        </div>

        {membersQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
          </div>
        ) : members.filter(m => m.joined_at).length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Users size={18} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Nenhum membro ainda.</p>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Convidar o primeiro membro
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.filter(m => m.joined_at).map((member) => {
              const name = member.profile?.full_name ?? member.profile?.email ?? "Usuário";
              const email = member.profile?.email ?? "";
              const isSelf = member.user_id === user?.id;
              const cfg = ROLE_COLORS[member.role];
              return (
                <div key={member.id} className="flex items-center gap-4 px-5 py-4">
                  <MemberAvatar name={name} role={member.role} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {isSelf && (
                        <span className="text-xs text-gray-400">(você)</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{email}</p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {CLINIC_MEMBER_ROLE_LABELS[member.role]}
                  </span>
                  {canManage && !isSelf && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingMemberId(member.id);
                        setRemovingName(name);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label={`Remover ${name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <div
          className="bg-white rounded-xl overflow-hidden"
          style={{ border: "0.5px solid #E5E7EB" }}
        >
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-900">Convites pendentes</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map((invite) => {
              const cfg = ROLE_COLORS[invite.role];
              const daysLeft = Math.ceil(
                (new Date(invite.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );
              return (
                <div key={invite.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Clock size={16} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
                    <p className="text-xs text-gray-500">Expira em {daysLeft} dia{daysLeft !== 1 ? "s" : ""}</p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {CLINIC_MEMBER_ROLE_LABELS[invite.role]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showInviteModal && clinicId && (
        <InviteModal
          clinicId={clinicId}
          onClose={() => setShowInviteModal(false)}
          onInvited={(token) => {
            setShowInviteModal(false);
            setInviteToken(token);
            qc.invalidateQueries({ queryKey: ["clinicInvites"] });
          }}
        />
      )}

      {inviteToken && (
        <InviteLinkModal
          token={inviteToken}
          onClose={() => setInviteToken(null)}
        />
      )}

      {removingMemberId && (
        <ConfirmRemoveModal
          memberName={removingName}
          isPending={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(removingMemberId)}
          onCancel={() => setRemovingMemberId(null)}
        />
      )}
    </div>
  );
}
