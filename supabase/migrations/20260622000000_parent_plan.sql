-- ─── Freemium do Responsável (parent_plan) ───────────────────────────────────
-- Estende o modelo de assinatura por escopo (ver 20260620000000_subscriptions.sql)
-- para o papel de PAI/RESPONSÁVEL. A tabela `subscriptions` (scope='parent') é a
-- fonte de verdade; aqui adicionamos o espelho desnormalizado em profiles e os
-- gates de limite (registros = 10, documentos = 1) no nível do banco.
--
-- Limites do plano gratuito (manter em sincronia com src/lib/plan-limits.ts):
--   registros (attendance_records)  → 10
--   documentos (child_attachments)  → 1
-- Compartilhamentos e cuidado compartilhado são Premium (gated nos ServerFns).

-- ===========================================================================
-- 1. Espelho do plano do responsável em profiles
-- ===========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_plan text NOT NULL DEFAULT 'free'
  CHECK (parent_plan IN ('free', 'premium'));

-- ===========================================================================
-- 2. Proteger parent_plan contra auto-elevação (só service_role altera)
--    Recria prevent_self_admin_elevation incluindo TODAS as colunas protegidas.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_admin_elevation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN new; END IF;

  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) THEN
    RETURN new;
  END IF;

  IF new.is_admin IS DISTINCT FROM old.is_admin THEN
    RAISE EXCEPTION 'Permissão negada: is_admin não pode ser alterado pelo próprio usuário.';
  END IF;
  IF new.user_type IS DISTINCT FROM old.user_type THEN
    RAISE EXCEPTION 'Permissão negada: user_type não pode ser alterado diretamente.';
  END IF;
  IF new.secondary_role IS DISTINCT FROM old.secondary_role THEN
    RAISE EXCEPTION 'Permissão negada: secondary_role não pode ser alterado diretamente.';
  END IF;
  IF new.therapist_plan IS DISTINCT FROM old.therapist_plan THEN
    RAISE EXCEPTION 'Permissão negada: therapist_plan não pode ser alterado diretamente.';
  END IF;
  IF new.parent_plan IS DISTINCT FROM old.parent_plan THEN
    RAISE EXCEPTION 'Permissão negada: parent_plan não pode ser alterado diretamente.';
  END IF;

  RETURN new;
END;
$$;

-- ===========================================================================
-- 3. Gate de LIMITE — registros (free = 10) no nível do banco
--    A criação de registros é client-side (attendance.service.ts). A UI mostra
--    o paywall, mas o gate real fica aqui (defense-in-depth). Só afeta PAIS free.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_parent_records_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_plan text;
  v_count int;
BEGIN
  SELECT user_type, parent_plan INTO v_type, v_plan
  FROM public.profiles WHERE id = new.user_id;

  -- Só restringe responsáveis no plano gratuito.
  IF v_type IS DISTINCT FROM 'parent' OR v_plan = 'premium' THEN
    RETURN new;
  END IF;

  SELECT count(*) INTO v_count FROM public.attendance_records WHERE user_id = new.user_id;
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: limite de 10 registros do plano gratuito atingido.';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_parent_records_limit ON public.attendance_records;
CREATE TRIGGER trg_enforce_parent_records_limit
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_records_limit();

-- ===========================================================================
-- 4. Gate de LIMITE — documentos (free = 1) no nível do banco
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_parent_documents_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_plan text;
  v_count int;
BEGIN
  SELECT user_type, parent_plan INTO v_type, v_plan
  FROM public.profiles WHERE id = new.user_id;

  IF v_type IS DISTINCT FROM 'parent' OR v_plan = 'premium' THEN
    RETURN new;
  END IF;

  SELECT count(*) INTO v_count FROM public.child_attachments WHERE user_id = new.user_id;
  IF v_count >= 1 THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: limite de 1 documento do plano gratuito atingido.';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_parent_documents_limit ON public.child_attachments;
CREATE TRIGGER trg_enforce_parent_documents_limit
  BEFORE INSERT ON public.child_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_documents_limit();
