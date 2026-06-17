import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Users,
  Loader2,
  Mail,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  Send,
  MessageSquare,
  Eye,
  Flag,
  ChevronRight,
  Trash2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { listChildren } from "@/services/children.service";
import { useAuth } from "@/hooks/useAuth";
import {
  useTherapistInvites,
  useSendTherapistInvite,
  useCancelTherapistInvite,
  useParentCommunications,
  useCreateParentCommunication,
  useDeleteParentCommunication,
  useSharedContent,
} from "@/services/therapist.service";
import { usePlan } from "@/services/subscription.service";
import { PremiumPreview } from "@/components/premium/PremiumPreview";
import { formatAge } from "@/lib/formatters";
import {
  THERAPIST_INVITE_RELATION_LABELS,
  therapistInviteSchema,
  type TherapistInviteInput,
  MILESTONE_AREA_LABELS,
} from "@/lib/validation";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/pais-responsaveis_/$childId")({
  head: () => ({ meta: [{ title: "Pais e Responsáveis — TEAmo" }] }),
  component: PaisResponsaveisDetailPage,
});

const PURPLE       = "#7C3AED";
const PURPLE_SOFT  = "#F5F3FF";
const PURPLE_BORDER = "#DDD6FE";
const TEAL         = "#0D9488";
const TEAL_SOFT    = "#F0FDFA";
const TEAL_BORDER  = "#CCFBF1";

type Tab = "vinculos" | "compartilhado" | "recados";

// ─── InviteRow ────────────────────────────────────────────────────────────────

function InviteRow({
  invite,
  onCancel,
}: {
  invite: { id: string; status: string; invitee_email: string; invitee_alias: string; relation: string; created_at: string };
  onCancel: (id: string) => void;
}) {
  const cfg = {
    pending:  { icon: Clock,        color: "#F59E0B", bg: "#FFFBEB", label: "Aguardando aceite" },
    accepted: { icon: CheckCircle2, color: "#16A34A", bg: "#ECFDF5", label: "Acesso ativo" },
    revoked:  { icon: XCircle,      color: "#9CA3AF", bg: "#F3F4F6", label: "Revogado" },
  } as const;
  const s = cfg[invite.status as keyof typeof cfg] ?? cfg.pending;
  const StatusIcon = s.icon;
  const relation = THERAPIST_INVITE_RELATION_LABELS[invite.relation as keyof typeof THERAPIST_INVITE_RELATION_LABELS] ?? invite.relation;

  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3"
      style={{ borderColor: "#EEF0F4" }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: s.bg }}
      >
        <StatusIcon size={16} color={s.color} strokeWidth={1.8} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#0F172A]">{invite.invitee_alias}</p>
        <p className="text-[12px] text-[#6B7280]">{relation} · {invite.invitee_email}</p>
        <p className="text-[11px] mt-0.5" style={{ color: s.color }}>{s.label}</p>
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

// ─── InviteForm ───────────────────────────────────────────────────────────────

function InviteForm({ childId, onDone }: { childId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [alias, setAlias] = useState("");
  const [relation, setRelation] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sendInvite = useSendTherapistInvite(childId);

  const handleSubmit = async () => {
    const parsed = therapistInviteSchema.safeParse({ childId, inviteeEmail: email, alias, relation });
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
      className="rounded-[16px] border p-4"
      style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
    >
      <p className="text-[13px] font-bold text-[#0F172A] mb-3">Convidar responsável</p>
      <div className="flex flex-col gap-3">
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
          {sendInvite.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <><Mail size={14} strokeWidth={2} /> Enviar convite</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Aba Vínculos ─────────────────────────────────────────────────────────────

function TabVinculos({ childId }: { childId: string }) {
  const [showForm, setShowForm] = useState(false);
  const { data: invitesData, isLoading } = useTherapistInvites(childId);
  const cancelInvite = useCancelTherapistInvite(childId);

  const allInvites = invitesData?.invites ?? [];

  const handleCancel = async (inviteId: string) => {
    try {
      await cancelInvite.mutateAsync(inviteId);
      toast.success("Convite cancelado.");
    } catch {
      toast.error("Não foi possível cancelar o convite.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Nota informativa */}
      <div
        className="rounded-[12px] border px-3 py-2.5 flex items-start gap-2 text-[12px] text-[#6B7280] leading-relaxed"
        style={{ borderColor: PURPLE_BORDER, background: PURPLE_SOFT }}
      >
        <AlertCircle size={14} strokeWidth={1.8} color={PURPLE} className="flex-shrink-0 mt-0.5" />
        <span>
          Ao aceitar, o responsável verá apenas o que você marcar como compartilhado nos marcos e registros.
          Se já tiver conta no TEAmo, o convite aparecerá diretamente no app dele.
        </span>
      </div>

      {/* Botão + formulário */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 h-11 w-full rounded-[14px] border-2 border-dashed text-[14px] font-semibold transition-colors hover:bg-[#F5F3FF]"
          style={{ borderColor: PURPLE_BORDER, color: PURPLE }}
        >
          <Mail size={16} strokeWidth={2} />
          Convidar responsável
        </button>
      )}
      {showForm && <InviteForm childId={childId} onDone={() => setShowForm(false)} />}

      {/* Lista de convites */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={24} className="animate-spin" color={PURPLE} />
        </div>
      ) : allInvites.length === 0 && !showForm ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Users size={28} strokeWidth={1.5} color="#D1D5DB" />
          <p className="mt-2 text-[13px] text-[#9CA3AF]">Nenhum convite enviado ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {allInvites.map((inv: any) => (
            <InviteRow key={inv.id} invite={inv} onCancel={(id) => void handleCancel(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba Compartilhado ────────────────────────────────────────────────────────

function TabCompartilhado({ childId }: { childId: string }) {
  const navigate = useNavigate();
  const { data, isLoading } = useSharedContent(childId);

  const milestones   = (data?.milestones ?? []) as any[];
  const records      = (data?.records ?? []) as any[];
  const recentComms  = (data?.recentComms ?? []) as any[];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin" color={PURPLE} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Marcos */}
      <div>
        <p className="text-[13px] font-bold text-[#374151] mb-2 flex items-center gap-1.5">
          <Flag size={13} strokeWidth={2} color={PURPLE} />
          Marcos de desenvolvimento
        </p>
        {milestones.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF]">Nenhum marco criado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {milestones.map((m: any) => {
              const areaLabel = (MILESTONE_AREA_LABELS as Record<string, string>)[m.area] ?? m.area;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-[12px] border bg-white px-3 py-2.5"
                  style={{ borderColor: "#EEF0F4" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate">{m.title}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{areaLabel}</p>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      background: m.is_shared_with_parents ? "#ECFDF5" : "#F3F4F6",
                      color:      m.is_shared_with_parents ? "#16A34A" : "#9CA3AF",
                    }}
                  >
                    {m.is_shared_with_parents ? "Visível" : "Oculto"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() =>
            navigate({ to: "/paciente/$childId/marcos" as any, params: { childId } as any })
          }
          className="mt-2 text-[12px] font-semibold flex items-center gap-1"
          style={{ color: PURPLE }}
        >
          Gerenciar marcos <ChevronRight size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Registros publicados */}
      <div>
        <p className="text-[13px] font-bold text-[#374151] mb-2 flex items-center gap-1.5">
          <BookOpen size={13} strokeWidth={2} color={PURPLE} />
          Registros de sessão publicados
        </p>
        {records.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF]">Nenhum registro publicado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {records.map((r: any) => {
              const ev = r.agenda_events;
              const date = ev?.start_at
                ? new Date(ev.start_at).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—";
              return (
                <div
                  key={r.event_id}
                  className="rounded-[12px] border bg-white px-3 py-2.5"
                  style={{ borderColor: "#EEF0F4" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="flex-1 text-[13px] font-semibold text-[#0F172A] truncate">
                      {ev?.title || "Sessão"}
                    </p>
                    <span className="text-[11px] text-[#9CA3AF]">{date}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.family_instruction && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "#FEF3C7", color: "#92400E" }}
                      >
                        Instrução à família
                      </span>
                    )}
                    {ev?.plan_visible_to_parents && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "#EEF1FF", color: "#4F46E5" }}
                      >
                        Plano visível
                      </span>
                    )}
                    {!r.is_private && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1"
                        style={{ background: "#ECFDF5", color: "#16A34A" }}
                      >
                        <Eye size={9} strokeWidth={2} />
                        Visível
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recados recentes */}
      <div>
        <p className="text-[13px] font-bold text-[#374151] mb-2 flex items-center gap-1.5">
          <MessageSquare size={13} strokeWidth={2} color={PURPLE} />
          Recados enviados
        </p>
        {recentComms.length === 0 ? (
          <p className="text-[12px] text-[#9CA3AF]">Nenhum recado enviado ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentComms.map((c: any) => (
              <div
                key={c.id}
                className="rounded-[12px] border bg-white px-3 py-2.5"
                style={{ borderColor: "#EEF0F4" }}
              >
                <p className="text-[12px] text-[#374151] leading-relaxed line-clamp-2">{c.content}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  {new Date(c.created_at).toLocaleDateString("pt-BR", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Aba Recados ──────────────────────────────────────────────────────────────

function TabRecados({ childId }: { childId: string }) {
  const [draft, setDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { data, isLoading } = useParentCommunications(childId);
  const createComm = useCreateParentCommunication(childId);
  const deleteComm = useDeleteParentCommunication(childId);

  const comms = (data?.communications ?? []) as Array<{ id: string; content: string; created_at: string }>;

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    try {
      await createComm.mutateAsync(trimmed);
      setDraft("");
      toast.success("Recado enviado!");
    } catch {
      toast.error("Não foi possível enviar o recado.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComm.mutateAsync(id);
      setConfirmDelete(null);
      toast.success("Recado excluído.");
    } catch {
      toast.error("Não foi possível excluir o recado.");
    }
  };

  const remaining = 3000 - draft.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Nota */}
      <div
        className="rounded-[12px] border px-3 py-2.5 flex items-start gap-2 text-[12px] text-[#6B7280] leading-relaxed"
        style={{ borderColor: PURPLE_BORDER, background: PURPLE_SOFT }}
      >
        <MessageSquare size={14} strokeWidth={1.8} color={PURPLE} className="flex-shrink-0 mt-0.5" />
        <span>
          Os responsáveis com vínculo ativo verão os recados automaticamente no portal deles.
          Use para enviar orientações, atualizações ou qualquer informação relevante.
        </span>
      </div>

      {/* Área de texto */}
      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 3000))}
          placeholder="Escreva um recado para os responsáveis…"
          rows={4}
          className="w-full rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-[14px] text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2"
          style={{ focusRingColor: PURPLE } as any}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px]" style={{ color: remaining < 200 ? "#DC2626" : "#9CA3AF" }}>
            {remaining} caracteres restantes
          </span>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!draft.trim() || createComm.isPending}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-bold text-white disabled:opacity-50 transition-opacity"
            style={{ background: PURPLE }}
          >
            {createComm.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <><Send size={13} strokeWidth={2} /> Enviar</>
            )}
          </button>
        </div>
      </div>

      {/* Lista de recados */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin" color={PURPLE} />
        </div>
      ) : comms.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <MessageSquare size={28} strokeWidth={1.5} color="#D1D5DB" />
          <p className="mt-2 text-[13px] text-[#9CA3AF]">Nenhum recado enviado ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {comms.map((c) => (
            <div
              key={c.id}
              className="rounded-[14px] border bg-white px-4 py-3"
              style={{ borderColor: "#EEF0F4" }}
            >
              {confirmDelete === c.id ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] font-semibold text-[#0F172A]">Excluir este recado?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 h-8 rounded-lg text-[12px] font-semibold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      disabled={deleteComm.isPending}
                      className="flex-1 h-8 rounded-lg text-[12px] font-bold text-white bg-red-600 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-[#374151] leading-relaxed whitespace-pre-line">{c.content}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-[#9CA3AF]">
                      {new Date(c.created_at).toLocaleDateString("pt-BR", {
                        day: "numeric", month: "long", year: "numeric",
                      })}{" "}
                      {new Date(c.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(c.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[#FEF2F2]"
                      title="Excluir recado"
                    >
                      <Trash2 size={13} color="#DC2626" strokeWidth={2} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function PaisResponsaveisDetailPage() {
  const { childId } = (Route as any).useParams() as { childId: string };
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("vinculos");

  const { data: allChildren } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const patient = ((allChildren as Child[] | undefined) ?? []).find((c) => c.id === childId) ?? null;

  // O módulo "Pais e Responsáveis" inteiro é Premium (premium-terapeuta.md §2).
  const { isPremium, isLoading: planLoading } = usePlan();
  if (!planLoading && !isPremium) {
    return (
      <AppShell onBack={() => navigate({ to: "/pais-responsaveis" as any })}>
        <PremiumPreview
          feature="invites"
          subtitle={`Conecte ${patient?.name ?? "a família"} ao cuidado: convide responsáveis, envie recados e compartilhe a evolução. Disponível no Premium.`}
        />
      </AppShell>
    );
  }

  const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "vinculos",      label: "Vínculos",    icon: Users },
    { id: "compartilhado", label: "Compartilhado", icon: Eye },
    { id: "recados",       label: "Recados",     icon: MessageSquare },
  ];

  return (
    <AppShell
      onBack={() => navigate({ to: "/pais-responsaveis" as any })}
    >
      <div className="mx-auto max-w-[520px] px-4 py-6">
        {/* Header com nome da criança */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-5 flex items-center gap-3"
          style={{ borderColor: PURPLE_BORDER, background: PURPLE_SOFT }}
        >
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold"
            style={{ background: "#EDE9FE", color: PURPLE }}
          >
            {patient?.name.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold text-[#0F172A] leading-tight">
              {patient?.name ?? "Paciente"}
            </h1>
            {patient?.birth_date && (
              <p className="text-[12px] text-[#6B7280] mt-0.5">{formatAge(patient.birth_date)}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex rounded-[12px] p-1 mb-6 gap-1"
          style={{ background: "#F1F5F9" }}
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-[9px] text-[12.5px] font-semibold transition-all"
              style={
                activeTab === id
                  ? { background: "#fff", color: PURPLE, boxShadow: "0 1px 3px rgba(124,58,237,0.15)" }
                  : { color: "#6B7280" }
              }
            >
              <Icon size={13} strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        {activeTab === "vinculos"      && <TabVinculos childId={childId} />}
        {activeTab === "compartilhado" && <TabCompartilhado childId={childId} />}
        {activeTab === "recados"       && <TabRecados childId={childId} />}
      </div>
    </AppShell>
  );
}
