-- ─── Cooldown e teto passam a valer POR PESSOA, não por campanha ─────────────
-- Bug encontrado ao ligar a captação inbound: uma mesma pessoa pode existir em
-- mais de uma campanha ao mesmo tempo (ex.: já estava na reativação e depois
-- preencheu o formulário público). O cooldown olhava só a própria linha, então
-- ela receberia um e-mail de cada campanha no mesmo dia.
--
-- Correção: cooldown de 3 dias e teto de 8 e-mails consideram TODAS as linhas
-- daquele e-mail. A pessoa é a unidade de fadiga, não o registro de campanha.

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
       -- Teto de fadiga somando todas as campanhas da pessoa.
       WHEN pp.toques_globais >= 8 THEN false
       WHEN cs.stage IS NULL OR cs.stage = 'active' THEN false
       WHEN cs.touches_in_stage >= CASE cs.stage
              WHEN 'lead' THEN 3 WHEN 'signed_up' THEN 2
              WHEN 'explorer' THEN 2 WHEN 'dormant' THEN 3 ELSE 0 END
         THEN false
       -- Cooldown global de 3 dias, olhando qualquer e-mail já enviado à pessoa.
       WHEN pp.ultimo_toque_global IS NOT NULL
        AND now() < pp.ultimo_toque_global + interval '3 days'
         THEN false
       WHEN cs.last_touch_at IS NOT NULL AND cs.touches_in_stage > 0 AND now() <
            cs.last_touch_at + (
              CASE cs.stage
                WHEN 'lead'      THEN (ARRAY[5, 7])[cs.touches_in_stage]
                WHEN 'signed_up' THEN (ARRAY[3])[cs.touches_in_stage]
                WHEN 'explorer'  THEN (ARRAY[5])[cs.touches_in_stage]
                WHEN 'dormant'   THEN (ARRAY[4, 5])[cs.touches_in_stage]
              END || ' days'
            )::interval
         THEN false
       ELSE true
  END AS is_due,
  cs.touches_in_stage + 1 AS next_touch_index
FROM public.campaign_sends cs
JOIN por_pessoa pp ON pp.email_norm = lower(cs.email);

REVOKE ALL ON public.campaign_lifecycle_due FROM PUBLIC, authenticated, anon;
