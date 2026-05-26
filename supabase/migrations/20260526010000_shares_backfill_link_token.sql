-- Backfill link_token for shares created before the column was added.
-- link_token is a URL-safe identifier used only to build the share URL;
-- actual content access still requires OTP verification via email.
-- Safe to generate with gen_random_uuid() for existing rows.
UPDATE shares
SET link_token = gen_random_uuid()::text
WHERE link_token IS NULL
  AND revoked_at IS NULL;
