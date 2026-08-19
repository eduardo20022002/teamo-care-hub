-- ─── Corrige tipo em campaign_unsubscribe ─────────────────────────────────────
-- GET DIAGNOSTICS ... = ROW_COUNT devolve integer, mas a variável estava
-- declarada boolean. Bug pego no teste manual antes de qualquer envio real:
-- "operator does not exist: boolean > integer".

CREATE OR REPLACE FUNCTION public.campaign_unsubscribe(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.campaign_sends
     SET stopped_reason = 'unsubscribed'
   WHERE unsub_token = p_token
     AND stopped_reason IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.campaign_unsubscribe(uuid) FROM PUBLIC, authenticated, anon;
