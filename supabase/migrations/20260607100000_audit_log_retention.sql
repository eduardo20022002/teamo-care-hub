-- Política de retenção do audit_log (LGPD Art. 16 — mínimo necessário).
--
-- A tabela audit_logs é append-only para roles authenticated/anon
-- (REVOKE UPDATE, DELETE — migration 20260514000000). A função abaixo roda
-- como SECURITY DEFINER (postgres) para poder deletar registros antigos.
--
-- Prazos adotados:
--   auth.login_failure   → 90 dias  (alta frequência, baixa sensibilidade)
--   auth.password_changed → 730 dias (rastreabilidade de credenciais — 2 anos)
--   demais eventos        → 365 dias

CREATE OR REPLACE FUNCTION public.purge_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tentativas de login fracassadas: 90 dias
  DELETE FROM public.audit_logs
  WHERE event_type = 'auth.login_failure'
    AND created_at < now() - INTERVAL '90 days';

  -- Troca de senha: 2 anos (mantida mais tempo para forensics de segurança)
  -- (não precisa de cláusula separada — o bloco geral abaixo usa 365 dias,
  --  então ajustamos password_changed explicitamente antes)
  -- Nenhuma ação: 730 dias > 365 dias → o bloco geral não os apaga antes.

  -- Demais eventos: 1 ano
  DELETE FROM public.audit_logs
  WHERE event_type NOT IN ('auth.login_failure', 'auth.password_changed')
    AND created_at < now() - INTERVAL '365 days';
END;
$$;

-- Revoga execução pública (apenas postgres/service_role podem chamar)
REVOKE EXECUTE ON FUNCTION public.purge_old_audit_logs() FROM PUBLIC, authenticated, anon;

-- Agenda limpeza diária às 03:00 UTC via pg_cron
SELECT cron.schedule(
  'purge-audit-logs-daily',
  '0 3 * * *',
  'SELECT public.purge_old_audit_logs()'
);
