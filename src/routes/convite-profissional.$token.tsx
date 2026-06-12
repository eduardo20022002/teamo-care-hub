import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Loader2,
  AlertTriangle,
  Clock,
  Link as LinkIcon,
  CheckCircle2,
  Users,
  MessageSquare,
  FileText,
} from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import {
  getParentProfessionalInviteContextServer,
  acceptParentProfessionalInviteServer,
} from "@/lib/parent-professional.functions";
import { formatAge } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/convite-profissional/$token")({
  head: () => ({
    meta: [
      { title: "Convite para acompanhar — TEAmo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConviteProfissionalPage,
});

type InviteCtx =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "already_used" }
  | {
      state: "valid";
      inviteId: string;
      parentName: string;
      childName: string;
      childBirthDate: string | null;
      inviteeName: string | null;
      inviteeEmail: string;
    };

const TEAL = "#0D9488";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F3F4F8] flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-6">
          <BrandLogo />
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorCard({
  icon: Icon,
  title,
  description,
  action,
  iconBg = "#FEF2F2",
  iconColor = "#DC2626",
}: {
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  action?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4] text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: iconBg }}
      >
        <Icon size={28} color={iconColor} strokeWidth={1.8} />
      </div>
      <h2 className="text-[18px] font-bold text-[#0F172A] mb-2">{title}</h2>
      <p className="text-sm text-[#6B7280] leading-relaxed mb-4">{description}</p>
      {action}
    </div>
  );
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

function ConviteProfissionalPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [ctx, setCtx] = useState<InviteCtx>({ state: "loading" });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getParentProfessionalInviteContextServer({ data: { token } })
      .then((res) => {
        if (!cancelled) setCtx(res as InviteCtx);
      })
      .catch(() => {
        if (!cancelled) setCtx({ state: "invalid" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept() {
    if (!user) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      await acceptParentProfessionalInviteServer({ data: { token } });
      await navigate({ to: "/acompanhamentos" });
    } catch (e: any) {
      const msg =
        e?.message ||
        "Não foi possível aceitar o convite. Verifique se está logado com o e-mail correto.";
      setAcceptError(msg);
      setAccepting(false);
    }
  }

  if (ctx.state === "loading" || authLoading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={32} color={TEAL} className="animate-spin" />
          <p className="text-sm text-[#6B7280]">Verificando convite…</p>
        </div>
      </Shell>
    );
  }

  if (ctx.state === "invalid") {
    return (
      <Shell>
        <ErrorCard
          icon={LinkIcon}
          title="Link inválido"
          description="Este convite não existe ou foi cancelado. Entre em contato com quem te convidou para solicitar um novo."
        />
      </Shell>
    );
  }

  if (ctx.state === "expired") {
    return (
      <Shell>
        <ErrorCard
          icon={Clock}
          title="Convite expirado"
          description="Este convite já não é mais válido. Peça ao responsável para reenviar um novo convite pelo TEAmo."
        />
      </Shell>
    );
  }

  if (ctx.state === "already_used") {
    return (
      <Shell>
        <ErrorCard
          icon={CheckCircle2}
          title="Convite já aceito"
          description="Este convite já foi aceito anteriormente. Faça login para ver os acompanhamentos."
          iconBg="#ECFDF5"
          iconColor="#16A34A"
          action={
            <Link
              to="/login"
              className="inline-flex items-center justify-center h-11 rounded-xl px-6 text-white text-[14px] font-semibold"
              style={{ background: TEAL }}
            >
              Ir para o login
            </Link>
          }
        />
      </Shell>
    );
  }

  // Estado válido
  const firstName = ctx.childName.split(" ")[0];

  return (
    <Shell>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4]">
        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "#F0FDFA" }}
          >
            <Users size={28} color={TEAL} strokeWidth={1.7} />
          </div>
          <h2 className="text-[20px] font-bold text-[#0F172A] leading-tight">
            {ctx.parentName} te convidou
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            para acompanhar o desenvolvimento de{" "}
            <strong>{ctx.childName}</strong> no TEAmo
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
                <p className="text-xs text-[#6B7280]">
                  {formatAge(ctx.childBirthDate)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* O que você vai acessar */}
        <p className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2 px-1">
          Com sua conta gratuita você poderá
        </p>
        <div className="rounded-xl border border-[#EEF0F4] px-4 mb-5">
          <AccessItem icon={FileText} label={`Ver registros e documentos de ${firstName}`} />
          <AccessItem icon={MessageSquare} label={`Trocar recados com ${ctx.parentName}`} />
          <AccessItem icon={Users} label="Fazer parte da rede de cuidado da família" />
        </div>

        {/* Ações */}
        {user ? (
          /* Usuário já está logado — aceitar direto */
          <div className="flex flex-col gap-3">
            {acceptError && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-[13px] text-red-700 text-center">
                {acceptError}
              </div>
            )}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="h-12 w-full rounded-xl text-white text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: TEAL }}
            >
              {accepting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Aceitar e acompanhar"
              )}
            </button>
            <p className="text-center text-[12px] text-[#9CA3AF]">
              Logado como <strong>{user.email}</strong>
            </p>
          </div>
        ) : (
          /* Usuário não está logado — criar conta ou entrar */
          <div className="flex flex-col gap-3">
            <Link
              to="/cadastro"
              search={{ profissionalInvite: token, userType: "therapist" } as any}
              className="h-12 w-full rounded-xl text-white text-[15px] font-semibold flex items-center justify-center"
              style={{ background: TEAL }}
            >
              Criar conta gratuita no TEAmo
            </Link>
            <Link
              to="/login"
              search={{ profissionalInvite: token } as any}
              className="h-12 w-full rounded-xl text-[15px] font-semibold flex items-center justify-center border"
              style={{
                borderColor: TEAL,
                color: TEAL,
                background: "#fff",
              }}
            >
              Já tenho conta — Entrar
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[12px] text-[#9CA3AF]">
        Se você não esperava este convite, pode ignorar esta página com segurança.
      </p>
    </Shell>
  );
}
