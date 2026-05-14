import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchShareByToken,
  fetchShareItems,
  fetchProfessional,
  hashOtp,
  loadSharedContent,
  logShareEvent,
  signShareJwt,
  SHARING_TABLES,
  timingSafeEqualHex,
  deriveStatus,
} from "@/server/sharing.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";

const MAX_ATTEMPTS = 5;
const ACCESS_TTL_MINUTES = 30;

const bodySchema = z.object({
  token: z.string().min(20).max(200),
  otp: z.string().regex(/^\d{6}$/),
});

export const Route = createFileRoute("/api/public/share/validate-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Rate limit: 20 tentativas por IP / 5 min (em paralelo ao MAX_ATTEMPTS por share)
        const ip = getClientIp(request);
        const rl = rateLimit(`validate-otp:${ip}`, 20, 5 * 60_000);
        if (!rl.allowed) {
          return Response.json(
            { error: "too_many_requests", retryAfterSeconds: rl.retryAfterSeconds },
            { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
          );
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }

        const share = await fetchShareByToken(parsed.data.token);
        if (!share) return Response.json({ error: "not_found" }, { status: 404 });

        const status = deriveStatus(share);
        if (status === "revoked") {
          await logShareEvent(share.user_id, "share.access_denied_revoked", { share_id: share.id });
          return Response.json({ error: "revoked" }, { status: 410 });
        }
        if (status === "expired") {
          await logShareEvent(share.user_id, "share.access_denied_expired", { share_id: share.id });
          return Response.json({ error: "expired" }, { status: 410 });
        }

        if (!share.otp_hash || !share.otp_expires_at) {
          return Response.json({ error: "otp_not_requested" }, { status: 400 });
        }
        if (new Date(share.otp_expires_at) <= new Date()) {
          return Response.json({ error: "otp_expired" }, { status: 410 });
        }
        if (share.otp_attempts >= MAX_ATTEMPTS) {
          // lock the share permanently by revoking it
          await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", share.id);
          await logShareEvent(share.user_id, "share.access_denied_revoked", {
            share_id: share.id,
            reason: "max_otp_attempts",
          });
          return Response.json({ error: "too_many_attempts" }, { status: 429 });
        }

        const candidate = hashOtp(parsed.data.otp);
        if (!timingSafeEqualHex(candidate, share.otp_hash)) {
          const newAttempts = share.otp_attempts + 1;
          await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
            .update({ otp_attempts: newAttempts })
            .eq("id", share.id);
          await logShareEvent(share.user_id, "share.otp_failed", {
            share_id: share.id,
            attempts: newAttempts,
          });
          return Response.json(
            {
              error: "otp_invalid",
              attemptsRemaining: Math.max(0, MAX_ATTEMPTS - newAttempts),
            },
            { status: 401 },
          );
        }

        // Success: clear OTP, mark consumed_at if first time
        const updates: Record<string, unknown> = {
          otp_hash: null,
          otp_expires_at: null,
          otp_attempts: 0,
        };
        if (!share.consumed_at) updates.consumed_at = new Date().toISOString();
        await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
          .update(updates)
          .eq("id", share.id);

        const items = await fetchShareItems(share.id);
        const content = await loadSharedContent(items);
        const prof = await fetchProfessional(share.professional_id);

        const accessToken = signShareJwt({
          share_id: share.id,
          exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_MINUTES * 60,
        });

        await logShareEvent(share.user_id, "share.otp_succeeded", { share_id: share.id });

        return Response.json({
          ok: true,
          accessToken,
          accessTtlMinutes: ACCESS_TTL_MINUTES,
          shareExpiresAt: share.expires_at,
          professional: prof ? { name: prof.name, specialty: prof.specialty } : null,
          content,
        });
      },
    },
  },
});
