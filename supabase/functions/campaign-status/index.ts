// Edge Function · campaign-status
//
// Endpoint SOMENTE LEITURA, público, sem token. Existe para que uma rotina de
// monitoramento externa (agente agendado, dashboard) possa checar a saúde das
// campanhas sem precisar do CAMPAIGN_CRON_TOKEN — aquele token dispara e-mail e
// descadastra gente; não deve circular fora do disparo real.
//
// Só devolve agregados (contagens), nunca e-mail ou nome individual — não expõe
// dado pessoal, então não há problema em deixar público.
//
// Deploy:
//   supabase functions deploy campaign-status --project-ref oguqnqdqqqzvfrdztykz

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: porCampanha, error: e1 } = await supabase
    .from("campaign_sends")
    .select("campaign, stage, stopped_reason");
  if (e1) return Response.json({ ok: false, error: e1.message }, { status: 500 });

  const resumo: Record<string, any> = {};
  for (const row of porCampanha ?? []) {
    const c = (resumo[row.campaign] ??= {
      pessoas: 0, reativados: 0, descadastrados: 0, ativos_na_regua: 0,
    });
    c.pessoas++;
    if (row.stopped_reason === "reactivated") c.reativados++;
    else if (row.stopped_reason === "unsubscribed") c.descadastrados++;
    else if (!row.stopped_reason) c.ativos_na_regua++;
  }

  // O schema `cron` não é exposto via PostgREST — usamos o envio mais recente
  // registrado como proxy de "o motor rodou e conseguiu mandar algo".
  const { data: ultimoEnvio } = await supabase
    .from("campaign_sends")
    .select("last_touch_at")
    .not("last_touch_at", "is", null)
    .order("last_touch_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: contasNovas } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

  return Response.json({
    ok: true,
    checked_at: new Date().toISOString(),
    campanhas: resumo,
    ultimo_envio_registrado: ultimoEnvio?.last_touch_at ?? null,
    contas_novas_7d: contasNovas ?? 0,
  });
});
