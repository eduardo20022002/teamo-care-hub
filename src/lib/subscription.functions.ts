// ServerFns do módulo de Assinaturas — apenas stubs para o cliente.
// A lógica server-only fica em subscription.server.ts (importado via dynamic import nos handlers).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanScope } from "@/lib/plan-limits";

export const getMySubscriptionStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runGetMySubscriptionStatus } = await import("@/lib/subscription.server");
    return runGetMySubscriptionStatus((context as any).userId);
  });

export const getClinicPlanStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { runGetClinicPlanStatus } = await import("@/lib/subscription.server");
    return runGetClinicPlanStatus((context as any).userId, data.clinicId);
  });

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
    const { runCreateSubscriptionCheckout } = await import("@/lib/subscription.server");
    return runCreateSubscriptionCheckout((context as any).userId, data as { scope: PlanScope; clinicId?: string });
  });
