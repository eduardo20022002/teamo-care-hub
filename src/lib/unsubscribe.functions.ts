// ─── Descadastro de campanha (público, sem auth) ─────────────────────────────
// token é um UUID opaco por linha de campaign_sends — sem HMAC, sem segredo
// compartilhado com a Edge Function. Não precisa de rate limit: o token já é
// o segredo (só quem recebeu o e-mail o conhece).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const unsubscribeServer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { data: found, error } = await (supabaseAdmin as any).rpc(
      "campaign_unsubscribe",
      { p_token: data.token },
    );
    // Token inválido/já usado responde ok=true de qualquer forma: do ponto de
    // vista de quem clicou, "já não recebe mais" é sempre verdade.
    return { ok: !error && (found === true || found === false) };
  });
