-- ─── Ponte entre o modelo antigo e o de estágios ─────────────────────────────
-- Enquanto a Edge Function nova não é deployada, a versão ANTIGA continua em
-- produção e chama campaign_record_send(). Essa função grava touch1_sent_at mas
-- não conhece os contadores do ciclo de vida (touches_in_stage, last_touch_at,
-- lifetime_touches).
--
-- Sem esta ponte: a função antiga envia o toque hoje, os contadores novos ficam
-- zerados, e ao trocar de versão a view campaign_lifecycle_due enxerga "nenhum
-- toque enviado" e dispara um SEGUNDO e-mail para as mesmas pessoas.
--
-- Com a ponte, qualquer uma das duas versões mantém o estado consistente — a
-- ordem do deploy deixa de importar.

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
      stopped_reason   = CASE WHEN p_touch = 3 THEN 'sequence_complete' ELSE stopped_reason END,
      -- Ponte: mantém o estado do ciclo de vida em dia.
      touches_in_stage = touches_in_stage + 1,
      lifetime_touches = lifetime_touches + 1,
      last_touch_at    = now()
  WHERE campaign = p_campaign AND email = p_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_record_send(text, text, smallint, text) FROM PUBLIC, authenticated, anon;
