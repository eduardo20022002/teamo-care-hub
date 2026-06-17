-- ─── Freemium da Clínica (clinic_plan) ───────────────────────────────────────
-- Estende o modelo de assinatura por escopo (ver 20260620000000_subscriptions.sql)
-- para o módulo CLÍNICA. O plano é POR CLÍNICA (entidade cobrável, dona = clinics.owner_id),
-- então o espelho fica na própria tabela `clinics`. A tabela `subscriptions`
-- (scope='clinic', user_id = owner) continua a fonte de verdade.
--
-- Limites do plano gratuito (manter em sincronia com src/lib/plan-limits.ts):
--   1 caso, 1 avaliação, 1 sala, 1 sessão, 1 autorização, 1 comunicação (Form 2/3);
--   sem equipe (só coordenador), sem grupos ABA. Form 1 (fila pública) sempre ativo.
-- Os gates são por-recurso nos ServerFns; aqui só adicionamos a coluna + proteção.

-- ===========================================================================
-- 1. Espelho do plano na tabela clinics
-- ===========================================================================

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS clinic_plan text NOT NULL DEFAULT 'free'
  CHECK (clinic_plan IN ('free', 'premium'));

-- ===========================================================================
-- 2. Proteger clinic_plan contra auto-elevação
--    Coordenadores têm policy clinics_update_coordinator (FOR UPDATE) e poderiam
--    setar clinic_plan='premium'. Só service_role (webhook/gating manual) ou admin altera.
--    Espelha prevent_self_admin_elevation (ver 20260622000000_parent_plan.sql).
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.prevent_clinic_plan_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / migrations / Dashboard: sem auth context — permite.
  IF auth.uid() IS NULL THEN RETURN new; END IF;

  -- Admin pode alterar qualquer clínica.
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true) THEN
    RETURN new;
  END IF;

  IF new.clinic_plan IS DISTINCT FROM old.clinic_plan THEN
    RAISE EXCEPTION 'Permissão negada: clinic_plan não pode ser alterado diretamente.';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_clinic_plan_self_change ON public.clinics;
CREATE TRIGGER trg_prevent_clinic_plan_self_change
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.prevent_clinic_plan_self_change();
