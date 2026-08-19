-- ─── Descadastro (link em todo e-mail de campanha) ───────────────────────────
-- Pré-requisito para ligar auto_send na lista fria: sem saída fácil, quem não
-- quer mais receber marca como spam em vez de descadastrar — e isso pesa na
-- reputação do domínio que também envia o transacional do produto.
--
-- Token opaco por linha (não por e-mail): descadastro é por CAMPANHA, não da
-- pessoa inteira no sistema. UUID aleatório é suficiente — não precisa de HMAC
-- nem de segredo compartilhado entre a Edge Function (Deno) e o app (Node).

ALTER TABLE public.campaign_sends
  ADD COLUMN IF NOT EXISTS unsub_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS campaign_sends_unsub_token_idx
  ON public.campaign_sends(unsub_token);

ALTER TABLE public.campaign_sends DROP CONSTRAINT IF EXISTS campaign_sends_stopped_reason_check;
ALTER TABLE public.campaign_sends
  ADD CONSTRAINT campaign_sends_stopped_reason_check
  CHECK (stopped_reason IS NULL OR stopped_reason IN
    ('reactivated', 'bounced', 'replied', 'sequence_complete', 'manual', 'unsubscribed'));

CREATE OR REPLACE FUNCTION public.campaign_unsubscribe(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  UPDATE public.campaign_sends
     SET stopped_reason = 'unsubscribed'
   WHERE unsub_token = p_token
     AND stopped_reason IS NULL;
  GET DIAGNOSTICS v_found = ROW_COUNT;
  RETURN v_found > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_unsubscribe(uuid) FROM PUBLIC, authenticated, anon;
