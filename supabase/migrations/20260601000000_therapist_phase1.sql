-- ─── Phase 1: Terapeuta entra na plataforma ─────────────────────────────────
-- Cria infraestrutura de banco para terapeutas como usuários de primeira classe.
-- Nenhuma tabela existente é removida. Apenas adições aditivas.

-- ===========================================================================
-- 1. Alterações em tabelas existentes
-- ===========================================================================

-- profiles: tipo de usuário (DEFAULT 'parent' para usuários existentes)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'parent'
  CHECK (user_type IN ('parent', 'therapist'));

-- children: quem criou a criança (DEFAULT 'parent' para registros existentes)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS created_by_type text NOT NULL DEFAULT 'parent'
  CHECK (created_by_type IN ('parent', 'therapist'));

-- children: diagnóstico opcional (contexto clínico — coletado no cadastro do paciente)
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS diagnosis text
  CHECK (diagnosis IS NULL OR length(diagnosis) <= 200);

-- ===========================================================================
-- 2. Trigger handle_new_user: ler user_type da metadata
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, user_type)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'user_type', 'parent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- ===========================================================================
-- 3. Estender prevent_self_admin_elevation para proteger user_type também
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
  -- Mudanças de user_type devem passar pelo supabaseAdmin (service_role).
  IF new.user_type IS DISTINCT FROM old.user_type THEN
    RAISE EXCEPTION 'Permissão negada: user_type não pode ser alterado diretamente.';
  END IF;

  RETURN new;
END;
$$;

-- ===========================================================================
-- 4. therapist_profiles — dados profissionais do terapeuta
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.therapist_profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty      text NOT NULL CHECK (length(specialty) BETWEEN 1 AND 80),
  council_type   text NOT NULL CHECK (length(council_type) BETWEEN 1 AND 20),  -- CRP, CREFONO, …
  council_number text NOT NULL CHECK (length(council_number) BETWEEN 1 AND 30), -- 06/123456
  council_state  char(2) NOT NULL,                                               -- SP, RJ, …
  bio            text CHECK (bio IS NULL OR length(bio) <= 500),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.therapist_profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ler (dados profissionais são públicos — CRP, especialidade)
CREATE POLICY "therapist_profiles_select_authenticated" ON public.therapist_profiles
  FOR SELECT TO authenticated USING (true);

-- Apenas o próprio terapeuta pode inserir/alterar/deletar seu perfil
CREATE POLICY "therapist_profiles_own_write" ON public.therapist_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===========================================================================
-- 5. therapist_invites — convite terapeuta → responsável
-- (sistema SEPARADO e independente de care_invites)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.therapist_invites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id       uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  invitee_email  text NOT NULL CHECK (length(invitee_email) BETWEEN 1 AND 255),
  invitee_alias  text NOT NULL CHECK (length(invitee_alias) BETWEEN 1 AND 80),
  relation       text NOT NULL CHECK (relation IN ('mae','pai','avo_materno','avo_paterno','outro_responsavel')),
  token          text UNIQUE NOT NULL,
  status         text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','revoked')),
  accepted_by    uuid REFERENCES auth.users(id),
  accepted_at    timestamptz,
  revoked_at     timestamptz,
  -- Safety net silencioso: sem expiry visível no UX, mas internamente 365 dias
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.therapist_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS therapist_invites_therapist_id_idx ON public.therapist_invites (therapist_id);
CREATE INDEX IF NOT EXISTS therapist_invites_child_id_idx     ON public.therapist_invites (child_id);
CREATE INDEX IF NOT EXISTS therapist_invites_token_idx        ON public.therapist_invites (token);
CREATE INDEX IF NOT EXISTS therapist_invites_accepted_by_idx  ON public.therapist_invites (accepted_by);
CREATE INDEX IF NOT EXISTS therapist_invites_status_idx       ON public.therapist_invites (status);

-- Terapeuta vê seus convites; responsável aceito vê os próprios
CREATE POLICY "therapist_invites_select" ON public.therapist_invites
  FOR SELECT TO authenticated
  USING (therapist_id = auth.uid() OR accepted_by = auth.uid());

-- Terapeuta cria convites para seus pacientes
CREATE POLICY "therapist_invites_insert" ON public.therapist_invites
  FOR INSERT TO authenticated
  WITH CHECK (therapist_id = auth.uid());

-- Terapeuta revoga; aceite é feito via service_role (acceptTherapistInviteServer)
CREATE POLICY "therapist_invites_update_therapist" ON public.therapist_invites
  FOR UPDATE TO authenticated
  USING (therapist_id = auth.uid());

-- ===========================================================================
-- 6. therapist_parent_access — acesso ativo pós-aceite do convite
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.therapist_parent_access (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  invite_id     uuid NOT NULL REFERENCES public.therapist_invites(id),
  relation      text NOT NULL,
  alias         text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Um pai pode ter apenas um acesso ativo por terapeuta por criança
  UNIQUE (therapist_id, parent_id, child_id)
);

ALTER TABLE public.therapist_parent_access ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS therapist_parent_access_therapist_idx ON public.therapist_parent_access (therapist_id);
CREATE INDEX IF NOT EXISTS therapist_parent_access_parent_idx    ON public.therapist_parent_access (parent_id);
CREATE INDEX IF NOT EXISTS therapist_parent_access_child_idx     ON public.therapist_parent_access (child_id);

-- Terapeuta vê quem tem acesso; pai vê seus próprios acessos
CREATE POLICY "therapist_parent_access_select" ON public.therapist_parent_access
  FOR SELECT TO authenticated
  USING (therapist_id = auth.uid() OR parent_id = auth.uid());

-- INSERT e UPDATE apenas via service_role (supabaseAdmin nos ServerFns)
-- Sem políticas INSERT/UPDATE para authenticated → segurança por omissão

-- ===========================================================================
-- 7. Helper RLS function — análoga a has_care_access
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.has_therapist_parent_access(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.therapist_parent_access
    WHERE child_id = p_child_id
      AND parent_id = auth.uid()
      AND status = 'active'
  )
$$;

-- ===========================================================================
-- 8. RLS expandida em tabelas existentes (APENAS adição — sem remoção)
-- ===========================================================================

-- children: responsável com acesso terapêutico vê o filho
CREATE POLICY "children_select_therapist_parent" ON public.children
  FOR SELECT TO authenticated
  USING (has_therapist_parent_access(id));

-- attendance_records: responsável com acesso terapêutico vê observações
CREATE POLICY "attendance_select_therapist_parent" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (has_therapist_parent_access(child_id));

-- agenda_events: responsável vê agenda (apenas leitura)
CREATE POLICY "agenda_select_therapist_parent" ON public.agenda_events
  FOR SELECT TO authenticated
  USING (has_therapist_parent_access(child_id));

-- record_attachments: responsável vê anexos de registros do terapeuta
CREATE POLICY "record_attachments_select_therapist_parent" ON public.record_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.attendance_records ar
    WHERE ar.id = record_id
      AND has_therapist_parent_access(ar.child_id)
  ));
