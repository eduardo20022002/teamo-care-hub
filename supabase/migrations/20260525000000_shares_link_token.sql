-- Adds link_token column to shares table.
-- link_token stores the raw (unhashed) share token so it can be re-displayed
-- in the UI (copy-link button). Security is maintained because the OTP is still
-- required to access any shared content — the link alone grants nothing.
ALTER TABLE shares ADD COLUMN IF NOT EXISTS link_token TEXT;
