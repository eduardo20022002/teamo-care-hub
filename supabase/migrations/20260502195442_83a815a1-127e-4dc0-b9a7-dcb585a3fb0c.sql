-- Tabela shares
CREATE TABLE public.shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  professional_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  otp_hash TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_user_created ON public.shares(user_id, created_at DESC);
CREATE INDEX idx_shares_token ON public.shares(token);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY shares_select_own ON public.shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY shares_insert_own ON public.shares
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY shares_update_own ON public.shares
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY shares_delete_own ON public.shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER shares_set_updated_at
  BEFORE UPDATE ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validação de prazos via trigger (não CHECK)
CREATE OR REPLACE FUNCTION public.validate_share_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at <= NEW.created_at THEN
    RAISE EXCEPTION 'expires_at must be after created_at';
  END IF;
  IF NEW.expires_at > NEW.created_at + interval '48 hours' THEN
    RAISE EXCEPTION 'expires_at cannot exceed 48 hours after created_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shares_validate_expiry
  BEFORE INSERT OR UPDATE ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.validate_share_expiry();

-- Tabela share_items
CREATE TABLE public.share_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_share_items_share ON public.share_items(share_id);
CREATE INDEX idx_share_items_user ON public.share_items(user_id);

ALTER TABLE public.share_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_items_select_own ON public.share_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY share_items_insert_own ON public.share_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY share_items_delete_own ON public.share_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cascade manual: ao deletar share, apagar share_items
CREATE OR REPLACE FUNCTION public.cascade_delete_share_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.share_items WHERE share_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER shares_cascade_delete_items
  BEFORE DELETE ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_share_items();