// ServerFns de rastreamento de sessão (painel admin de atividade de acesso).
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
//
// Ciclo de vida: startSession (login) → heartbeatSession (a cada ~3 min) →
// endSession (logout/idle). A duração sai de coalesce(ended_at, last_seen_at) - started_at,
// então fechar o navegador sem logout ainda dá uma duração razoável via last_seen_at.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp } from "@/server/rate-limit";
import { assertAdmin, fetchLoginActivityData, fetchAccessLog } from "@/server/analytics.server";

const sessionIdSchema = z.object({ sessionId: z.string().min(1).max(200) });

// ─── startSessionServer — cria/renova a linha de sessão no login ──────────────

export const startSessionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sessionIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const request = getRequest();
    const ip = request ? getClientIp(request) : null;
    const userAgent = request ? (request.headers.get("user-agent") ?? "").slice(0, 400) : null;
    const now = new Date().toISOString();

    // Upsert por (session_id, user_id): reload reusa a mesma linha em vez de duplicar.
    // started_at só é definido na criação (DEFAULT now()); aqui atualizamos sinais de vida.
    const { error } = await (supabaseAdmin as any)
      .from("user_sessions")
      .upsert(
        {
          session_id:   data.sessionId,
          user_id:      userId,
          last_seen_at: now,
          ip,
          user_agent:   userAgent,
        },
        { onConflict: "session_id,user_id" },
      );
    if (error) return { ok: false as const };
    return { ok: true as const };
  });

// ─── heartbeatSessionServer — marca "visto por último" ────────────────────────

export const heartbeatSessionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sessionIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await (supabaseAdmin as any)
      .from("user_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .is("ended_at", null);
    return { ok: true as const };
  });

// ─── endSessionServer — encerra a sessão (logout/idle) ────────────────────────

const endSessionSchema = z.object({
  sessionId: z.string().min(1).max(200),
  reason: z.enum(["logout", "idle"]),
});

export const endSessionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => endSessionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const now = new Date().toISOString();
    await (supabaseAdmin as any)
      .from("user_sessions")
      .update({ ended_at: now, end_reason: data.reason, last_seen_at: now })
      .eq("session_id", data.sessionId)
      .eq("user_id", userId)
      .is("ended_at", null);
    return { ok: true as const };
  });

// ─── getLoginActivityServer — leitura admin para o painel ─────────────────────

export const getLoginActivityServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context as any).userId);
    return fetchLoginActivityData();
  });

// ─── getAccessLogServer — log COMPLETO de acessos (paginado, sem limite de tempo) ─
export const getAccessLogServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context as any).userId);
    return fetchAccessLog({ limit: data.limit, offset: data.offset });
  });
