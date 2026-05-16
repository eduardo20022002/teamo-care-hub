-- Enforce MIME type and file size restrictions on the attachments bucket
-- at the Supabase Storage layer (server-enforced, cannot be bypassed by the client).
--
-- Previously the bucket had no allowedMimeTypes or file_size_limit, meaning
-- any file type and any size could be uploaded regardless of client-side validation.
-- An attacker could upload malicious files (HTML, executables) disguised as PDFs.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png'
  ],
  file_size_limit = 10485760  -- 10 MB in bytes
WHERE id = 'attachments';
