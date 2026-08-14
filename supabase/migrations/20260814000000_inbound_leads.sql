-- ─── Captação inbound: formulário público de interesse ───────────────────────
-- Pessoas que preenchem o formulário entram no MESMO motor de ciclo de vida das
-- campanhas existentes (campaign_sends), como stage='lead'. Assim o follow-up,
-- a detecção de "criou conta" e as salvaguardas de cadência já valem para elas
-- sem código novo — muda só a porta de entrada.
--
-- Mudança de arquitetura: LEAD_SEND_MODE era uma flag GLOBAL na Edge Function que
-- bloqueava todo envio a leads. Isso está certo para a lista fria (sem
-- consentimento, risco à reputação do domínio), mas errado para quem preencheu
-- um formulário — essa pessoa pediu contato. A flag vira a coluna `auto_send`,
-- decidida por origem: lista fria = false, formulário = true.

ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS lead_name    text,
  ADD COLUMN IF NOT EXISTS lead_source  text,
  ADD COLUMN IF NOT EXISTS consent_at   timestamptz,   -- prova de consentimento (LGPD)
  ADD COLUMN IF NOT EXISTS lead_data    jsonb,
  ADD COLUMN IF NOT EXISTS auto_send    boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaign_sends.consent_at IS
  'Quando a pessoa consentiu em receber contato (preenchimento do formulário). NULL = sem consentimento explícito (ex.: lista fria) — nesses casos auto_send deve ser false.';
COMMENT ON COLUMN public.campaign_sends.auto_send IS
  'Se true, a Edge Function pode enviar e-mail de estágio lead automaticamente. Só deve ser true quando houve consentimento (consent_at preenchido).';

-- Campanhas já existentes: a lista fria segue sem envio automático; as pessoas que
-- já têm conta não são afetadas (auto_send só é consultado no estágio 'lead').
UPDATE public.campaign_sends SET auto_send = false WHERE campaign = 'aquisicao-lista-2026-08';
UPDATE public.campaign_sends SET auto_send = true  WHERE campaign = 'reativacao-base-2026-08';

-- Índice para o painel: leads inbound por data de chegada.
CREATE INDEX IF NOT EXISTS campaign_sends_source_idx
  ON public.campaign_sends(lead_source, created_at DESC)
  WHERE lead_source IS NOT NULL;

-- ===========================================================================
-- View: expõe auto_send para a Edge Function decidir o envio
-- ===========================================================================

-- DROP antes de recriar: as colunas novas em campaign_sends deslocam o `cs.*`, e
-- CREATE OR REPLACE VIEW não aceita mudança de posição/nome de coluna.
DROP VIEW IF EXISTS public.campaign_lifecycle_due;

CREATE VIEW public.campaign_lifecycle_due AS
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
       WHEN cs.last_touch_at IS NOT NULL AND now() < cs.last_touch_at + interval '3 days'
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
FROM public.campaign_sends cs;

REVOKE ALL ON public.campaign_lifecycle_due FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- campaign_capture_lead — entrada única do formulário público
-- ===========================================================================
-- SECURITY DEFINER porque a tabela tem RLS sem policies (só service-role). A
-- ServerFn chama via supabaseAdmin; esta função concentra a regra para que a
-- captação não precise conhecer o formato interno de campaign_sends.
--
-- Reenvio do mesmo e-mail não duplica: atualiza o registro existente. Isso evita
-- que alguém preenchendo duas vezes vire duas linhas e receba e-mail dobrado.

CREATE OR REPLACE FUNCTION public.campaign_capture_lead(
  p_email    text,
  p_name     text,
  p_segmento text,
  p_source   text DEFAULT 'form-interesse',
  p_data     jsonb DEFAULT NULL
)
RETURNS TABLE (id uuid, ja_existia boolean, ja_tem_conta boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign  text := 'inbound-' || to_char(now(), 'YYYY-MM');
  v_user_id   uuid;
  v_id        uuid;
  v_existia   boolean;
BEGIN
  IF p_segmento NOT IN ('parent', 'therapist', 'lead') THEN
    RAISE EXCEPTION 'segmento inválido: %', p_segmento;
  END IF;

  -- A pessoa já pode ter conta (ex.: veio pelo formulário mas já se cadastrou).
  SELECT u.id INTO v_user_id FROM auth.users u WHERE lower(u.email) = lower(p_email);

  SELECT cs.id INTO v_id FROM public.campaign_sends cs
   WHERE cs.campaign = v_campaign AND lower(cs.email) = lower(p_email);
  v_existia := v_id IS NOT NULL;

  IF v_existia THEN
    UPDATE public.campaign_sends
       SET lead_name  = COALESCE(p_name, lead_name),
           lead_data  = COALESCE(p_data, lead_data),
           consent_at = now()
     WHERE campaign_sends.id = v_id;
  ELSE
    INSERT INTO public.campaign_sends (
      campaign, email, user_id, segmento, lead_name, lead_source,
      consent_at, lead_data, auto_send, stage, stage_entered_at,
      baseline_last_sign_in_at
    ) VALUES (
      v_campaign, lower(p_email), v_user_id,
      CASE WHEN v_user_id IS NOT NULL AND p_segmento = 'lead' THEN 'parent' ELSE p_segmento END,
      p_name, p_source, now(), p_data,
      true,   -- consentiu ao preencher o formulário
      CASE WHEN v_user_id IS NULL THEN 'lead' ELSE 'signed_up' END,
      now(),
      NULL
    )
    RETURNING campaign_sends.id INTO v_id;
  END IF;

  RETURN QUERY SELECT v_id, v_existia, v_user_id IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_capture_lead(text, text, text, text, jsonb)
  FROM PUBLIC, authenticated, anon;
