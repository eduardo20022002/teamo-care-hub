-- ─── Fase 1 — Módulo de Clínicas ────────────────────────────────────────────
-- Cria infraestrutura de banco para o módulo de clínicas ABA.
-- Todas as tabelas têm RLS ativo antes do primeiro INSERT.
-- Nenhuma tabela existente é removida — apenas adições.

-- ===========================================================================
-- 1. Estender user_type para incluir clinic_coordinator
-- ===========================================================================

-- Remover a constraint CHECK existente em user_type (nome auto-gerado pelo Postgres)
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name   = 'profiles'
    AND tc.constraint_type = 'CHECK'
    AND cc.check_clause LIKE '%user_type%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_type_check
  CHECK (user_type IN ('parent', 'therapist', 'clinic_coordinator'));

-- ===========================================================================
-- 2. Tabela: clinics
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.clinics (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  cnpj       text        CHECK (cnpj IS NULL OR cnpj ~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$'),
  address    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Serviços oferecidos: array de modalidades configuradas no wizard
  services   text[]      NOT NULL DEFAULT ARRAY[]::text[],
  owner_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS clinics_owner_id_idx ON public.clinics(owner_id);

-- ===========================================================================
-- 3. Tabela: clinic_members
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.clinic_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- coordinator = acesso total; receptionist = fila + agenda; therapist = agenda + evolução
  role       text        NOT NULL CHECK (role IN ('coordinator', 'receptionist', 'therapist')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at  timestamptz,                     -- NULL = convite pendente
  UNIQUE (clinic_id, user_id)
);

ALTER TABLE public.clinic_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS clinic_members_clinic_id_idx ON public.clinic_members(clinic_id);
CREATE INDEX IF NOT EXISTS clinic_members_user_id_idx   ON public.clinic_members(user_id);

-- ===========================================================================
-- 4. Tabela: clinic_invites
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.clinic_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  -- Token do link de convite: dois UUIDs sem hífens (64 chars hex, ~244 bits de
  -- entropia). Usa gen_random_uuid() (core do Postgres) para não depender da extensão
  -- pgcrypto/gen_random_bytes, que não está no search_path do Supabase.
  token       text        NOT NULL UNIQUE
                DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  role        text        NOT NULL CHECK (role IN ('coordinator', 'receptionist', 'therapist')),
  email       text        NOT NULL CHECK (length(email) <= 255),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at     timestamptz,                     -- NULL = não usado
  created_by  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS clinic_invites_token_idx     ON public.clinic_invites(token);
CREATE INDEX IF NOT EXISTS clinic_invites_clinic_id_idx ON public.clinic_invites(clinic_id);

-- ===========================================================================
-- 5. Funções auxiliares para RLS
-- ===========================================================================

-- Verifica se o usuário atual é membro ativo de uma clínica
CREATE OR REPLACE FUNCTION public.is_clinic_member(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_members
    WHERE clinic_id = p_clinic_id
      AND user_id   = auth.uid()
      AND joined_at IS NOT NULL
  );
$$;

-- Verifica se o usuário atual é coordinator ativo de uma clínica
CREATE OR REPLACE FUNCTION public.is_clinic_coordinator(p_clinic_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinic_members
    WHERE clinic_id = p_clinic_id
      AND user_id   = auth.uid()
      AND role      = 'coordinator'
      AND joined_at IS NOT NULL
  );
$$;

-- ===========================================================================
-- 6. RLS — clinics
-- ===========================================================================

-- Membros ativos e o próprio dono podem ver a clínica
CREATE POLICY "clinics_select_member" ON public.clinics
  FOR SELECT TO authenticated
  USING (is_clinic_member(id) OR owner_id = auth.uid());

-- Apenas o usuário que cria a clínica pode inserir (via ServerFn)
CREATE POLICY "clinics_insert_own" ON public.clinics
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Apenas coordinators podem atualizar os dados da clínica
CREATE POLICY "clinics_update_coordinator" ON public.clinics
  FOR UPDATE TO authenticated
  USING (is_clinic_coordinator(id) OR owner_id = auth.uid())
  WITH CHECK (is_clinic_coordinator(id) OR owner_id = auth.uid());

-- ===========================================================================
-- 7. RLS — clinic_members
-- ===========================================================================

-- Membros ativos podem ver a lista de membros da sua clínica
-- Usuário pode ver a própria entrada (para verificar convite pendente)
CREATE POLICY "clinic_members_select" ON public.clinic_members
  FOR SELECT TO authenticated
  USING (
    is_clinic_member(clinic_id)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.owner_id = auth.uid()
    )
  );

-- Apenas coordinator ou dono pode adicionar membros
CREATE POLICY "clinic_members_insert_coordinator" ON public.clinic_members
  FOR INSERT TO authenticated
  WITH CHECK (
    is_clinic_coordinator(clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.owner_id = auth.uid()
    )
  );

-- Coordinator ou dono pode remover membros
CREATE POLICY "clinic_members_delete_coordinator" ON public.clinic_members
  FOR DELETE TO authenticated
  USING (
    is_clinic_coordinator(clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.owner_id = auth.uid()
    )
  );

-- Membro pode atualizar a própria entrada (para joined_at ao aceitar convite)
CREATE POLICY "clinic_members_update_own" ON public.clinic_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===========================================================================
-- 8. RLS — clinic_invites
-- ===========================================================================

-- Coordinators e dono podem ver os convites da clínica
CREATE POLICY "clinic_invites_select_coordinator" ON public.clinic_invites
  FOR SELECT TO authenticated
  USING (
    is_clinic_coordinator(clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.owner_id = auth.uid()
    )
  );

-- NOTA DE SEGURANÇA (LGPD): a leitura de convite pelo token e o aceite são feitos
-- exclusivamente via ServerFn usando service_role (supabaseAdmin), que ignora RLS.
-- Por isso NÃO há policy de SELECT/UPDATE aberta a `authenticated` aqui — uma policy
-- `USING (true)` exporia e-mails de todos os convites de todas as clínicas a qualquer
-- usuário logado. O acesso direto via cliente autenticado fica restrito a coordinator/dono.

-- Coordinators e dono podem criar convites
CREATE POLICY "clinic_invites_insert_coordinator" ON public.clinic_invites
  FOR INSERT TO authenticated
  WITH CHECK (
    is_clinic_coordinator(clinic_id)
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_id AND c.owner_id = auth.uid()
    )
  );

-- ===========================================================================
-- 9. Trigger: updated_at automático em clinics
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clinics_set_updated_at ON public.clinics;
CREATE TRIGGER clinics_set_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
