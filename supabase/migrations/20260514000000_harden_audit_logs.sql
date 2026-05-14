-- Hardening: audit_logs devem ser write-only do servidor, nunca do cliente.
-- Mantemos apenas a policy anon para login_failure (necessário pois usuário não está autenticado ainda)
-- e removemos a policy authenticated_own — todas as inserções autenticadas passam a vir do servidor
-- via supabaseAdmin (service role bypassa RLS).

DROP POLICY IF EXISTS "audit_logs_insert_authenticated_own" ON public.audit_logs;

-- Mantém policy anon mas com restrição extra: metadata <= 500 chars e sem chave "password"
DROP POLICY IF EXISTS "audit_logs_insert_anon_failure" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_anon_failure"
ON public.audit_logs
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND event_type = 'auth.login_failure'
  AND char_length(metadata::text) <= 500
  AND NOT (metadata ? 'password')
);

-- Bloqueia UPDATE e DELETE para qualquer role autenticada (audit logs são append-only)
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
