import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchShareById,
  fetchShareItems,
  verifyShareJwt,
  deriveStatus,
} from "@/server/sharing.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";

const bodySchema = z.object({
  accessToken: z.string().min(20),
  source: z.enum(["record", "child"]),
  documentId: z.string().uuid(),
});

const BUCKET = "attachments";

export const Route = createFileRoute("/api/public/share/document-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Rate limit: 60 downloads de URL assinada por IP / 5 min
        const ip = getClientIp(request);
        const rl = rateLimit(`document-url:${ip}`, 60, 5 * 60_000);
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

        const claims = verifyShareJwt(parsed.data.accessToken);
        if (!claims) return Response.json({ error: "invalid_token" }, { status: 401 });

        const share = await fetchShareById(claims.share_id);
        if (!share) return Response.json({ error: "not_found" }, { status: 404 });
        const status = deriveStatus(share);
        if (status !== "active") {
          return Response.json({ error: status }, { status: 410 });
        }

        const items = await fetchShareItems(share.id);
        const expectedType =
          parsed.data.source === "record" ? "document_record" : "document_child";
        const allowed = items.some(
          (i) => i.item_type === expectedType && i.item_id === parsed.data.documentId,
        );
        if (!allowed) return Response.json({ error: "not_allowed" }, { status: 403 });

        const table =
          parsed.data.source === "record" ? "record_attachments" : "child_attachments";
        const { data: doc } = await (supabaseAdmin.from(table) as any)
          .select("storage_path")
          .eq("id", parsed.data.documentId)
          .maybeSingle();
        if (!doc) return Response.json({ error: "doc_missing" }, { status: 404 });

        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(doc.storage_path, 60);
        if (signErr || !signed?.signedUrl) {
          return Response.json({ error: "sign_failed" }, { status: 500 });
        }

        return Response.json({ url: signed.signedUrl });
      },
    },
  },
});
