-- Reverts 20260525000000_shares_link_token.sql.
-- link_token was added to allow re-copying share URLs from the list view,
-- but storing the raw token in the database weakens the hash-only design
-- (which protects against URL reconstruction if the DB is compromised).
-- The link is now shown only once at share creation time; the OTP provides
-- the second access factor via a separate email channel.
ALTER TABLE shares DROP COLUMN IF EXISTS link_token;
