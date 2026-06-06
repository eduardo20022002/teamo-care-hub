// ServerFns relacionadas a autenticação (complemento ao auth.service.ts do cliente).
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit, getClientIp } from "@/server/rate-limit";

// ─── checkEmailTypeServer — público (sem auth) ────────────────────────────────
// Retorna o tipo de perfil de um e-mail já cadastrado.
// Rate limit agressivo (10 req / 5 min) para evitar enumeração de e-mails.
// Retorna apenas user_type — nunca outros dados do perfil.

export const checkEmailTypeServer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`check-email-type:${ip}`, 10, 5 * 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("user_type")
      .eq("email", data.email.toLowerCase().trim())
      .maybeSingle();

    if (!profile) {
      return { found: false as const };
    }

    return {
      found: true as const,
      userType: (profile as { user_type: "parent" | "therapist" }).user_type,
    };
  });

// ─── completeOAuthProfileServer — conclusão de perfil pós-Google OAuth ─────────
// Salva o aceite de termos (LGPD) e o display_name no perfil do usuário.
// Usa supabaseAdmin para bypassar a proteção de user_type no trigger.
// Idempotente: se os termos já foram aceitos, retorna ok imediatamente.

export const completeOAuthProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      displayName: z.string().min(2).max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("terms_accepted_at")
      .eq("id", userId)
      .maybeSingle();

    if ((existing as any)?.terms_accepted_at) {
      return { ok: true as const };
    }

    const now = new Date().toISOString();

    await supabaseAdmin
      .from("profiles")
      .update({ terms_accepted_at: now })
      .eq("id", userId);

    if (data.displayName?.trim()) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: {
          display_name: data.displayName.trim(),
          terms_accepted: true,
        },
      });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { terms_accepted: true },
      });
    }

    return { ok: true as const };
  });
