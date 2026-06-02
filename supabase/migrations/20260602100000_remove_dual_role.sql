-- ─────────────────────────────────────────────────────────────────────────────
-- Remove suporte a dual-role: 1 e-mail = 1 tipo de perfil, para sempre.
-- Zera secondary_role de contas existentes e adiciona constraint NULL.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Zera qualquer secondary_role existente
UPDATE public.profiles
SET secondary_role = NULL
WHERE secondary_role IS NOT NULL;

-- 2. Remove o constraint CHECK antigo que permitia 'parent' | 'therapist'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_secondary_role_check;

-- 3. Garante que secondary_role NUNCA será preenchido novamente
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_secondary_role_null
  CHECK (secondary_role IS NULL);
