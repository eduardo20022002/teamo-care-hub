import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ClipboardList,
  Users,
  Info,
  Plus,
  Loader2,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { listAttendanceRecords } from "@/services/attendance.service";
import {
  useTherapistInvites,
  useSendTherapistInvite,
  useCancelTherapistInvite,
} from "@/services/therapist.service";
import { formatAge, formatBirthDate } from "@/lib/formatters";
import {
  THERAPIST_INVITE_RELATION_LABELS,
  therapistInviteSchema,
  type TherapistInviteInput,
} from "@/lib/validation";
import type { AttendanceRecordWithRelations } from "@/services/attendance.service";
import type { Child } from "@/types/database";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/paciente/$childId")({
  head: () => ({
    meta: [{ title: "Paciente — TEAmo" }],
  }),
  component: PatientDetailPage,
});

type Tab = "overview" | "records" | "parents";

// ─── Componente: linha de registro ───────────────────────────────────────────

function RecordRow({ record }: { record: AttendanceRecordWithRelations }) {
  return (
    <div
      className="rounded-[14px] border bg-white px-4 py-3.5"
      style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[13px] font-bold text-[#0F172A]">{record.category}</span>
        <span className="text-[11px] text-[#9CA3AF] flex-shrink-0">{record.record_date}</span>
      </div>
      <p className="text-[13px] text-[#374151] leading-relaxed line-clamp-3">{record.content}</p>
      {record.professional_name && (
        <p className="mt-1.5 text-[11px] text-[#9CA3AF]">por {record.professional_name}</p>
      )}
    </div>
  );
}

// ─── Componente: linha de convite/acesso ──────────────────────────────────────

function InviteRow({
  invite,
  onCancel,
}: {
  invite: { id: string; status: string; invitee_email: string; invitee_alias: string; relation: string };
  onCancel: (id: string) => void;
}) {
  const statusConfig = {
    pending:  { icon: Clock,         color: "#F59E0B", bg: "#FFFBEB", label: "Aguardando aceite" },
    accepted: { icon: CheckCircle2,  color: "#16A34A", bg: "#ECFDF5", label: "Acesso ativo" },
    revoked:  { icon: XCircle,       color: "#9CA3AF", bg: "#F3F4F6", label: "Revogado" },
  } as const;
  const cfg = statusConfig[invite.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const StatusIcon = cfg.icon;
  const relation = THERAPIST_INVITE_RELATION_LABELS[invite.relation as keyof typeof THERAPIST_INVITE_RELATION_LABELS] ?? invite.relation;

  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3"
      style={{ borderColor: "#EEF0F4" }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: cfg.bg }}
      >
        <StatusIcon size={16} color={cfg.color} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#0F172A]">{invite.invitee_alias}</p>
        <p className="text-[12px] text-[#6B7280]">{relation} · {invite.invitee_email}</p>
        <p className="text-[11px] mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
      </div>
      {invite.status === "pending" && (
        <button
          type="button"
          onClick={() => onCancel(invite.id)}
          className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#FEF2F2]"
          title="Cancelar convite"
        >
          <X size={15} color="#DC2626" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ─── Formulário de convite inline ─────────────────────────────────────────────

function InviteForm({ childId, onDone }: { childId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [relation, setRelation] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sendInvite = useSendTherapistInvite(childId);

  const handleSubmit = async () => {
    const parsed = therapistInviteSchema.safeParse({
      childId, inviteeEmail: email, alias, relation,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await sendInvite.mutateAsync(parsed.data as TherapistInviteInput);
      toast.success("Convite enviado por e-mail!");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar convite.");
    }
  };

  const RELATIONS = Object.entries(THERAPIST_INVITE_RELATION_LABELS) as [string, string][];

  return (
    <div
      className="rounded-[16px] border p-4 mt-4"
      style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
    >
      <p className="text-[13px] font-bold text-[#0F172A] mb-3">Convidar responsável</p>

      <div className="flex flex-col gap-3">
        {/* Nome / apelido */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">Nome ou apelido</label>
          <input
            type="text"
            placeholder="Ex: Joana (mãe)"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
          {errors.alias && <p className="text-xs text-red-500">{errors.alias}</p>}
        </div>

        {/* E-mail */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">E-mail</label>
          <input
            type="email"
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
          {errors.inviteeEmail && <p className="text-xs text-red-500">{errors.inviteeEmail}</p>}
        </div>

        {/* Relação */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151]">Relação</label>
          <div className="flex flex-wrap gap-2">
            {RELATIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRelation(value)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
                style={{
                  borderColor: relation === value ? TEAL : "#E5E7EB",
                  background:  relation === value ? TEAL_SOFT : "#FAFAFA",
                  color:       relation === value ? TEAL : "#374151",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {errors.relation && <p className="text-xs text-red-500">{errors.relation}</p>}
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onDone}
          className="h-10 flex-1 rounded-xl border border-[#E5E7EB] text-[13px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={sendInvite.isPending}
          className="h-10 flex-1 rounded-xl text-white text-[13px] font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
          style={{ background: TEAL }}
        >
          {sendInvite.isPending ? <Loader2 size={14} className="animate-spin" /> : (
            <><Mail size={14} strokeWidth={2} /> Enviar convite</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function PatientDetailPage() {
  const { childId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Busca dados da criança (via RLS — terapeuta é owner)
  const { data: allChildren, isLoading: childrenLoading } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const patient = (allChildren ?? []).find((c: Child) => c.id === childId) ?? null;

  // Registros de acompanhamento
  const { data: allRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["attendance"],
    queryFn: listAttendanceRecords,
    enabled: !!user && activeTab === "records",
  });
  const records = (allRecords ?? []).filter(
    (r: AttendanceRecordWithRelations) => r.child_id === childId,
  );

  // Convites / acessos de responsáveis
  const { data: invitesData, isLoading: invitesLoading } = useTherapistInvites(childId);
  const invites = invitesData?.invites ?? [];

  const cancelInvite = useCancelTherapistInvite(childId);

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite.mutateAsync(inviteId);
      toast.success("Convite cancelado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar.");
    }
  };

  if (childrenLoading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" color={TEAL} />
        </div>
      </AppShell>
    );
  }

  if (!patient) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <p className="text-[#6B7280] text-sm">Paciente não encontrado.</p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/dashboard" })}
            className="mt-4 text-sm font-semibold"
            style={{ color: TEAL }}
          >
            Voltar ao painel
          </button>
        </div>
      </AppShell>
    );
  }

  const TABS: { id: Tab; icon: typeof Info; label: string }[] = [
    { id: "overview", icon: Info,          label: "Visão geral" },
    { id: "records",  icon: ClipboardList, label: "Registros" },
    { id: "parents",  icon: Users,         label: "Responsáveis" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            type="button"
            onClick={() => void navigate({ to: "/dashboard" })}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[20px] font-extrabold text-[#0F172A] leading-tight truncate">
              {patient.name}
            </h1>
            <p className="text-xs text-[#6B7280]">
              {formatAge(patient.birth_date)} · {formatBirthDate(patient.birth_date)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1 mb-5" style={{ background: "#F3F4F6" }}>
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-all"
              style={{
                background: activeTab === id ? "#fff" : "transparent",
                color:      activeTab === id ? "#0F172A" : "#6B7280",
                boxShadow:  activeTab === id ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
              }}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ─── TAB: Visão geral ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            <div
              className="rounded-[18px] border p-5"
              style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full text-[24px] font-extrabold"
                  style={{ background: TEAL_BORDER, color: TEAL }}
                >
                  {patient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[18px] font-extrabold text-[#0F172A]">{patient.name}</p>
                  <p className="text-[13px] text-[#6B7280] mt-0.5">
                    {formatAge(patient.birth_date)} · Nascido(a) em {formatBirthDate(patient.birth_date)}
                  </p>
                </div>
              </div>

              {(patient as any).diagnosis && (
                <div
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: "rgba(13,148,136,0.08)", color: "#0F766E" }}
                >
                  <span className="font-semibold">Diagnóstico: </span>
                  {(patient as any).diagnosis}
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("records")}
                className="flex-1 h-11 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
                style={{ background: TEAL }}
              >
                <ClipboardList size={16} strokeWidth={2} />
                Ver registros
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("parents")}
                className="flex-1 h-11 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2"
                style={{ borderColor: TEAL, color: TEAL }}
              >
                <Users size={16} strokeWidth={2} />
                Responsáveis
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB: Registros ────────────────────────────────────────────── */}
        {activeTab === "records" && (
          <div>
            {recordsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin" color={TEAL} />
              </div>
            ) : records.length === 0 ? (
              <div
                className="rounded-[18px] border p-6 text-center"
                style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
              >
                <ClipboardList size={28} strokeWidth={1.5} color={TEAL} className="mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#0F172A]">Nenhum registro ainda</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Os registros de sessão aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {records.map((r) => (
                  <RecordRow key={r.id} record={r} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: Responsáveis ─────────────────────────────────────────── */}
        {activeTab === "parents" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#6B7280]">
                Responsáveis com acesso a {patient.name}
              </p>
              {!showInviteForm && (
                <button
                  type="button"
                  onClick={() => setShowInviteForm(true)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors"
                  style={{ background: TEAL_SOFT, color: TEAL, border: `1px solid ${TEAL_BORDER}` }}
                >
                  <UserPlus size={13} strokeWidth={2.5} />
                  Convidar
                </button>
              )}
            </div>

            {showInviteForm && (
              <InviteForm childId={childId} onDone={() => setShowInviteForm(false)} />
            )}

            {invitesLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={22} className="animate-spin" color={TEAL} />
              </div>
            ) : invites.length === 0 && !showInviteForm ? (
              <div
                className="rounded-[18px] border p-6 text-center"
                style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
              >
                <Users size={28} strokeWidth={1.5} color={TEAL} className="mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#0F172A]">Nenhum responsável vinculado</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Convide pais ou responsáveis para acompanhar a evolução.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-4">
                {(invites as any[]).map((inv) => (
                  <InviteRow
                    key={inv.id}
                    invite={inv}
                    onCancel={(id) => void handleCancelInvite(id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="h-8" />
      </div>
    </AppShell>
  );
}
