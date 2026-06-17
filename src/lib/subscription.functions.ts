// ServerFns + helpers do módulo de Assinaturas (Freemium).
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PlanTier, PlanScope, PremiumFeature } from "@/lib/plan-limits";

const ABACATEPAY_BASE = "https://api.abacatepay.com/v2";

function abacateHeaders() {
  return {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ─── Helpers de gate (reutilizados por todos os ServerFns gated) ──────────────

/** Lê o plano do terapeuta a partir do espelho em profiles. Default seguro: 'free'. */
export async function getTherapistPlan(userId: string): Promise<PlanTier> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("therapist_plan")
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.therapist_plan === "premium" ? "premium" : "free";
}

/** true se o terapeuta tem Premium ativo. */
export async function isTherapistPremium(userId: string): Promise<boolean> {
  return (await getTherapistPlan(userId)) === "premium";
}

/** Lê o plano do responsável a partir do espelho em profiles. Default seguro: 'free'. */
export async function getParentPlan(userId: string): Promise<PlanTier> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("parent_plan")
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.parent_plan === "premium" ? "premium" : "free";
}

/** true se o responsável tem Premium ativo. */
export async function isParentPremium(userId: string): Promise<boolean> {
  return (await getParentPlan(userId)) === "premium";
}

/**
 * Lança 402 PREMIUM_REQUIRED se o responsável não for premium.
 * Usado pelos gates de feature do responsável (compartilhamentos, cuidado compartilhado).
 */
export async function assertParentPremium(
  userId: string,
  feature: PremiumFeature,
): Promise<void> {
  if (await isParentPremium(userId)) return;
  throw new Response(
    JSON.stringify({ code: "PREMIUM_REQUIRED", feature }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}

/**
 * Lança 402 PREMIUM_REQUIRED se o terapeuta não for premium.
 * Usado pelos gates de FEATURE EXCLUSIVA. O corpo carrega `feature` para a UI
 * abrir o UpgradeModal certo. Defense-in-depth: vale mesmo se a UI esconder o controle.
 */
export async function assertTherapistPremium(
  userId: string,
  feature: PremiumFeature,
): Promise<void> {
  if (await isTherapistPremium(userId)) return;
  throw new Response(
    JSON.stringify({ code: "PREMIUM_REQUIRED", feature }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}

// ─── getMySubscriptionStatusServer — status do plano para o frontend ──────────

export const getMySubscriptionStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("therapist_plan, parent_plan")
      .eq("id", userId)
      .maybeSingle();

    const therapistPlan: PlanTier =
      (profile as any)?.therapist_plan === "premium" ? "premium" : "free";
    const parentPlan: PlanTier =
      (profile as any)?.parent_plan === "premium" ? "premium" : "free";

    // Detalhes da assinatura (status/trial/período) por escopo. Pode não existir no gating manual.
    const { data: subs } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("scope, status, trial_ends_at, current_period_end")
      .eq("user_id", userId)
      .in("scope", ["therapist", "parent"]);

    const therapistSub = (subs ?? []).find((s: any) => s.scope === "therapist");
    const parentSub = (subs ?? []).find((s: any) => s.scope === "parent");

    return {
      therapistPlan,
      parentPlan,
      status: therapistSub?.status ?? (therapistPlan === "premium" ? "active" : null),
      trialEndsAt: therapistSub?.trial_ends_at ?? null,
      currentPeriodEnd: therapistSub?.current_period_end ?? null,
      parentStatus: parentSub?.status ?? (parentPlan === "premium" ? "active" : null),
      parentTrialEndsAt: parentSub?.trial_ends_at ?? null,
      parentCurrentPeriodEnd: parentSub?.current_period_end ?? null,
    };
  });

// ─── Clínica — plano por clínica (espelho em clinics.clinic_plan) ─────────────

/** Lê o plano da clínica. Default seguro: 'free'. */
export async function getClinicPlan(clinicId: string): Promise<PlanTier> {
  const { data } = await (supabaseAdmin as any)
    .from("clinics")
    .select("clinic_plan")
    .eq("id", clinicId)
    .maybeSingle();
  return (data as any)?.clinic_plan === "premium" ? "premium" : "free";
}

/** true se a clínica tem Premium ativo. */
export async function isClinicPremium(clinicId: string): Promise<boolean> {
  return (await getClinicPlan(clinicId)) === "premium";
}

/**
 * Erro padrão de paywall para os ServerFns da clínica (que usam o padrão de
 * retorno `{ ok:false, error }`, não throw). O front intercepta o prefixo
 * `PREMIUM_REQUIRED:<feature>` e abre o UpgradeModal.
 */
export function clinicGateError(feature: PremiumFeature): { ok: false; error: string } {
  return { ok: false, error: `PREMIUM_REQUIRED:${feature}` };
}

/** Conta linhas de uma tabela para a clínica (gate de limite). */
export async function clinicResourceCount(
  table: string,
  clinicId: string,
  extra?: (q: any) => any,
): Promise<number> {
  let q = (supabaseAdmin as any).from(table).select("id", { count: "exact", head: true }).eq("clinic_id", clinicId);
  if (extra) q = extra(q);
  const { count } = await q;
  return count ?? 0;
}

// ─── AbacatePay — checkout de assinatura ──────────────────────────────────────

/**
 * Retorna o `customerId` AbacatePay do usuário.
 * Primeiro tenta reusar um ID já salvo em qualquer subscription desse usuário.
 * Se não encontrar, cria um novo customer via API e retorna o ID (não persiste —
 * o webhook salva após a assinatura ser criada).
 */
async function createOrGetAbacateCustomer(userId: string): Promise<string> {
  const { data: existing } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("provider_customer_id")
    .eq("user_id", userId)
    .not("provider_customer_id", "is", null)
    .limit(1)
    .maybeSingle();

  if ((existing as any)?.provider_customer_id) {
    return (existing as any).provider_customer_id as string;
  }

  const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const resp = await fetch(`${ABACATEPAY_BASE}/customers/create`, {
    method: "POST",
    headers: abacateHeaders(),
    body: JSON.stringify({
      name: (profile as any)?.full_name ?? "Usuário TEAmo",
      email: authData?.user?.email ?? "",
    }),
  });
  const json = await resp.json();
  if (!json.success) throw new Error(`AbacatePay customer: ${json.error}`);
  return json.data.id as string;
}

export const createSubscriptionCheckoutServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        scope: z.enum(["therapist", "parent", "clinic"]),
        clinicId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> => {
    const { userId } = context as any;

    const { data: existing } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .eq("scope", data.scope)
      .maybeSingle();

    if ((existing as any)?.status === "active" || (existing as any)?.status === "trialing") {
      return { ok: false, error: "ALREADY_SUBSCRIBED" };
    }

    const productIds: Record<PlanScope, string | undefined> = {
      therapist: process.env.ABACATEPAY_PRODUCT_THERAPIST_ID,
      parent: process.env.ABACATEPAY_PRODUCT_PARENT_ID,
      clinic: process.env.ABACATEPAY_PRODUCT_CLINIC_ID,
    };
    const productId = productIds[data.scope];
    if (!productId) return { ok: false, error: "PRODUCT_NOT_CONFIGURED" };

    let customerId: string;
    try {
      customerId = await createOrGetAbacateCustomer(userId);
    } catch (e: any) {
      return { ok: false, error: e.message ?? "CUSTOMER_ERROR" };
    }

    const appUrl = (process.env.APP_URL ?? "https://teamo.vercel.app").replace(/\/$/, "");
    const scopeQs = `scope=${data.scope}${data.clinicId ? `&clinicId=${data.clinicId}` : ""}`;

    const resp = await fetch(`${ABACATEPAY_BASE}/subscriptions/create`, {
      method: "POST",
      headers: abacateHeaders(),
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        customerId,
        externalId: `${userId}:${data.scope}`,
        completionUrl: `${appUrl}/premium/ativado?${scopeQs}`,
        returnUrl: `${appUrl}/premium?${scopeQs}`,
        methods: ["CARD"],
      }),
    });
    const json = await resp.json();
    if (!json.success) return { ok: false, error: json.error ?? "CHECKOUT_ERROR" };
    return { ok: true, checkoutUrl: json.data.url as string };
  });

// ─── getClinicPlanStatusServer — status do plano da clínica para o frontend ───

export const getClinicPlanStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Defense-in-depth: só membros da clínica leem o status.
    const { data: member } = await (supabaseAdmin as any)
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .maybeSingle();
    if (!member) throw new Response("Sem acesso a esta clínica.", { status: 403 });

    const clinicPlan = await getClinicPlan(data.clinicId);

    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("status, trial_ends_at, current_period_end")
      .eq("scope", "clinic")
      .maybeSingle();

    return {
      clinicPlan,
      status: (sub as any)?.status ?? (clinicPlan === "premium" ? "active" : null),
      trialEndsAt: (sub as any)?.trial_ends_at ?? null,
      currentPeriodEnd: (sub as any)?.current_period_end ?? null,
    };
  });
