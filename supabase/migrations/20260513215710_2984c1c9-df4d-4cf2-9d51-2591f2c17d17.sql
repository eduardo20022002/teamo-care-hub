-- 1. Tighten anon audit_logs insert: only allow specific safe event types and bounded metadata
DROP POLICY IF EXISTS "audit_logs_insert_anon_failure" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_anon_failure"
ON public.audit_logs
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND event_type IN ('auth.login_failure', 'auth.signup_success')
  AND char_length(metadata::text) <= 1000
);

-- 2. Hide sensitive share columns from clients (RLS still applies for the rest)
REVOKE SELECT (otp_hash, otp_expires_at, otp_attempts) ON public.shares FROM anon, authenticated;