import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, AlertTriangle, Clock, Link as LinkIcon, CheckCircle2, Baby, FileText, Calendar, Stethoscope, ClipboardList } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { getCareInviteContextServer } from "@/lib/care-sharing.functions";
import { formatAge } from "@/lib/formatters";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite — TEAmo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConviteLandingPage,
});

type InviteContext =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "expired"; expiresAt: string }
  | { state: "already_used" }
  | {
      state: "valid";
      inviteId: string;
      ownerName: string;
      childName: string;
      childBirthDate: string;
      inviteeAlias: string;
      inviteeEmail: string;
      role: "admin" | "viewer";
      expiresAt: string;
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

// ─── Estados de erro ──────────────────────────────────────────────────────────

function ErrorCard({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4] text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: "#FEF2F2" }}
      >
        <Icon size={28} color="#DC2626" strokeWidth={1.8} />
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

function ConviteLandingPage() {
  const { token } = Route.useParams();
  const [ctx, setCtx] = useState<InviteContext>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    getCareInviteContextServer({ data: { token } })
      .then((res) => {
        if (!cancelled) setCtx(res as InviteContext);
      })
      .catch(() => {
        if (!cancelled) setCtx({ state: "invalid" });
      });
    return () => { cancelled = true; };
  }, [token]);

  if (ctx.state === "loading") {
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
          description="Este link de convite não existe ou foi cancelado. Entre em contato com quem te convidou para solicitar um novo convite."
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
          description="Este convite era válido por 48 horas e já expirou. Peça ao responsável para reenviar um novo convite."
        />
      </Shell>
    );
  }

  if (ctx.state === "already_used") {
    return (
      <Shell>
        <ErrorCard
          icon={CheckCircle2}
          title="Convite já utilizado"
          description="Este convite já foi aceito. Se você já tem uma conta no TEAmo, faça login para acessar."
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

  // Estado válido (Tela 7)
  const isAdmin = ctx.role === "admin";

  return (
    <Shell>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#EEF0F4]">
        {/* Header */}
        <div className="text-center mb-5">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "#F0FDFA" }}
          >
            <Baby size={28} color={TEAL} strokeWidth={1.7} />
          </div>
          <h2 className="text-[20px] font-bold text-[#0F172A] leading-tight">
            {ctx.ownerName} te convidou
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            para acompanhar o cuidado de <strong>{ctx.childName}</strong> no TEAmo
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

        {/* Aviso de aprovação */}
        <div
          className="rounded-xl px-4 py-3 mb-5 text-xs leading-relaxed"
          style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}
        >
          ⚠️ Após aceitar, o responsável precisará <strong>aprovar seu acesso</strong> antes que você possa entrar.
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <Link
            to="/login"
            search={{ invite: token }}
            className="flex items-center justify-center h-12 rounded-xl text-white text-[15px] font-bold"
            style={{ background: TEAL }}
          >
            Já tenho conta — fazer login
          </Link>
          <Link
            to="/cadastro"
            search={{ invite: token }}
            className="flex items-center justify-center h-12 rounded-xl text-[15px] font-semibold border"
            style={{ borderColor: TEAL, color: TEAL }}
          >
            Criar conta no TEAmo
          </Link>
        </div>
      </div>

      <p className="text-center text-xs text-[#9CA3AF] mt-4">
        Convite expira em{" "}
        {new Date(ctx.expiresAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </Shell>
  );
}
