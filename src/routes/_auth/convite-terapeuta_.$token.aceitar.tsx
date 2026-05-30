import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Loader2,
  ClipboardList,
  Calendar,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useAcceptTherapistInvite } from "@/services/therapist.service";
import { getTherapistInviteContextServer } from "@/lib/therapist.functions";
import { formatAge } from "@/lib/formatters";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/convite-terapeuta_/$token/aceitar")({
  head: () => ({
    meta: [{ title: "Aceitar acompanhamento — TEAmo" }],
  }),
  component: AcceptTherapistInvitePage,
});

type Phase = "loading" | "confirm" | "accepted" | "error";

interface InviteCtx {
  inviteId: string;
  therapistName: string;
  therapistSpecialty: string;
  childName: string;
  childBirthDate: string;
}

function PermissionItem({ icon: Icon, label }: { icon: typeof ClipboardList; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: TEAL_SOFT }}
      >
        <Icon size={16} color={TEAL} strokeWidth={1.8} />
      </div>
      <span className="text-[14px] text-[#374151] font-medium">{label}</span>
    </div>
  );
}

function AcceptTherapistInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [ctx, setCtx] = useState<InviteCtx | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lgpdChecked, setLgpdChecked] = useState(false);

  const acceptMutation = useAcceptTherapistInvite();

  // Carrega contexto do convite
  useEffect(() => {
    let cancelled = false;
    getTherapistInviteContextServer({ data: { token } })
      .then((res) => {
        if (cancelled) return;
        if (res.state === "valid") {
          setCtx({
            inviteId:           res.inviteId,
            therapistName:      res.therapistName,
            therapistSpecialty: res.therapistSpecialty,
            childName:          res.childName,
            childBirthDate:     res.childBirthDate,
          });
          setPhase("confirm");
        } else if (res.state === "already_used") {
          // Convite já aceito — leva direto para dashboard
          toast.success("Você já aceitou este convite.");
          void navigate({ to: "/dashboard" });
        } else if (res.state === "expired") {
          setErrorMsg("Este convite expirou. Peça ao terapeuta um novo link.");
          setPhase("error");
        } else {
          setErrorMsg("Link inválido ou revogado. Solicite um novo convite ao terapeuta.");
          setPhase("error");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg("Não foi possível carregar o convite. Tente novamente.");
          setPhase("error");
        }
      });

    return () => { cancelled = true; };
  }, [token, navigate]);

  const handleAccept = async () => {
    if (!lgpdChecked) {
      toast.error("Confirme que compreende o compartilhamento de dados para continuar.");
      return;
    }
    try {
      await acceptMutation.mutateAsync(token);
      setPhase("accepted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível aceitar o convite.");
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <AppShell hideMenu>
        <div className="mx-auto max-w-[440px] px-4 py-12 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin" color={TEAL} />
          <p className="text-sm text-[#6B7280]">Carregando convite…</p>
        </div>
      </AppShell>
    );
  }

  // ─── Erro ───────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <AppShell hideMenu>
        <div className="mx-auto max-w-[440px] px-4 py-10">
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: "#FEF2F2" }}
          >
            <AlertCircle size={26} color="#DC2626" strokeWidth={1.7} />
          </div>
          <h1 className="text-[22px] font-extrabold text-center text-[#0F172A] mb-2">
            Convite inválido
          </h1>
          <p className="text-sm text-center text-[#6B7280] mb-8 leading-relaxed">
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/dashboard" })}
            className="h-12 w-full rounded-xl text-white font-bold text-[15px]"
            style={{ background: TEAL }}
          >
            Ir para o painel
          </button>
        </div>
      </AppShell>
    );
  }

  // ─── Aceito com sucesso ─────────────────────────────────────────────────────
  if (phase === "accepted" && ctx) {
    return (
      <AppShell hideMenu>
        <div className="mx-auto max-w-[440px] px-4 py-10 text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "#ECFDF5" }}
          >
            <CheckCircle2 size={34} color="#16A34A" strokeWidth={1.6} />
          </div>
          <h1 className="text-[24px] font-extrabold text-[#0F172A] mb-2 leading-tight">
            Acesso confirmado!
          </h1>
          <p className="text-sm text-[#6B7280] mb-8 leading-relaxed">
            Agora você pode acompanhar o progresso de{" "}
            <strong className="text-[#0F172A]">{ctx.childName}</strong> junto com{" "}
            <strong className="text-[#0F172A]">{ctx.therapistName}</strong>.
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/dashboard" })}
            className="h-12 w-full rounded-xl text-white font-bold text-[15px]"
            style={{ background: TEAL }}
          >
            Ver no painel
          </button>
        </div>
      </AppShell>
    );
  }

  // ─── Confirmação ────────────────────────────────────────────────────────────
  if (!ctx) return null;

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-[440px] px-4 py-6">
        {/* Header — ícone terapeuta */}
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: TEAL_SOFT, border: `1px solid ${TEAL_BORDER}` }}
        >
          <Stethoscope size={26} color={TEAL} strokeWidth={1.7} />
        </div>

        <h1 className="text-[22px] font-extrabold text-center text-[#0F172A] leading-tight mb-1">
          Convite de acompanhamento
        </h1>
        <p className="text-sm text-center text-[#6B7280] mb-6 leading-relaxed">
          <strong className="text-[#0F172A]">{ctx.therapistName}</strong>
          {ctx.therapistSpecialty ? ` (${ctx.therapistSpecialty})` : ""} te convidou
          para acompanhar{" "}
          <strong className="text-[#0F172A]">{ctx.childName}</strong> no TEAmo.
        </p>

        {/* Card do paciente */}
        <div
          className="rounded-[18px] border p-4 mb-5"
          style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full font-bold text-[18px] flex-shrink-0"
              style={{ background: TEAL_BORDER, color: TEAL }}
            >
              {ctx.childName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-[#0F172A] text-[16px]">{ctx.childName}</p>
              {ctx.childBirthDate && (
                <p className="text-xs text-[#6B7280] mt-0.5">{formatAge(ctx.childBirthDate)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Permissões */}
        <div
          className="rounded-[16px] border px-4 py-1 mb-5"
          style={{ borderColor: "#E5E7EB" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#9CA3AF] pt-3 pb-1">
            Você poderá visualizar
          </p>
          <PermissionItem icon={ClipboardList} label="Registros de sessão do terapeuta" />
          <PermissionItem icon={Calendar}      label="Agenda e sessões agendadas" />
          <PermissionItem icon={TrendingUp}    label="Evolução e progressos compartilhados" />
        </div>

        {/* Checkbox LGPD */}
        <label className="flex items-start gap-3 cursor-pointer select-none mb-6">
          <span
            className={`mt-0.5 flex-shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border transition-colors ${
              lgpdChecked ? "border-[#0D9488] bg-[#0D9488]" : "border-[#D1D5DB] bg-white"
            }`}
          >
            {lgpdChecked && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6l3 3 6-6" />
              </svg>
            )}
            <input
              type="checkbox"
              className="sr-only"
              checked={lgpdChecked}
              onChange={(e) => setLgpdChecked(e.target.checked)}
            />
          </span>
          <span className="text-sm leading-snug text-[#6B7280]">
            Compreendo que estou acessando dados de saúde de uma criança e que devo
            tratar essas informações com sigilo, conforme a{" "}
            <span className="font-semibold text-[#374151]">LGPD</span>.
          </span>
        </label>

        {/* Botão aceitar */}
        <button
          type="button"
          onClick={() => void handleAccept()}
          disabled={acceptMutation.isPending || !lgpdChecked}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-white text-[15px] font-bold disabled:opacity-50 transition-all hover:-translate-y-px"
          style={{ background: TEAL }}
        >
          {acceptMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            "Aceitar acompanhamento"
          )}
        </button>

        <button
          type="button"
          onClick={() => void navigate({ to: "/dashboard" })}
          disabled={acceptMutation.isPending}
          className="mt-3 h-11 w-full rounded-xl text-[14px] font-semibold text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
        >
          Recusar e voltar ao painel
        </button>
      </div>
    </AppShell>
  );
}
