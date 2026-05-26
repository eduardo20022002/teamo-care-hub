-- Adds optional title to child_attachments so parents can give a human-readable
-- label (e.g. "Laudo neurológico — abril/2026") to documents they upload.
ALTER TABLE child_attachments ADD COLUMN IF NOT EXISTS title TEXT;
