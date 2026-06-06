-- A-03: Substituir tokens de convite em texto claro por SHA-256.
--
-- Contexto: care_invites.token e therapist_invites.token armazenavam o raw token
-- (o mesmo valor enviado no link do e-mail). Se o banco for comprometido, um
-- atacante obtém todos os links de convite válidos e pendentes.
--
-- Solução: armazenar apenas o hash SHA-256 (como já feito em shares.token).
-- O raw token continua sendo enviado no e-mail e nunca fica no banco.
-- Lookup: sha256(raw_token_da_url) → query por token_hash.
--
-- sha256(bytea) é built-in no PostgreSQL 11+ — sem extensão necessária.

-- ─── care_invites ─────────────────────────────────────────────────────────────
ALTER TABLE public.care_invites
  ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.care_invites
  SET token_hash = encode(sha256(token::bytea), 'hex')
  WHERE token_hash IS NULL;

ALTER TABLE public.care_invites
  ALTER COLUMN token_hash SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.care_invites
    ADD CONSTRAINT care_invites_token_hash_unique UNIQUE (token_hash);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

ALTER TABLE public.care_invites
  DROP COLUMN IF EXISTS token;

-- ─── therapist_invites ────────────────────────────────────────────────────────
ALTER TABLE public.therapist_invites
  ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.therapist_invites
  SET token_hash = encode(sha256(token::bytea), 'hex')
  WHERE token_hash IS NULL;

ALTER TABLE public.therapist_invites
  ALTER COLUMN token_hash SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.therapist_invites
    ADD CONSTRAINT therapist_invites_token_hash_unique UNIQUE (token_hash);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

ALTER TABLE public.therapist_invites
  DROP COLUMN IF EXISTS token;

COMMENT ON COLUMN public.care_invites.token_hash IS
  'SHA-256(raw_bearer_token). O raw token é enviado no e-mail e nunca persiste. Lookup: sha256(token_da_url) → esta coluna.';

COMMENT ON COLUMN public.therapist_invites.token_hash IS
  'SHA-256(raw_bearer_token). O raw token é enviado no e-mail e nunca persiste. Lookup: sha256(token_da_url) → esta coluna.';
