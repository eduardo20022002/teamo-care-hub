-- Security hardening: multiple fixes found during audit.

-- ─────────────────────────────────────────────────────────────────
-- 1. AUDIT LOGS — anon policy: remove auth.signup_success
--    signup_success is triggered after the user is authenticated;
--    allowing anon to insert it opens log-spam and misinformation.
-- ─────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────
-- 2. FOREIGN KEY CONSTRAINTS — missing user_id → auth.users refs
--    Without FK, RLS still filters by auth.uid() but orphaned rows
--    accumulate silently after user deletion.
-- ─────────────────────────────────────────────────────────────────

-- professionals
ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- attendance_records
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_records_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- record_attachments
ALTER TABLE public.record_attachments
  ADD CONSTRAINT record_attachments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- child_attachments
ALTER TABLE public.child_attachments
  ADD CONSTRAINT child_attachments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- shares
ALTER TABLE public.shares
  ADD CONSTRAINT shares_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- share_items: add FK to shares + user_id FK
ALTER TABLE public.share_items
  ADD CONSTRAINT share_items_share_id_fkey
    FOREIGN KEY (share_id) REFERENCES public.shares(id) ON DELETE CASCADE,
  ADD CONSTRAINT share_items_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- 3. SHARE TOKEN — document that the column stores SHA-256 hash
--    The raw bearer token is returned to the client once and never
--    stored. If the DB is dumped, active tokens remain safe.
-- ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.shares.token IS
  'SHA-256(raw_bearer_token). The raw token is returned to the client on creation and never persisted. Lookup: SHA-256(url_token) → query this column.';

-- Truncate existing test shares so no plain-text tokens remain.
-- In production, run a data migration instead.
TRUNCATE public.share_items, public.shares RESTART IDENTITY CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- 4. OTP HASH — document that column stores HMAC-SHA256
--    Previously used plain SHA-256, which is rainbow-table-able
--    for 6-digit values (1M possibilities). Now uses HMAC-SHA256
--    keyed with OTP_HMAC_SECRET server env var.
-- ─────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.shares.otp_hash IS
  'HMAC-SHA256(otp, OTP_HMAC_SECRET). Plain SHA-256 is NOT used — 6-digit OTPs are precomputable across all 1M values.';
