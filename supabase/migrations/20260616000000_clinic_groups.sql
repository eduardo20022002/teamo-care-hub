-- Fase 7: Grupos ABA
-- Tabelas: clinic_groups, clinic_group_members

-- clinic_groups: entidade grupo com terapeuta, sala, horário e critérios de matching
CREATE TABLE IF NOT EXISTS clinic_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                text NOT NULL,
  therapist_user_id   uuid NOT NULL REFERENCES auth.users(id),
  room_id             uuid NOT NULL REFERENCES clinic_rooms(id),
  day_of_week         int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time          time NOT NULL,
  duration_minutes    int  NOT NULL DEFAULT 60,
  capacity_max        int  NOT NULL DEFAULT 4 CHECK (capacity_max BETWEEN 2 AND 6),
  matching_criteria   jsonb NOT NULL DEFAULT '{
    "vbmapp_level_min": 1,
    "vbmapp_level_max": 3,
    "age_min": 2,
    "age_max": 18,
    "allow_factor_b": false
  }',
  status              text NOT NULL DEFAULT 'formando'
    CHECK (status IN ('formando','ativo','encerrado')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinic_groups ENABLE ROW LEVEL SECURITY;

-- Membros da clínica podem ler grupos; somente coordenadores podem inserir/alterar/excluir
CREATE POLICY "clinic_groups_member_select"
  ON clinic_groups FOR SELECT
  USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_groups_coordinator_write"
  ON clinic_groups FOR INSERT
  WITH CHECK (is_clinic_coordinator(clinic_id));

CREATE POLICY "clinic_groups_coordinator_update"
  ON clinic_groups FOR UPDATE
  USING (is_clinic_coordinator(clinic_id));

CREATE POLICY "clinic_groups_coordinator_delete"
  ON clinic_groups FOR DELETE
  USING (is_clinic_coordinator(clinic_id));

-- clinic_group_members: membros de um grupo (histórico incluído via left_at)
CREATE TABLE IF NOT EXISTS clinic_group_members (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_group_id         uuid NOT NULL REFERENCES clinic_groups(id) ON DELETE CASCADE,
  patient_profile_id      uuid NOT NULL REFERENCES patient_profiles(id),
  joined_at               timestamptz NOT NULL DEFAULT now(),
  left_at                 timestamptz,
  leave_reason            text,
  exception_justification text,
  UNIQUE (clinic_group_id, patient_profile_id, joined_at)
);

ALTER TABLE clinic_group_members ENABLE ROW LEVEL SECURITY;

-- Terapeuta e coordenador veem composição agregada (nomes + nível), não prontuários
-- RLS: membro de grupo NÃO acessa dados de outros membros — apenas clinic members acessam
CREATE POLICY "clinic_group_members_member_select"
  ON clinic_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM clinic_groups cg
      WHERE cg.id = clinic_group_id
        AND is_clinic_member(cg.clinic_id)
    )
  );

CREATE POLICY "clinic_group_members_coordinator_insert"
  ON clinic_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clinic_groups cg
      WHERE cg.id = clinic_group_id
        AND is_clinic_coordinator(cg.clinic_id)
    )
  );

CREATE POLICY "clinic_group_members_coordinator_update"
  ON clinic_group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM clinic_groups cg
      WHERE cg.id = clinic_group_id
        AND is_clinic_coordinator(cg.clinic_id)
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clinic_groups_clinic_id ON clinic_groups(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_groups_status ON clinic_groups(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_clinic_group_members_group_id ON clinic_group_members(clinic_group_id);
CREATE INDEX IF NOT EXISTS idx_clinic_group_members_active ON clinic_group_members(clinic_group_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clinic_group_members_patient ON clinic_group_members(patient_profile_id);
