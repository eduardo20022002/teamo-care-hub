import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/logger";
import type { Json } from "@/integrations/supabase/types";

const ALLOWED_EVENTS = [
  "auth.signup_success",
  "auth.login_success",
  "auth.logout",
  "auth.session_expired",
] as const;

const logAuthEventSchema = z.object({
  userId: z.string().uuid().nullable(),
  eventType: z.enum(ALLOWED_EVENTS),
  // Free-form metadata is bounded and stripped of obviously sensitive keys.
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase();
    if (
      lower === "password" ||
      lower === "secret" ||
      lower === "token" ||
      lower === "otp" ||
      lower === "email" ||   // PHI — use userId instead
      lower === "phone" ||   // PHI
      lower === "cpf"        // PHI
    ) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Server-only audit log insert. The client cannot bypass this — RLS denies
 * authenticated INSERTs to audit_logs (see migration 20260514000000).
 */
export const logAuthEventServer = createServerFn({ method: "POST" })
  .inputValidator((data) => logAuthEventSchema.parse(data))
  .handler(async ({ data }) => {
    const metadata = sanitizeMetadata(data.metadata);
    if (Object.keys(metadata).length > 32) {
      // Cap metadata size — no large payloads in audit storage.
      return { ok: false as const, error: "metadata_too_large" };
    }
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: data.userId,
      event_type: data.eventType,
      metadata: metadata as Json,
    });
    if (error) {
      logger.error("audit.log_insert_failed", {
        eventType: data.eventType,
        failureCode: "insert_failed",
      });
      return { ok: false as const, error: "insert_failed" };
    }
    return { ok: true as const };
  });
