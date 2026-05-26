-- Re-adds link_token to allow the parent to re-copy the share URL from the list view.
-- Security trade-off accepted: link_token is stored in plain text. Access to shared
-- content still requires OTP confirmation sent to the professional's registered email,
-- preserving the two-channel (link + email OTP) authentication model.
ALTER TABLE shares ADD COLUMN IF NOT EXISTS link_token TEXT;
