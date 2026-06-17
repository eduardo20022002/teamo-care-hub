/**
 * /premium — Tela de planos (TEAmo Premium). Escopo-aware: mostra o plano do
 * RESPONSÁVEL (R$ 29,90, roxo) ou do TERAPEUTA (R$ 49,90, teal) conforme o
 * ?scope= recebido (ou o user_type do usuário, como padrão).
 * Etapa 1 (gating): o CTA de assinatura é "Em breve" — checkout AbacatePay na Etapa 2.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePlan, useClinicPlan } from "@/services/subscription.service";
import { THERAPIST_PRICE, PARENT_PRICE, CLINIC_PRICE } from "@/lib/plan-limits";

type Scope = "therapist" | "parent" | "clinic";

const THEME = {
  therapist: { accent: "#0D9488", soft: "#F0FDFA", border: "#CCFBF1" },
  parent: { accent: "#7C3AED", soft: "#F5F3FF", border: "#DDD6FE" },
  clinic: { accent: "#2563EB", soft: "#DBEAFE", border: "#BFDBFE" },
} as const;

// `as any`: rota nova — routeTree.gen.ts só conhece /premium após `npm run dev`/`build`.
export const Route = createFileRoute("/_auth/premium" as any)({
  validateSearch: (s: Record<string, unknown>): { scope?: Scope; clinicId?: string } => ({
    scope:
      s.scope === "parent" ? "parent" : s.scope === "clinic" ? "clinic" : s.scope === "therapist" ? "therapist" : undefined,
    clinicId: typeof s.clinicId === "string" ? s.clinicId : undefined,
  }),
  head: () => ({ meta: [{ title: "TEAmo Premium" }] }),
  component: PremiumPage,
});

type Row = { label: string; free: boolean | string; premium: boolean | string };

const THERAPIST_FEATURES: Row[] = [
  { label: "Pacientes ativos", free: "Até 2", premium: "Ilimitados" },
  { label: "Agenda (sessões avulsas)", free: true, premium: true },
  { label: "Registro pós-sessão (privado)", free: true, premium: true },
  { label: "Marcos e metas (uso interno)", free: true, premium: true },
  { label: "Sessões recorrentes", free: false, premium: true },
  { label: "Plano com vínculo a metas", free: false, premium: true },
  { label: "Vincular pontos a sessão futura", free: false, premium: true },
  { label: "Convidar pais e responsáveis", free: false, premium: true },
  { label: "Recados para a família", free: false, premium: true },
  { label: "Privacidade seletiva no registro", free: false, premium: true },
  { label: "Compartilhar marcos com os pais", free: false, premium: true },
  { label: "Dashboard de evolução para os pais", free: false, premium: true },
];

const PARENT_FEATURES: Row[] = [
  { label: "Portal do terapeuta (marcos, recados, evolução)", free: true, premium: true },
  { label: "Agenda e lembretes", free: true, premium: true },
  { label: "Profissionais (cadastro ilimitado)", free: true, premium: true },
  { label: "Registros do diário", free: "Até 10", premium: "Ilimitados" },
  { label: "Documentos", free: "1", premium: "Ilimitados" },
  { label: "Compartilhar com segurança (OTP)", free: false, premium: true },
  { label: "Convidar co-cuidadores", free: false, premium: true },
];

const CLINIC_FEATURES: Row[] = [
  { label: "Form 1 — fila pública", free: true, premium: true },
  { label: "Ficha do caso + score", free: true, premium: true },
  { label: "Casos na fila", free: "1", premium: "Ilimitados" },
  { label: "Avaliações VB-MAPP", free: "1", premium: "Ilimitadas" },
  { label: "Comunicação (Form 2/3)", free: "1 envio", premium: "Ilimitada" },
  { label: "Autorizações de convênio", free: "1", premium: "Ilimitadas" },
  { label: "Equipe (terapeutas/recepção)", free: false, premium: true },
  { label: "Múltiplas salas + recorrência", free: false, premium: true },
  { label: "Reposições e ausências", free: false, premium: true },
  { label: "Grupos ABA + matching", free: false, premium: true },
];

const COPY: Record<Scope, { title: string; subtitle: string }> = {
  therapist: {
    title: "TEAmo Premium",
    subtitle: "Sem limite de pacientes e tudo que conecta você à família.",
  },
  parent: {
    title: "TEAmo Premium",
    subtitle: "Registros e documentos sem limite, compartilhamento seguro e cuidado em equipe.",
  },
  clinic: {
    title: "TEAmo Clínica Premium",
    subtitle: "Escale a operação: equipe, agenda completa, grupos ABA, financeiro e comunicação sem limite.",
  },
};

function Cell({ value, accent }: { value: boolean | string; accent: string }) {
  if (typeof value === "string") {
    return <span className="text-xs font-medium text-foreground">{value}</span>;
  }
  return value ? (
    <Check className="mx-auto h-4 w-4" style={{ color: accent }} />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />
  );
}

function formatPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function PremiumPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scope: scopeParam, clinicId } = Route.useSearch();
  const { isPremium, isParentPremium } = usePlan();
  const { isClinicPremium } = useClinicPlan(scopeParam === "clinic" ? clinicId : undefined);

  // Padrão de escopo: usa o user_type quando o ?scope não foi informado.
  const { data: profile } = useQuery({
    queryKey: ["premium-user-type", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !scopeParam,
    staleTime: 5 * 60 * 1000,
  });

  const userType = (profile as any)?.user_type;
  const scope: Scope =
    scopeParam ??
    (userType === "therapist" ? "therapist" : userType === "clinic_coordinator" ? "clinic" : "parent");

  const theme = THEME[scope];
  const price = scope === "parent" ? PARENT_PRICE : scope === "clinic" ? CLINIC_PRICE : THERAPIST_PRICE;
  const features =
    scope === "parent" ? PARENT_FEATURES : scope === "clinic" ? CLINIC_FEATURES : THERAPIST_FEATURES;
  const alreadyPremium =
    scope === "parent" ? isParentPremium : scope === "clinic" ? isClinicPremium : isPremium;
  const copy = COPY[scope];

  return (
    <AppShell onBack={() => navigate({ to: "/dashboard" })}>
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-2">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-3xl"
            style={{ background: theme.soft }}
          >
            <Sparkles className="h-7 w-7" style={{ color: theme.accent }} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{copy.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>

        {/* Preço */}
        <div
          className="mb-6 rounded-2xl border p-5 text-center"
          style={{ borderColor: theme.border, background: theme.soft }}
        >
          <div className="flex items-end justify-center gap-1">
            <span className="text-3xl font-bold text-foreground">R$ {formatPrice(price.monthly)}</span>
            <span className="mb-1 text-sm text-muted-foreground">/mês</span>
          </div>
          <p className="mt-1 text-xs font-medium" style={{ color: theme.accent }}>
            {price.trialDays} dias grátis · cancele quando quiser
          </p>
        </div>

        {/* Tabela Free vs Premium */}
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-[1fr_64px_72px] items-center bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Recurso</span>
            <span className="text-center">Free</span>
            <span className="text-center" style={{ color: theme.accent }}>Premium</span>
          </div>
          {features.map((f, i) => (
            <div
              key={f.label}
              className={`grid grid-cols-[1fr_64px_72px] items-center px-4 py-2.5 text-sm ${
                i % 2 ? "bg-muted/20" : ""
              }`}
            >
              <span className="text-foreground">{f.label}</span>
              <span className="text-center"><Cell value={f.free} accent={theme.accent} /></span>
              <span className="text-center"><Cell value={f.premium} accent={theme.accent} /></span>
            </div>
          ))}
        </div>

        {/* CTA — Etapa 1: pagamento ainda não disponível */}
        {alreadyPremium ? (
          <div
            className="mt-6 rounded-xl border p-4 text-center text-sm font-medium"
            style={{ borderColor: theme.border, background: theme.soft, color: theme.accent }}
          >
            Você já é Premium 🎉
          </div>
        ) : (
          <>
            <Button disabled className="mt-6 h-12 w-full rounded-xl text-base font-semibold">
              Assinatura em breve
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              O pagamento via cartão (Abacate Pay) será habilitado em breve.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
