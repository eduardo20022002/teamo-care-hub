-- ============================================================
-- Cuidado Compartilhado — Tabelas, RLS e políticas expandidas
-- Migração: 20260529000000_care_sharing
-- ============================================================

-- ─── 1. care_invites ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  invitee_email text NOT NULL CHECK (char_length(invitee_email) <= 255),
  invitee_alias text NOT NULL CHECK (char_length(invitee_alias) BETWEEN 1 AND 80),
  relation      text NOT NULL CHECK (relation IN ('mae','pai','avo_materno','avo_paterno','tio','cuidador','outro')),
  role          text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','viewer')),
  token         text UNIQUE NOT NULL,                          -- 32-byte base64url raw (enviado no link)
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','accepted','approved','denied','revoked')),
  accepted_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at   timestamptz,
  approved_at   timestamptz,
  denied_at     timestamptz,
  revoked_at    timestamptz,
  expires_at    timestamptz NOT NULL,                          -- 48h após criação
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_invites_owner_idx    ON public.care_invites(owner_id);
CREATE INDEX IF NOT EXISTS care_invites_child_idx    ON public.care_invites(child_id);
CREATE INDEX IF NOT EXISTS care_invites_token_idx    ON public.care_invites(token);
CREATE INDEX IF NOT EXISTS care_invites_status_idx   ON public.care_invites(status);
CREATE INDEX IF NOT EXISTS care_invites_accepted_idx ON public.care_invites(accepted_by);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_invites_updated_at ON public.care_invites;
CREATE TRIGGER care_invites_updated_at
  BEFORE UPDATE ON public.care_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.care_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_invites_select" ON public.care_invites
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR accepted_by = auth.uid());

CREATE POLICY "care_invites_insert" ON public.care_invites
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- UPDATE e operações privilegiadas (aprovar/negar/revogar) via service_role nas ServerFns
CREATE POLICY "care_invites_update_owner" ON public.care_invites
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- ─── 2. care_access ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.care_access (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caregiver_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id      uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  invite_id     uuid NOT NULL REFERENCES public.care_invites(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('admin','viewer')),
  relation      text NOT NULL,
  alias         text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Garante um único acesso ativo por (caregiver, child)
CREATE UNIQUE INDEX IF NOT EXISTS care_access_unique_active
  ON public.care_access(caregiver_id, child_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS care_access_owner_idx      ON public.care_access(owner_id);
CREATE INDEX IF NOT EXISTS care_access_caregiver_idx  ON public.care_access(caregiver_id);
CREATE INDEX IF NOT EXISTS care_access_child_idx      ON public.care_access(child_id);
CREATE INDEX IF NOT EXISTS care_access_status_idx     ON public.care_access(status);

-- RLS
ALTER TABLE public.care_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_access_select" ON public.care_access
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR caregiver_id = auth.uid());

-- INSERT e UPDATE apenas via service_role (supabaseAdmin nas ServerFns)

-- ─── 3. Função helper para verificar acesso de co-cuidador ───────────────────

CREATE OR REPLACE FUNCTION public.has_care_access(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_access
    WHERE child_id = p_child_id
      AND caregiver_id = auth.uid()
      AND status = 'active'
  )
$$;

-- ─── 4. RLS expandida nas tabelas existentes ─────────────────────────────────
-- As políticas já existentes não são removidas — apenas adicionamos novas.

-- children: co-cuidadores (viewer + admin) podem ver
CREATE POLICY "children_select_care" ON public.children
  FOR SELECT TO authenticated
  USING (public.has_care_access(id));

-- attendance_records: co-cuidadores veem e podem inserir registros
CREATE POLICY "attendance_select_care" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (public.has_care_access(child_id));

CREATE POLICY "attendance_insert_care" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (public.has_care_access(child_id));

-- record_attachments: co-cuidadores veem anexos de registros que podem acessar
CREATE POLICY "record_attachments_select_care" ON public.record_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.id = record_attachments.record_id
        AND public.has_care_access(ar.child_id)
    )
  );

-- child_attachments (documentos clínicos): apenas role = 'admin'
CREATE POLICY "child_attachments_select_care_admin" ON public.child_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_access
      WHERE child_id = child_attachments.child_id
        AND caregiver_id = auth.uid()
        AND status = 'active'
        AND role = 'admin'
    )
  );

-- agenda_events: co-cuidadores veem; admin pode criar e editar
CREATE POLICY "agenda_select_care" ON public.agenda_events
  FOR SELECT TO authenticated
  USING (public.has_care_access(child_id));

CREATE POLICY "agenda_insert_care_admin" ON public.agenda_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.care_access
      WHERE child_id = agenda_events.child_id
        AND caregiver_id = auth.uid()
        AND status = 'active'
        AND role = 'admin'
    )
  );

CREATE POLICY "agenda_update_care_admin" ON public.agenda_events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_access
      WHERE child_id = agenda_events.child_id
        AND caregiver_id = auth.uid()
        AND status = 'active'
        AND role = 'admin'
    )
  );

-- professionals: co-cuidadores veem profissionais do owner via join
CREATE POLICY "professionals_select_care" ON public.professionals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_access ca
      JOIN public.children c ON ca.child_id = c.id
      WHERE c.user_id = professionals.user_id
        AND ca.caregiver_id = auth.uid()
        AND ca.status = 'active'
    )
  );

-- storage.objects — documentos de filhos para co-cuidador admin
CREATE POLICY "storage_child_attachments_care_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = 'children'
    AND EXISTS (
      SELECT 1 FROM public.care_access
      WHERE child_id::text = (storage.foldername(name))[3]
        AND caregiver_id = auth.uid()
        AND status = 'active'
        AND role = 'admin'
    )
  );
