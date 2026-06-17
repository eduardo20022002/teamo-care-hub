-- ─── Assinaturas (Freemium) ──────────────────────────────────────────────────
-- Modelo de assinatura POR ESCOPO: uma conta dual-role (pai E terapeuta) pode ter
-- assinaturas independentes (preços/produtos diferentes). O plano nunca é um
-- booleano único da conta.
--
-- Etapa 1 (gating): a tabela é populada manualmente (service_role / Dashboard) para
-- testar free vs premium. Etapa 2 (AbacatePay): o webhook escreve aqui via service_role.
--
-- Toda escrita passa pelo service_role (supabaseAdmin) — o cliente só faz SELECT da
-- própria assinatura. Regra 1 do CLAUDE.md: RLS obrigatório antes do primeiro INSERT.

-- ===========================================================================
-- 1. Tabela subscriptions
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope                    text NOT NULL CHECK (scope IN ('therapist', 'parent', 'clinic')),
  plan                     text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'trialing', 'past_due', 'canceled')),
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,  -- até quando o acesso pago vale (downgrade só no fim)
  -- Campos do provedor de pagamento, preenchidos só na Etapa 2 (AbacatePay):
  provider                 text CHECK (provider IS NULL OR provider IN ('abacatepay')),
  provider_subscription_id text,
  provider_customer_id     text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_provider_sub_idx
  ON public.subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- O dono lê a própria assinatura. Escritas só via service_role (sem policy de INSERT/UPDATE).
CREATE POLICY "subscriptions_owner_select"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- ===========================================================================
-- 2. Espelho desnormalizado em profiles (leitura barata no frontend)
-- ===========================================================================
-- Mantido em sincronia com subscriptions pelo backend (service_role). Evita expor a
-- tabela inteira e permite gate em 1 SELECT. Fonte de verdade = subscriptions.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS therapist_plan text NOT NULL DEFAULT 'free'
  CHECK (therapist_plan IN ('free', 'premium'));

-- ===========================================================================
-- 3. Proteger therapist_plan contra auto-elevação (só service_role altera)
--    Estende prevent_self_admin_elevation (ver 20260601100000_dual_role.sql).
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

  -- Proteger therapist_plan: plano só muda via service_role (gating manual / webhook).
  IF new.therapist_plan IS DISTINCT FROM old.therapist_plan THEN
    RAISE EXCEPTION 'Permissão negada: therapist_plan não pode ser alterado diretamente.';
  END IF;

  RETURN new;
END;
$$;

-- ===========================================================================
-- 4. Sessões recorrentes são Premium — enforcement server-side (trigger)
--    A criação de sessões do terapeuta é client-side (events.service.ts, via
--    cliente Supabase com RLS). A UI desabilita recorrência no free, mas o
--    gate real fica aqui: rejeita INSERT de evento recorrente de terapeuta free.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.enforce_therapist_recurrence_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_freq text;
  v_plan text;
BEGIN
  v_freq := new.recurrence->>'freq';

  -- Eventos avulsos (sem recorrência real) sempre passam.
  IF v_freq IS NULL OR v_freq IN ('none', 'once') THEN
    RETURN new;
  END IF;

  -- Só restringe sessões vinculadas a um terapeuta (eventos de pais não têm therapist_id).
  IF new.therapist_id IS NULL THEN
    RETURN new;
  END IF;

  SELECT therapist_plan INTO v_plan FROM public.profiles WHERE id = new.therapist_id;
  IF v_plan IS DISTINCT FROM 'premium' THEN
    RAISE EXCEPTION 'PREMIUM_REQUIRED: sessões recorrentes exigem o plano Premium do terapeuta.';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_therapist_recurrence_plan ON public.agenda_events;
CREATE TRIGGER trg_enforce_therapist_recurrence_plan
  BEFORE INSERT ON public.agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_therapist_recurrence_plan();
