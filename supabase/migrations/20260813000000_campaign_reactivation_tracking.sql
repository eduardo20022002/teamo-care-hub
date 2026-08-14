-- ─── Rastreamento de campanhas de reativação (campaign_sends) ────────────────
-- Infra interna para a campanha de e-mail de reativação da base (ago/2026) e
-- futuras campanhas do mesmo tipo. Guarda estado por destinatário: quais touches
-- já saíram, e o sinal de comportamento (reativou de verdade ou não) usado para
-- decidir se a sequência continua, pausa ou para.
--
-- Regra 1 do CLAUDE.md: RLS obrigatório. Sem policies para o cliente — leitura/
-- escrita só via service_role (o mesmo padrão de user_sessions e
-- parent_professional_access). Não é uma tabela de produto, é ferramenta interna.
--
-- Sinal de "reativação" tem dois níveis:
--   fraca  → a pessoa voltou a logar (auth.users.last_sign_in_at avançou)
--   forte  → além de logar, completou a ação-chave do papel dela:
--            pai/mãe conectou um profissional | terapeuta registrou 1 sessão

-- ===========================================================================
-- 1. Tabela campaign_sends
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.campaign_sends (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign                  text NOT NULL,
  email                     text NOT NULL,
  user_id                   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  segmento                  text NOT NULL CHECK (segmento IN ('parent', 'therapist')),

  baseline_last_sign_in_at  timestamptz,   -- login mais recente ANTES da campanha

  touch1_sent_at            timestamptz,
  touch1_resend_id          text,
  touch2_sent_at            timestamptz,
  touch2_resend_id          text,
  touch3_sent_at            timestamptz,
  touch3_resend_id          text,

  reactivated_at            timestamptz,
  reactivation_strength     text CHECK (reactivation_strength IS NULL OR reactivation_strength IN ('weak', 'strong')),

  bounced_at                timestamptz,   -- Resend reportou bounce/complaint
  replied_at                timestamptz,   -- respondeu o e-mail (checado via Gmail)

  stopped_reason            text CHECK (
    stopped_reason IS NULL OR stopped_reason IN ('reactivated', 'bounced', 'replied', 'sequence_complete', 'manual')
  ),
  notes                     text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  UNIQUE (campaign, email)
);

CREATE INDEX IF NOT EXISTS campaign_sends_campaign_idx ON public.campaign_sends(campaign);
CREATE INDEX IF NOT EXISTS campaign_sends_pending_idx
  ON public.campaign_sends(campaign)
  WHERE stopped_reason IS NULL;

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;
-- Sem policies: leitura/escrita só via service_role (supabaseAdmin / CLI --linked).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_sends_set_updated_at ON public.campaign_sends;
CREATE TRIGGER campaign_sends_set_updated_at
  BEFORE UPDATE ON public.campaign_sends
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================================================================
-- 2. campaign_check_reactivation — valida quem voltou (fraca/forte)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.campaign_check_reactivation(p_campaign text)
RETURNS TABLE (email text, reactivation_strength text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    SELECT cs.id, cs.email, cs.user_id, cs.segmento, cs.baseline_last_sign_in_at, cs.touch1_sent_at,
           u.last_sign_in_at AS current_last_sign_in_at
    FROM public.campaign_sends cs
    JOIN auth.users u ON u.id = cs.user_id
    WHERE cs.campaign = p_campaign
      AND cs.reactivated_at IS NULL
      AND cs.stopped_reason IS NULL
      AND u.last_sign_in_at IS NOT NULL
      AND (cs.baseline_last_sign_in_at IS NULL OR u.last_sign_in_at > cs.baseline_last_sign_in_at)
  ),
  avaliados AS (
    SELECT
      c.id, c.email, c.current_last_sign_in_at,
      CASE
        WHEN c.segmento = 'parent' AND EXISTS (
          SELECT 1 FROM public.therapist_parent_access tpa
          WHERE tpa.parent_id = c.user_id AND tpa.status = 'active'
            AND tpa.created_at > COALESCE(c.touch1_sent_at, c.baseline_last_sign_in_at, c.current_last_sign_in_at - interval '30 days')
          UNION ALL
          SELECT 1 FROM public.parent_professional_access ppa
          WHERE ppa.parent_id = c.user_id AND ppa.status = 'active'
            AND ppa.created_at > COALESCE(c.touch1_sent_at, c.baseline_last_sign_in_at, c.current_last_sign_in_at - interval '30 days')
        ) THEN 'strong'
        WHEN c.segmento = 'therapist' AND EXISTS (
          SELECT 1 FROM public.session_records sr
          WHERE sr.therapist_id = c.user_id
            AND sr.created_at > COALESCE(c.touch1_sent_at, c.baseline_last_sign_in_at, c.current_last_sign_in_at - interval '30 days')
        ) THEN 'strong'
        ELSE 'weak'
      END AS forca
    FROM candidatos c
  )
  UPDATE public.campaign_sends cs
  SET reactivated_at = a.current_last_sign_in_at,
      reactivation_strength = a.forca,
      stopped_reason = 'reactivated'
  FROM avaliados a
  WHERE cs.id = a.id
  RETURNING cs.email, cs.reactivation_strength;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_check_reactivation(text) FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- 3. campaign_record_send — registra que um touch foi enviado
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.campaign_record_send(
  p_campaign text,
  p_email text,
  p_touch smallint,
  p_resend_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_touch NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'p_touch precisa ser 1, 2 ou 3';
  END IF;

  UPDATE public.campaign_sends
  SET touch1_sent_at   = CASE WHEN p_touch = 1 THEN now() ELSE touch1_sent_at END,
      touch1_resend_id = CASE WHEN p_touch = 1 THEN p_resend_id ELSE touch1_resend_id END,
      touch2_sent_at   = CASE WHEN p_touch = 2 THEN now() ELSE touch2_sent_at END,
      touch2_resend_id = CASE WHEN p_touch = 2 THEN p_resend_id ELSE touch2_resend_id END,
      touch3_sent_at   = CASE WHEN p_touch = 3 THEN now() ELSE touch3_sent_at END,
      touch3_resend_id = CASE WHEN p_touch = 3 THEN p_resend_id ELSE touch3_resend_id END,
      stopped_reason   = CASE WHEN p_touch = 3 THEN 'sequence_complete' ELSE stopped_reason END
  WHERE campaign = p_campaign AND email = p_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_record_send(text, text, smallint, text) FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- 4. campaign_mark_stopped — registra sinal externo (bounce, resposta, manual)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.campaign_mark_stopped(
  p_campaign text,
  p_email text,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_reason NOT IN ('bounced', 'replied', 'manual') THEN
    RAISE EXCEPTION 'p_reason precisa ser bounced, replied ou manual';
  END IF;

  UPDATE public.campaign_sends
  SET stopped_reason = p_reason,
      bounced_at = CASE WHEN p_reason = 'bounced' THEN now() ELSE bounced_at END,
      replied_at = CASE WHEN p_reason = 'replied' THEN now() ELSE replied_at END,
      notes = COALESCE(p_notes, notes)
  WHERE campaign = p_campaign AND email = p_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_mark_stopped(text, text, text, text) FROM PUBLIC, authenticated, anon;

-- ===========================================================================
-- 5. campaign_due_sends — view: quem está devendo qual touch hoje
-- ===========================================================================

CREATE OR REPLACE VIEW public.campaign_due_sends AS
SELECT
  cs.*,
  CASE
    WHEN cs.stopped_reason IS NOT NULL THEN NULL
    WHEN cs.touch1_sent_at IS NULL THEN 'touch1'
    WHEN cs.touch2_sent_at IS NULL AND now() >= cs.touch1_sent_at + interval '4 days' THEN 'touch2'
    WHEN cs.touch3_sent_at IS NULL AND cs.touch2_sent_at IS NOT NULL
      AND now() >= cs.touch2_sent_at + interval '5 days' THEN 'touch3'
    ELSE NULL
  END AS next_touch
FROM public.campaign_sends cs;

REVOKE ALL ON public.campaign_due_sends FROM PUBLIC, authenticated, anon;
