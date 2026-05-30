import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Baby,
  FileText,
  Calendar,
  Stethoscope,
  ClipboardList,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useAcceptCareInvite } from "@/services/care-sharing.service";
import { getCareInviteContextServer } from "@/lib/care-sharing.functions";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { formatAge } from "@/lib/formatters";

const TEAL = "#0D9488";
const POLL_INTERVAL_MS = 5_000; // fallback: polling a cada 5s caso Realtime falhe

export const Route = createFileRoute("/_auth/convite_/$token/aceitar")({
  head: () => ({
    meta: [{ title: "Aceitar convite — TEAmo" }],
  }),
  component: AcceptInvitePage,
});

type Phase = "loading" | "confirm" | "awaiting" | "approved" | "error";

interface InviteCtx {
  inviteId: string;
  ownerName: string;
  childName: string;
  childBirthDate: string;
  role: "admin" | "viewer";
  expiresAt: string;
}

function AccessItem({ icon: Icon, label }: { icon: typeof FileText; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: "#F0FDFA" }}
      >
        <Icon size={16} color={TEAL} strokeWidth={1.8} />
      </div>
      <span className="text-[14px] text-[#374151] font-medium">{label}</span>
    </div>
  );
}

function AcceptInvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("loading");
  const [ctx, setCtx] = useState<InviteCtx | null>(null);
  // Mantém o inviteId separado para o Realtime funcionar mesmo quando ctx muda de fase
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>("");
  const [childName, setChildName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");
  const [lgpdChecked, setLgpdChecked] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const acceptMutation = useAcceptCareInvite();

  // Carrega dados do convite
  useEffect(() => {
    let cancelled = false;
    getCareInviteContextServer({ data: { token } })
      .then((res) => {
        if (cancelled) return;

        if (res.state === "valid") {
          setCtx({
            inviteId: res.inviteId,
            ownerName: res.ownerName,
            childName: res.childName,
            childBirthDate: res.childBirthDate,
            role: res.role,
            expiresAt: res.expiresAt,
          });
          setInviteId(res.inviteId);
          setOwnerName(res.ownerName);
          setChildName(res.childName);
          setPhase("confirm");
        } else if (res.state === "already_used") {
          // Co-cuidador voltou à página após ter aceito mas antes da aprovação
          setInviteId(res.inviteId);
          setOwnerName(res.ownerName);
          setChildName(res.childName);
          setPhase("awaiting");
        } else if (res.state === "approved") {
          // Owner já aprovou — mostra aprovação direto
          setInviteId(res.inviteId);
          setOwnerName(res.ownerName);
          setChildName(res.childName);
          setPhase("approved");
        } else {
          setErrorMsg(
            res.state === "expired"
              ? "Este convite expirou. Peça ao responsável um novo convite."
              : "Convite inválido ou cancelado.",
          );
          setPhase("error");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMsg("Erro ao carregar o convite. Tente novamente.");
          setPhase("error");
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  // Realtime: observa status do invite aprovado
  useEffect(() => {
    if (phase !== "awaiting" || !inviteId) return;

    const channel = supabaseClient
      .channel(`invite-${inviteId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "care_invites",
          filter: `id=eq.${inviteId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: string }).status;
          if (newStatus === "approved") {
            setPhase("approved");
          } else if (newStatus === "denied") {
            setErrorMsg("O responsável negou o acesso.");
            setPhase("error");
          }
        },
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [phase, inviteId]);

  // Polling de fallback: caso o Realtime não dispare, consulta o status a cada 5s
  useEffect(() => {
    if (phase !== "awaiting") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await getCareInviteContextServer({ data: { token } });
        if (res.state === "approved") {
          setOwnerName(res.ownerName);
          setChildName(res.childName);
          setPhase("approved");
        } else if (res.state === "invalid") {
          // Convite revogado enquanto aguardava
          setErrorMsg("O acesso foi cancelado.");
          setPhase("error");
        }
      } catch {
        // Silencioso — próximo ciclo tenta novamente
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [phase, token]);

  const handleAccept = async () => {
    if (!lgpdChecked) {
      toast.error("Confirme o consentimento de dados antes de aceitar.");
      return;
    }
    try {
      await acceptMutation.mutateAsync(token);
      setPhase("awaiting");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao aceitar convite.";
      toast.error(msg);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 size={32} color={TEAL} className="animate-spin" />
          <p className="text-sm text-[#6B7280]">Carregando convite…</p>
        </div>
      </AppShell>
    );
  }

  // ─── Erro ─────────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <AppShell>
        <div className="mx-auto max-w-[420px] px-4 py-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4] text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "#FEF2F2" }}
            >
              <Clock size={28} color="#DC2626" strokeWidth={1.8} />
            </div>
            <h2 className="text-[18px] font-bold text-[#0F172A] mb-2">Não foi possível aceitar</h2>
            <p className="text-sm text-[#6B7280] mb-4">{errorMsg}</p>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="h-11 rounded-xl px-6 text-white text-[14px] font-semibold"
              style={{ background: TEAL }}
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Aguardando aprovação (Tela 11) ──────────────────────────────────────────
  if (phase === "awaiting") {
    return (
      <AppShell>
        <div className="mx-auto max-w-[420px] px-4 py-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4] text-center">
            <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full animate-ping opacity-30"
                style={{ background: TEAL }}
              />
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "#F0FDFA" }}
              >
                <Baby size={32} color={TEAL} strokeWidth={1.7} />
              </div>
            </div>
            <h2 className="text-[20px] font-bold text-[#0F172A] mb-2">Quase lá!</h2>
            <p className="text-sm text-[#6B7280] leading-relaxed">
              Aguardando o responsável aprovar seu acesso. Você será notificado(a) por e-mail assim que for aprovado(a).
            </p>
            <p className="mt-3 text-xs text-[#9CA3AF]">
              Esta página atualiza automaticamente.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Aprovado! (Tela 11b) ─────────────────────────────────────────────────────
  if (phase === "approved") {
    const displayOwner = ownerName || ctx?.ownerName || "";
    const displayChild = childName || ctx?.childName || "";
    return (
      <AppShell>
        <div className="mx-auto max-w-[420px] px-4 py-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4] text-center">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "#ECFDF5" }}
            >
              <CheckCircle2 size={36} color="#059669" strokeWidth={1.7} />
            </div>
            <h2 className="text-[22px] font-bold text-[#0F172A] mb-2">Acesso aprovado!</h2>
            <p className="text-sm text-[#6B7280] mb-6 leading-relaxed">
              {displayOwner} aprovou seu acesso. Agora você pode acompanhar o cuidado de{" "}
              <strong>{displayChild}</strong>.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="h-12 w-full rounded-xl text-white text-[15px] font-bold"
              style={{ background: TEAL }}
            >
              Acessar agora
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // ─── Confirmação de aceite (Tela 10) ─────────────────────────────────────────
  if (!ctx) return null;
  const isAdmin = ctx.role === "admin";

  return (
    <AppShell>
      <div className="mx-auto max-w-[420px] px-4 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4]">
          {/* Header */}
          <div className="text-center mb-5">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "#F0FDFA" }}
            >
              <Baby size={28} color={TEAL} strokeWidth={1.7} />
            </div>
            <p className="text-xs uppercase tracking-wider font-semibold text-[#9CA3AF] mb-1">
              Último passo
            </p>
            <h2 className="text-[20px] font-bold text-[#0F172A] leading-tight">
              Confirmar acesso
            </h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              {ctx.ownerName} te convidou para acompanhar o cuidado de{" "}
              <strong>{ctx.childName}</strong>
            </p>
          </div>

          {/* Card da criança */}
          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ background: "#F0FDFA", border: "1px solid #CCFBF1" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-lg flex-shrink-0"
                style={{ background: "#CCFBF1", color: TEAL }}
              >
                {ctx.childName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-[#0F172A] text-[15px]">{ctx.childName}</p>
                {ctx.childBirthDate && (
                  <p className="text-xs text-[#6B7280]">{formatAge(ctx.childBirthDate)}</p>
                )}
              </div>
            </div>
          </div>

          {/* O que você poderá acessar */}
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">
            O que você poderá acessar
          </p>
          <div className="rounded-xl border border-[#EEF0F4] px-3 mb-4">
            <AccessItem icon={ClipboardList} label="Registros diários" />
            {isAdmin && <AccessItem icon={FileText} label="Documentos clínicos" />}
            <AccessItem icon={Calendar} label="Agenda e compromissos" />
            <AccessItem icon={Stethoscope} label="Profissionais de saúde" />
          </div>

          {/* Consentimento LGPD */}
          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <span
                className={`mt-0.5 flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-[5px] border transition-colors ${
                  lgpdChecked
                    ? "border-[#0D9488] bg-[#0D9488]"
                    : "border-[#D1D5DB] bg-white"
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
              <span className="text-xs leading-relaxed text-[#6B7280]">
                Compreendo que estou acessando <strong>dados de saúde de uma criança</strong> (sensíveis por lei). Comprometo-me a manter sigilo e sei que o responsável pode revogar meu acesso a qualquer momento.
              </span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={acceptMutation.isPending || !lgpdChecked}
              className="flex items-center justify-center h-12 rounded-xl text-white text-[15px] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: TEAL }}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Aceitando…
                </>
              ) : (
                "Aceitar e aguardar aprovação"
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              disabled={acceptMutation.isPending}
              className="h-12 rounded-xl text-[15px] font-semibold border border-[#E2E8F0] text-[#6B7280] hover:bg-[#F8FAFC] transition-colors"
            >
              Recusar convite
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
