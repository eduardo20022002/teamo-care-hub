// Helpers server-only do módulo de Assinaturas.
// Este arquivo NUNCA é importado por código cliente — apenas por *.functions.ts e Edge Functions.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PlanTier, PlanScope, PremiumFeature } from "@/lib/plan-limits";

const ABACATEPAY_BASE = "https://api.abacatepay.com/v2";

export function abacateHeaders() {
  return {
    Authorization: `Bearer ${process.env.ABACATEPAY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ─── Helpers de gate ──────────────────────────────────────────────────────────

/**
 * true se o usuário tem um trial ATIVO (status='trialing' e trial_ends_at no futuro)
 * para o escopo dado. Inclui o trial grandfather (provider=null) e o trial de uma
 * assinatura AbacatePay. Durante o trial os gates premium não disparam.
 */
export async function hasActiveTrial(userId: string, scope: PlanScope): Promise<boolean> {
  const { data } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("status, trial_ends_at")
    .eq("user_id", userId)
    .eq("scope", scope)
    .maybeSingle();
  const sub = data as any;
  if (!sub || sub.status !== "trialing") return false;
  if (!sub.trial_ends_at) return true; // trial sem data definida → considera ativo
  return new Date(sub.trial_ends_at).getTime() > Date.now();
}

export async function getTherapistPlan(userId: string): Promise<PlanTier> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("therapist_plan")
    .eq("id", userId)
    .maybeSingle();
  if ((data as any)?.therapist_plan === "premium") return "premium";
  return (await hasActiveTrial(userId, "therapist")) ? "premium" : "free";
}

export async function isTherapistPremium(userId: string): Promise<boolean> {
  return (await getTherapistPlan(userId)) === "premium";
}

export async function getParentPlan(userId: string): Promise<PlanTier> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("parent_plan")
    .eq("id", userId)
    .maybeSingle();
  if ((data as any)?.parent_plan === "premium") return "premium";
  return (await hasActiveTrial(userId, "parent")) ? "premium" : "free";
}

export async function isParentPremium(userId: string): Promise<boolean> {
  return (await getParentPlan(userId)) === "premium";
}

export async function assertParentPremium(userId: string, feature: PremiumFeature): Promise<void> {
  if (await isParentPremium(userId)) return;
  throw new Response(
    JSON.stringify({ code: "PREMIUM_REQUIRED", feature }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}

export async function assertTherapistPremium(userId: string, feature: PremiumFeature): Promise<void> {
  if (await isTherapistPremium(userId)) return;
  throw new Response(
    JSON.stringify({ code: "PREMIUM_REQUIRED", feature }),
    { status: 402, headers: { "Content-Type": "application/json" } },
  );
}

export async function getClinicPlan(clinicId: string): Promise<PlanTier> {
  const { data } = await (supabaseAdmin as any)
    .from("clinics")
    .select("clinic_plan, owner_id")
    .eq("id", clinicId)
    .maybeSingle();
  if ((data as any)?.clinic_plan === "premium") return "premium";
  // A assinatura/trial da clínica fica vinculada ao owner_id (scope='clinic').
  const ownerId = (data as any)?.owner_id;
  if (ownerId && (await hasActiveTrial(ownerId, "clinic"))) return "premium";
  return "free";
}

export async function isClinicPremium(clinicId: string): Promise<boolean> {
  return (await getClinicPlan(clinicId)) === "premium";
}

export function clinicGateError(feature: PremiumFeature): { ok: false; error: string } {
  return { ok: false, error: `PREMIUM_REQUIRED:${feature}` };
}

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

// ─── AbacatePay — customer ────────────────────────────────────────────────────

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

// ─── Implementações dos handlers (chamadas via dynamic import no functions.ts) ─

export async function runGetMySubscriptionStatus(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("therapist_plan, parent_plan")
    .eq("id", userId)
    .maybeSingle();

  const { data: subs } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("scope, status, trial_ends_at, current_period_end")
    .eq("user_id", userId)
    .in("scope", ["therapist", "parent"]);

  const therapistSub = (subs ?? []).find((s: any) => s.scope === "therapist");
  const parentSub = (subs ?? []).find((s: any) => s.scope === "parent");

  // Trial ativo (grandfather ou AbacatePay) também concede premium para a UI.
  const trialActive = (sub: any): boolean =>
    sub?.status === "trialing" &&
    (!sub.trial_ends_at || new Date(sub.trial_ends_at).getTime() > Date.now());

  const therapistPlan: PlanTier =
    (profile as any)?.therapist_plan === "premium" || trialActive(therapistSub) ? "premium" : "free";
  const parentPlan: PlanTier =
    (profile as any)?.parent_plan === "premium" || trialActive(parentSub) ? "premium" : "free";

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
}

export async function runGetClinicPlanStatus(userId: string, clinicId: string) {
  const { data: member } = await (supabaseAdmin as any)
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .not("joined_at", "is", null)
    .maybeSingle();
  if (!member) throw new Response("Sem acesso a esta clínica.", { status: 403 });

  const clinicPlan = await getClinicPlan(clinicId);

  const { data: clinicRow } = await (supabaseAdmin as any)
    .from("clinics")
    .select("owner_id")
    .eq("id", clinicId)
    .maybeSingle();

  const { data: sub } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("status, trial_ends_at, current_period_end")
    .eq("user_id", (clinicRow as any)?.owner_id ?? "")
    .eq("scope", "clinic")
    .maybeSingle();

  return {
    clinicPlan,
    status: (sub as any)?.status ?? (clinicPlan === "premium" ? "active" : null),
    trialEndsAt: (sub as any)?.trial_ends_at ?? null,
    currentPeriodEnd: (sub as any)?.current_period_end ?? null,
  };
}

export async function runCreateSubscriptionCheckout(
  userId: string,
  data: { scope: PlanScope; clinicId?: string },
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const { data: existing } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("status, provider")
    .eq("user_id", userId)
    .eq("scope", data.scope)
    .maybeSingle();

  // Bloqueia só quem já tem assinatura real do AbacatePay ativa ou em trial.
  // O trial grandfather (provider=null) PODE assinar para converter em pago.
  const ex = existing as any;
  const hasRealSub =
    ex?.provider === "abacatepay" && (ex?.status === "active" || ex?.status === "trialing");
  if (hasRealSub) {
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
}
