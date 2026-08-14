-- ─── Ciclo de vida por comportamento (estágios) ──────────────────────────────
-- Evolui a campanha de "sequência linear de 3 toques" para uma MÁQUINA DE ESTADOS.
-- Motivo: agora existem pessoas que sequer têm conta (leads da lista de aquisição),
-- e elas atravessam fases distintas — cada uma com sua régua e sua mensagem.
--
-- Estágios (recalculados a cada execução, nunca congelados):
--   lead       → não existe conta com esse e-mail
--   signed_up  → conta existe, mas nunca logou ou e-mail não confirmado
--   explorer   → logou, mas nunca fez a ação-chave do papel
--   dormant    → fez a ação-chave e sumiu (>30 dias)
--   active     → logou nos últimos 7 dias — NÃO recebe e-mail (respiro)
--
-- Ação-chave: pai/mãe = cadastrou ao menos uma criança | terapeuta = registrou sessão.
--
-- COMPATIBILIDADE: a view campaign_due_sends (modelo antigo) fica INTACTA, porque a
-- Edge Function em produção depende dela e dispara amanhã 9h. O modelo novo vive em
-- campaign_lifecycle_due. A troca só acontece quando a função nova for deployada e
-- validada — assim não há janela em que o cron chame um contrato que mudou.

-- ===========================================================================
-- 1. Colunas de estado do ciclo de vida
-- ===========================================================================

ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS stage             text,
  ADD COLUMN IF NOT EXISTS stage_entered_at  timestamptz,
  ADD COLUMN IF NOT EXISTS touches_in_stage  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_touch_at     timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS lifetime_touches  integer NOT NULL DEFAULT 0;

-- 'lead' é o segmento de quem ainda não tem conta (papel desconhecido até o cadastro).
ALTER TABLE public.campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_segmento_check;
ALTER TABLE public.campaign_sends
  ADD CONSTRAINT campaign_sends_segmento_check
  CHECK (segmento IN ('parent', 'therapist', 'lead'));

ALTER TABLE public.campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_stage_check;
ALTER TABLE public.campaign_sends
  ADD CONSTRAINT campaign_sends_stage_check
  CHECK (stage IS NULL OR stage IN ('lead', 'signed_up', 'explorer', 'dormant', 'active'));

-- ===========================================================================
-- 2. Estágio atual de uma linha — fonte única da verdade
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.campaign_current_stage(p_send_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN cs.user_id IS NULL THEN 'lead'
    WHEN u.last_sign_in_at IS NULL OR u.email_confirmed_at IS NULL THEN 'signed_up'
    WHEN u.last_sign_in_at > now() - interval '7 days' THEN 'active'
    WHEN NOT (
      CASE WHEN cs.segmento = 'therapist'
        THEN EXISTS (SELECT 1 FROM public.session_records sr WHERE sr.therapist_id = cs.user_id)
        ELSE EXISTS (SELECT 1 FROM public.children c WHERE c.user_id = cs.user_id)
      END
    ) THEN 'explorer'
    WHEN u.last_sign_in_at < now() - interval '30 days' THEN 'dormant'
    ELSE 'active'
  END
  FROM public.campaign_sends cs
  LEFT JOIN auth.users u ON u.id = cs.user_id
  WHERE cs.id = p_send_id;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_current_stage(uuid) FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- 3. campaign_sync_stages — o coração: vincula conversões e move estágios
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.campaign_sync_stages(p_campaign text)
RETURNS TABLE (email text, stage_anterior text, stage_novo text, converteu boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- (a) Lead virou conta? Vincula. É isto que responde "a pessoa se cadastrou?".
  --     O match é por e-mail case-insensitive: a pessoa pode se cadastrar com
  --     grafia diferente da que está na lista.
  UPDATE public.campaign_sends cs
  SET user_id = u.id,
      converted_at = COALESCE(cs.converted_at, now()),
      -- Ao converter, o papel real passa a valer no lugar de 'lead'.
      segmento = CASE
        WHEN cs.segmento = 'lead' THEN
          CASE WHEN p.user_type = 'therapist' THEN 'therapist' ELSE 'parent' END
        ELSE cs.segmento
      END
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE cs.campaign = p_campaign
    AND cs.user_id IS NULL
    AND lower(u.email) = lower(cs.email);

  -- (b) Recalcula estágio e detecta transição.
  RETURN QUERY
  WITH calculado AS (
    SELECT cs.id, cs.email, cs.stage AS anterior,
           public.campaign_current_stage(cs.id) AS novo,
           cs.converted_at IS NOT NULL AND cs.stage = 'lead' AS converteu
    FROM public.campaign_sends cs
    WHERE cs.campaign = p_campaign
      AND cs.stopped_reason IS NULL
  ),
  mudou AS (
    SELECT * FROM calculado WHERE anterior IS DISTINCT FROM novo
  )
  UPDATE public.campaign_sends cs
  SET stage = m.novo,
      stage_entered_at = now(),
      -- Contador zera a cada estágio novo: a régua é por fase, não acumulada.
      touches_in_stage = 0
  FROM mudou m
  WHERE cs.id = m.id
  RETURNING cs.email, m.anterior, m.novo, m.converteu;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_sync_stages(text) FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- 4. campaign_record_touch — registra envio incrementando os contadores
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.campaign_record_touch(
  p_campaign text,
  p_email text,
  p_resend_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaign_sends
  SET touches_in_stage = touches_in_stage + 1,
      lifetime_touches = lifetime_touches + 1,
      last_touch_at    = now(),
      -- Mantém as colunas antigas preenchidas enquanto o histórico dos 13 importar.
      touch1_sent_at   = CASE WHEN touch1_sent_at IS NULL THEN now() ELSE touch1_sent_at END,
      touch1_resend_id = CASE WHEN touch1_resend_id IS NULL THEN p_resend_id ELSE touch1_resend_id END
  WHERE campaign = p_campaign AND email = p_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_record_touch(text, text, text) FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- 5. View do modelo novo — quem está devendo toque, e qual
-- ===========================================================================
--
-- Régua por estágio (dias até o PRÓXIMO toque, contados do último enviado):
--   lead       3 toques → 5d, 7d
--   signed_up  2 toques → 3d
--   explorer   2 toques → 5d
--   dormant    3 toques → 4d, 5d
--   active     0 toques
--
-- Salvaguardas: cooldown global de 3 dias entre quaisquer dois e-mails (uma troca
-- rápida de estágio não pode gerar e-mail em dias seguidos) e teto de 8 no total.

CREATE OR REPLACE VIEW public.campaign_lifecycle_due AS
SELECT
  cs.*,
  CASE
    WHEN cs.segmento = 'lead' THEN 'lead'
    WHEN cs.segmento = 'therapist' THEN 'therapist'
    ELSE 'parent'
  END AS variant,
  CASE WHEN cs.stopped_reason IS NOT NULL THEN false
       WHEN cs.lifetime_touches >= 8 THEN false
       WHEN cs.stage IS NULL OR cs.stage = 'active' THEN false
       WHEN cs.touches_in_stage >= CASE cs.stage
              WHEN 'lead' THEN 3 WHEN 'signed_up' THEN 2
              WHEN 'explorer' THEN 2 WHEN 'dormant' THEN 3 ELSE 0 END
         THEN false
       -- Cooldown global: nunca dois e-mails a menos de 3 dias.
       WHEN cs.last_touch_at IS NOT NULL AND now() < cs.last_touch_at + interval '3 days'
         THEN false
       -- Intervalo específico da régua do estágio.
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
FROM public.campaign_sends cs;

REVOKE ALL ON public.campaign_lifecycle_due FROM PUBLIC, authenticated, anon;
