// ServerFns de analytics — único ponto de entrada do cliente para registrar eventos.
// Nunca importar analytics.server.ts diretamente no cliente.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  trackEvent,
  assertAdmin,
  fetchBusinessHealthData,
  fetchUserBehaviorData,
  fetchTechnicalHealthData,
} from "@/server/analytics.server";

// ─── trackEventServer ────────────────────────────────────────────────────────

const trackSchema = z.object({
  sessionId: z.string().max(64).optional(),
  eventType: z.string().min(1).max(80),
  module: z.string().max(40).optional(),
  route: z.string().max(200).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  /** Apenas primitivos simples — nunca strings clínicas longas */
  properties: z
    .record(z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export const trackEventServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => trackSchema.parse(data))
  .handler(async ({ data, context }) => {
    // fire-and-forget: não aguardamos, não propagamos erros
    void trackEvent({
      userId: context.userId,
      sessionId: data.sessionId,
      eventType: data.eventType,
      module: data.module,
      route: data.route,
      durationMs: data.durationMs,
      properties: data.properties as Record<string, string | number | boolean | null> | undefined,
    });
    return { ok: true as const };
  });

// ─── Admin metrics ServerFns ─────────────────────────────────────────────────

export const getBusinessHealthServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return fetchBusinessHealthData();
  });

export const getUserBehaviorServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return fetchUserBehaviorData();
  });

export const getTechnicalHealthServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return fetchTechnicalHealthData();
  });
