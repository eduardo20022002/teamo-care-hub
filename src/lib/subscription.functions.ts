// ServerFns + helpers do módulo de Assinaturas (Freemium).
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
//
// Etapa 1 (gating): o plano é lido de profiles.therapist_plan (espelho de subscriptions).
// Escritas ficam para a Etapa 2 (webhook AbacatePay) / gating manual via service_role.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PlanTier, PremiumFeature } from "@/lib/plan-limits";

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
