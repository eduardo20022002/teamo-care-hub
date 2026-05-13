import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchShareByToken,
  fetchProfessional,
  fetchParentName,
  generateOtp,
  hashOtp,
  logShareEvent,
  sendOtpEmail,
  SHARING_TABLES,
  deriveStatus,
} from "@/server/sharing.server";

const OTP_TTL_MINUTES = 10;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

const bodySchema = z.object({
  token: z.string().min(20).max(200),
});

export const Route = createFileRoute("/api/public/share/request-otp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        if (!share) {
          return Response.json({ error: "not_found" }, { status: 404 });
        }
        const status = deriveStatus(share);
        if (status === "revoked") {
          await logShareEvent(share.user_id, "share.access_denied_revoked", {
            share_id: share.id,
          });
          return Response.json({ error: "revoked" }, { status: 410 });
        }
        if (status === "expired") {
          await logShareEvent(share.user_id, "share.access_denied_expired", {
            share_id: share.id,
          });
          return Response.json({ error: "expired" }, { status: 410 });
        }

        const prof = await fetchProfessional(share.professional_id);
        if (!prof) {
          return Response.json({ error: "professional_missing" }, { status: 500 });
        }

        // Cooldown: prevent OTP spam (60s between requests)
        const COOLDOWN_MS = 60_000;
        if (share.otp_expires_at) {
          const lastIssuedAt =
            new Date(share.otp_expires_at).getTime() - OTP_TTL_MINUTES * 60 * 1000;
          const since = Date.now() - lastIssuedAt;
          if (since < COOLDOWN_MS) {
            return Response.json(
              {
                error: "cooldown",
                retryAfterSeconds: Math.ceil((COOLDOWN_MS - since) / 1000),
              },
              { status: 429 },
            );
          }
        }

        // If max attempts already reached, do not re-issue (revoke)
        const MAX_ATTEMPTS = 5;
        if (share.otp_attempts >= MAX_ATTEMPTS) {
          await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", share.id);
          await logShareEvent(share.user_id, "share.access_denied_revoked", {
            share_id: share.id,
            reason: "max_otp_attempts",
          });
          return Response.json({ error: "too_many_attempts" }, { status: 429 });
        }

        const otp = generateOtp();
        const otp_hash = hashOtp(otp);
        const otp_expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

        // NOTE: do NOT reset otp_attempts here — preserves brute-force lockout across re-issues.
        const { error: updErr } = await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
          .update({ otp_hash, otp_expires_at })
          .eq("id", share.id);
        if (updErr) {
          return Response.json({ error: "update_failed" }, { status: 500 });
        }

        const parentName = await fetchParentName(share.user_id);
        const send = await sendOtpEmail({
          to: prof.email,
          otp,
          professionalName: prof.name,
          parentName,
          expiresInMinutes: OTP_TTL_MINUTES,
          shareExpiresAt: share.expires_at,
        });

        await logShareEvent(share.user_id, "share.otp_requested", {
          share_id: share.id,
          professional_id: share.professional_id,
          email_sent: send.ok,
          email_error: send.error ?? null,
        });

        if (!send.ok) {
          // Log internal detail server-side; return generic message to client.
          console.error("[share.request-otp] email send failed:", send.error);
          return Response.json(
            {
              error: "email_failed",
              detail:
                "Não foi possível enviar o código agora. Tente novamente em instantes.",
              professionalEmailMasked: maskEmail(prof.email),
            },
            { status: 502 },
          );
        }

        return Response.json({
          ok: true,
          professionalEmailMasked: maskEmail(prof.email),
          ttlMinutes: OTP_TTL_MINUTES,
        });
      },
    },
  },
});
