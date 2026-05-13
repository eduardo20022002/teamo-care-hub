-- Allow shares up to ~3 months (93 days) instead of 48 hours
CREATE OR REPLACE FUNCTION public.validate_share_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at must be after created_at';
  END IF;
  IF NEW.expires_at > NEW.created_at + interval '93 days' THEN
    RAISE EXCEPTION 'expires_at cannot exceed 93 days after created_at';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.shares
  ADD COLUMN IF NOT EXISTS renewals_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_renewed_at timestamp with time zone;