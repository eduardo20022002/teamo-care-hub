-- ─── Corrige o escorregamento de 1 dia em toda a cadência ────────────────────
-- Sintoma observado em produção: o toque 2 dos 7 'dormant' venceria em
-- 18/08 09:00:03, mas o cron roda às 09:00:00 — três segundos antes. Todos foram
-- pulados e só sairiam no dia seguinte. O mesmo já tinha acontecido com o
-- estágio 'signed_up' em 17/08.
--
-- Causa: o cron dispara em ponto, mas os envios completam alguns segundos depois,
-- então last_touch_at fica sempre à frente do horário do cron. Comparar
-- `now() >= last_touch_at + N dias` faz o vencimento cair sempre alguns segundos
-- DEPOIS da execução daquele dia — e a régua inteira escorrega 24h, a cada toque.
--
-- Correção: tolerância de 10 minutos nas comparações de prazo. É folgada o
-- bastante para absorver a duração de qualquer execução (hoje ~15s para 20
-- e-mails) e curta o bastante para não antecipar envio de forma perceptível.

DROP VIEW IF EXISTS public.campaign_lifecycle_due;

CREATE VIEW public.campaign_lifecycle_due AS
WITH por_pessoa AS (
  SELECT lower(email) AS email_norm,
         max(last_touch_at)     AS ultimo_toque_global,
         sum(lifetime_touches)  AS toques_globais
  FROM public.campaign_sends
  GROUP BY lower(email)
)
SELECT
  cs.*,
  CASE
    WHEN cs.segmento = 'lead' THEN 'lead'
    WHEN cs.segmento = 'therapist' THEN 'therapist'
    ELSE 'parent'
  END AS variant,
  CASE WHEN cs.stopped_reason IS NOT NULL THEN false
       WHEN pp.toques_globais >= 8 THEN false
       WHEN cs.stage IS NULL OR cs.stage = 'active' THEN false
       WHEN cs.touches_in_stage >= CASE cs.stage
              WHEN 'lead' THEN 3 WHEN 'signed_up' THEN 2
              WHEN 'explorer' THEN 2 WHEN 'dormant' THEN 3 ELSE 0 END
         THEN false
       -- Cooldown global entre quaisquer dois e-mails da MESMA PESSOA.
       WHEN pp.ultimo_toque_global IS NOT NULL
        AND now() < pp.ultimo_toque_global + interval '3 days' - interval '10 minutes'
         THEN false
       -- Intervalo da régua do estágio, com a mesma tolerância.
       WHEN cs.last_touch_at IS NOT NULL AND cs.touches_in_stage > 0 AND now() <
            cs.last_touch_at + (
              CASE cs.stage
                WHEN 'lead'      THEN (ARRAY[5, 7])[cs.touches_in_stage]
                WHEN 'signed_up' THEN (ARRAY[3])[cs.touches_in_stage]
                WHEN 'explorer'  THEN (ARRAY[5])[cs.touches_in_stage]
                WHEN 'dormant'   THEN (ARRAY[4, 5])[cs.touches_in_stage]
              END || ' days'
            )::interval - interval '10 minutes'
         THEN false
       ELSE true
  END AS is_due,
  cs.touches_in_stage + 1 AS next_touch_index
FROM public.campaign_sends cs
JOIN por_pessoa pp ON pp.email_norm = lower(cs.email);

REVOKE ALL ON public.campaign_lifecycle_due FROM PUBLIC, authenticated, anon;
