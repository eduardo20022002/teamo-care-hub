-- ─── Pais convidam Profissionais ─────────────────────────────────────────────
-- Fluxo inverso ao therapist_parent_access:
-- O pai convida um profissional externo para criar conta e acompanhar a criança.
-- O profissional, ao aceitar, vê os OTP shares criados para seu e-mail sem OTP.

-- ===========================================================================
-- 1. ADD COLUMN em professionals (liga conta TEAmo ao contato do pai)
-- ===========================================================================

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice para lookup rápido "qual profissional tem conta vinculada a este user?"
CREATE INDEX IF NOT EXISTS professionals_user_id_idx ON public.professionals(user_id)
  WHERE user_id IS NOT NULL;

-- ===========================================================================
-- 2. Tabela parent_professional_invites
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.parent_professional_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  invitee_email   text NOT NULL,
  invitee_name    text,
  token_hash      text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'revoked')),
  accepted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_professional_invites_parent_idx
  ON public.parent_professional_invites(parent_id);
CREATE INDEX IF NOT EXISTS parent_professional_invites_child_idx
  ON public.parent_professional_invites(child_id);
CREATE INDEX IF NOT EXISTS parent_professional_invites_accepted_by_idx
  ON public.parent_professional_invites(accepted_by)
  WHERE accepted_by IS NOT NULL;

ALTER TABLE public.parent_professional_invites ENABLE ROW LEVEL SECURITY;

-- Pai vê e cria seus próprios convites
CREATE POLICY "parent_professional_invites_parent_select"
  ON public.parent_professional_invites FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "parent_professional_invites_parent_insert"
  ON public.parent_professional_invites FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- Profissional aceito pode ver o registro do convite
CREATE POLICY "parent_professional_invites_accepted_select"
  ON public.parent_professional_invites FOR SELECT
  USING (accepted_by = auth.uid());

-- ===========================================================================
-- 3. Tabela parent_professional_access
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.parent_professional_access (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  invite_id       uuid REFERENCES public.parent_professional_invites(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'revoked')),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, professional_id, child_id)
);

CREATE INDEX IF NOT EXISTS parent_professional_access_parent_idx
  ON public.parent_professional_access(parent_id);
CREATE INDEX IF NOT EXISTS parent_professional_access_professional_idx
  ON public.parent_professional_access(professional_id);

ALTER TABLE public.parent_professional_access ENABLE ROW LEVEL SECURITY;

-- Pai vê todos os acessos de suas crianças
CREATE POLICY "parent_professional_access_parent_select"
  ON public.parent_professional_access FOR SELECT
  USING (parent_id = auth.uid());

-- Profissional vê os acessos concedidos a ele
CREATE POLICY "parent_professional_access_professional_select"
  ON public.parent_professional_access FOR SELECT
  USING (professional_id = auth.uid());

-- Escritas passam pelo supabaseAdmin (service_role) — sem política de INSERT/UPDATE autenticada

-- ===========================================================================
-- 4. Tabela parent_professional_messages
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.parent_professional_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id   uuid NOT NULL REFERENCES public.parent_professional_access(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('parent', 'professional')),
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 1000),
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parent_professional_messages_access_idx
  ON public.parent_professional_messages(access_id, created_at);

ALTER TABLE public.parent_professional_messages ENABLE ROW LEVEL SECURITY;

-- Pai pode ler/escrever mensagens de acessos onde é parent_id
CREATE POLICY "parent_professional_messages_parent"
  ON public.parent_professional_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_professional_access a
      WHERE a.id = access_id AND a.parent_id = auth.uid() AND a.status = 'active'
    )
  )
  WITH CHECK (
    author_id = auth.uid() AND author_type = 'parent'
    AND EXISTS (
      SELECT 1 FROM public.parent_professional_access a
      WHERE a.id = access_id AND a.parent_id = auth.uid() AND a.status = 'active'
    )
  );

-- Profissional pode ler/escrever mensagens de acessos onde é professional_id
CREATE POLICY "parent_professional_messages_professional"
  ON public.parent_professional_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_professional_access a
      WHERE a.id = access_id AND a.professional_id = auth.uid() AND a.status = 'active'
    )
  )
  WITH CHECK (
    author_id = auth.uid() AND author_type = 'professional'
    AND EXISTS (
      SELECT 1 FROM public.parent_professional_access a
      WHERE a.id = access_id AND a.professional_id = auth.uid() AND a.status = 'active'
    )
  );
