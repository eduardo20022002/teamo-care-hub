-- ─── Dual-role: usuário pode ser pai E terapeuta na mesma conta ────────────────
-- Adiciona papel secundário opcional. NULL = papel único (maioria dos usuários).
-- O papel ativo na sessão é decidido na UI (sessionStorage), nunca na RLS —
-- toda RLS continua baseada em auth.uid(), independente do papel ativo.

-- ===========================================================================
-- 1. profiles: papel secundário opcional
-- ===========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS secondary_role text
  CHECK (secondary_role IS NULL OR secondary_role IN ('parent', 'therapist'));

-- ===========================================================================
-- 2. Estender prevent_self_admin_elevation: proteger secondary_role também
--    (alterações de papel devem passar por service_role via supabaseAdmin)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_admin_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / migrations / Supabase Dashboard: sem auth context — permite.
  IF auth.uid() IS NULL THEN RETURN new; END IF;

  -- Admin pode mudar qualquer coluna de qualquer perfil.
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) THEN
    RETURN new;
  END IF;

  -- Proteger is_admin contra auto-elevação.
  IF new.is_admin IS DISTINCT FROM old.is_admin THEN
    RAISE EXCEPTION 'Permissão negada: is_admin não pode ser alterado pelo próprio usuário.';
  END IF;

  -- Proteger user_type: usuário não pode mudar seu próprio tipo via cliente.
  IF new.user_type IS DISTINCT FROM old.user_type THEN
    RAISE EXCEPTION 'Permissão negada: user_type não pode ser alterado diretamente.';
  END IF;

  -- Proteger secondary_role: papéis só são concedidos via service_role.
  IF new.secondary_role IS DISTINCT FROM old.secondary_role THEN
    RAISE EXCEPTION 'Permissão negada: secondary_role não pode ser alterado diretamente.';
  END IF;

  RETURN new;
END;
$$;
