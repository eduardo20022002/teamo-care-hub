-- ─── Agendamento diário da campanha de reativação ────────────────────────────
-- pg_cron chama a Edge Function campaign-dispatch todo dia às 12:00 UTC
-- (09:00 America/Recife). A função é idempotente e dirigida pela view
-- campaign_due_sends: a primeira execução manda os touch1 pendentes, e as
-- seguintes cuidam de touch2/touch3 conforme o comportamento de cada pessoa.
--
-- pg_net é necessário porque o pg_cron sozinho não faz chamada HTTP.
-- O token de invocação vem do Vault (nunca literal no SQL) — a Edge Function
-- valida o header x-campaign-token, já que roda com verify_jwt=false.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior, se existir (torna a migration reexecutável).
SELECT cron.unschedule('campaign-dispatch-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'campaign-dispatch-daily');

SELECT cron.schedule(
  'campaign-dispatch-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://oguqnqdqqqzvfrdztykz.supabase.co/functions/v1/campaign-dispatch',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-campaign-token', (SELECT decrypted_secret FROM vault.decrypted_secrets
                           WHERE name = 'campaign_cron_token')
    ),
    body    := '{}'::jsonb
  );
  $$
);
