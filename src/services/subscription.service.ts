// Hooks React Query para o módulo de Assinaturas (Freemium).
// Wrappam os ServerFns de subscription.functions.ts.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getMySubscriptionStatusServer,
  getClinicPlanStatusServer,
  createSubscriptionCheckoutServer,
} from "@/lib/subscription.functions";
import type { PlanScope } from "@/lib/plan-limits";
import {
  THERAPIST_LIMITS,
  THERAPIST_PRICE,
  PARENT_LIMITS,
  PARENT_PRICE,
  CLINIC_LIMITS,
  CLINIC_PRICE,
  type PlanTier,
} from "@/lib/plan-limits";

export const subscriptionKeys = {
  status: () => ["subscription-status"] as const,
  clinicStatus: (clinicId: string) => ["clinic-subscription-status", clinicId] as const,
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface PlanState {
  // Terapeuta
  therapistPlan: PlanTier;
  isPremium: boolean;            // = isTherapistPremium (compat com chamadas existentes)
  limits: typeof THERAPIST_LIMITS;
  price: typeof THERAPIST_PRICE;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  // Responsável
  parentPlan: PlanTier;
  isParentPremium: boolean;
  parentLimits: typeof PARENT_LIMITS;
  parentPrice: typeof PARENT_PRICE;
  parentStatus: string | null;
  parentTrialEndsAt: string | null;
  // Comum
  isLoading: boolean;
}

/** Plano do usuário logado (escopos terapeuta e responsável). */
export function usePlan(): PlanState {
  const fn = useServerFn(getMySubscriptionStatusServer);
  const { data, isLoading } = useQuery({
    queryKey: subscriptionKeys.status(),
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ headers: h });
    },
    staleTime: 60_000,
  });

  const therapistPlan: PlanTier = data?.therapistPlan === "premium" ? "premium" : "free";
  const parentPlan: PlanTier = data?.parentPlan === "premium" ? "premium" : "free";

  return {
    therapistPlan,
    isPremium: therapistPlan === "premium",
    limits: THERAPIST_LIMITS,
    price: THERAPIST_PRICE,
    status: data?.status ?? null,
    trialEndsAt: data?.trialEndsAt ?? null,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    parentPlan,
    isParentPremium: parentPlan === "premium",
    parentLimits: PARENT_LIMITS,
    parentPrice: PARENT_PRICE,
    parentStatus: (data as any)?.parentStatus ?? null,
    parentTrialEndsAt: (data as any)?.parentTrialEndsAt ?? null,
    isLoading,
  };
}

export interface ClinicPlanState {
  clinicPlan: PlanTier;
  isClinicPremium: boolean;
  isLoading: boolean;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  limits: typeof CLINIC_LIMITS;
  price: typeof CLINIC_PRICE;
}

/** ServerFn de checkout — retornado por useServerFn para uso em mutations no client. */
export function useCheckoutFn() {
  return useServerFn(createSubscriptionCheckoutServer);
}

export type CheckoutInput = { scope: PlanScope; clinicId?: string };

/** Plano de uma clínica específica (por clinicId). */
export function useClinicPlan(clinicId: string | undefined): ClinicPlanState {
  const fn = useServerFn(getClinicPlanStatusServer);
  const { data, isLoading } = useQuery({
    queryKey: subscriptionKeys.clinicStatus(clinicId ?? ""),
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ headers: h, data: { clinicId: clinicId! } } as any);
    },
    enabled: !!clinicId,
    staleTime: 60_000,
  });

  const clinicPlan: PlanTier = data?.clinicPlan === "premium" ? "premium" : "free";

  return {
    clinicPlan,
    isClinicPremium: clinicPlan === "premium",
    isLoading,
    status: data?.status ?? null,
    trialEndsAt: data?.trialEndsAt ?? null,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    limits: CLINIC_LIMITS,
    price: CLINIC_PRICE,
  };
}
