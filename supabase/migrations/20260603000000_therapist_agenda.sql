-- ============================================================
-- Módulo do Terapeuta — Onboarding + Agenda + Registros de Sessão
-- Criado em: 03/06/2026
-- ============================================================

-- ─── A1. Estender therapist_profiles com perguntas do onboarding ─────────────
ALTER TABLE public.therapist_profiles
  ADD COLUMN IF NOT EXISTS attendance_setting  text
    CHECK (attendance_setting IN ('particular','clinica','ambos')),
  ADD COLUMN IF NOT EXISTS attendance_modality text
    CHECK (attendance_modality IN ('presencial','online','ambos')),
  ADD COLUMN IF NOT EXISTS patient_count_range text
    CHECK (patient_count_range IN ('1-5','6-10','11-20','20+')),
  ADD COLUMN IF NOT EXISTS weekly_hours_range  text
    CHECK (weekly_hours_range IN ('<10h','10-20h','20-30h','30h+'));

-- ─── A2. Estender children com guardian_info (pacientes do terapeuta) ─────────
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS guardian_info jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.children.guardian_info IS
  'Array de responsáveis cadastrados pelo terapeuta: [{name: string, email?: string}]. Só preenchido quando created_by_type = ''therapist''.';

-- ─── A3. Estender agenda_events com campos de sessão terapêutica ──────────────
ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS therapist_id             uuid
    REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_type             text
    CHECK (session_type IN ('individual','grupo','familiar')),
  ADD COLUMN IF NOT EXISTS session_plan             jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS plan_visible_to_parents  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes  integer
    CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes BETWEEN 1 AND 480),
  ADD COLUMN IF NOT EXISTS actual_start_at          timestamptz,
  ADD COLUMN IF NOT EXISTS session_attendance       text
    CHECK (session_attendance IN ('happened','missed_justified','missed_no_show'));

COMMENT ON COLUMN public.agenda_events.session_plan IS
  'Plano pré-sessão: {objectives: string, activities: string[], materials: string}';
COMMENT ON COLUMN public.agenda_events.session_attendance IS
  'Status real de comparecimento: happened | missed_justified | missed_no_show';

CREATE INDEX IF NOT EXISTS agenda_events_therapist_id_idx
  ON public.agenda_events (therapist_id);

-- RLS: terapeuta vê e gerencia seus próprios eventos de sessão
CREATE POLICY "agenda_select_own_therapist" ON public.agenda_events
  FOR SELECT TO authenticated
  USING (therapist_id = auth.uid());

CREATE POLICY "agenda_insert_therapist" ON public.agenda_events
  FOR INSERT TO authenticated
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "agenda_update_therapist" ON public.agenda_events
  FOR UPDATE TO authenticated
  USING (therapist_id = auth.uid());

-- RLS: pais via therapist_parent_access veem eventos de sessão (read-only)
CREATE POLICY "agenda_select_therapist_parent_sessions" ON public.agenda_events
  FOR SELECT TO authenticated
  USING (
    therapist_id IS NOT NULL
    AND has_therapist_parent_access(child_id)
  );

-- ─── A4. Criar tabela session_records ─────────────────────────────────────────
CREATE TABLE public.session_records (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid NOT NULL
    REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  therapist_id          uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id              uuid NOT NULL
    REFERENCES public.children(id) ON DELETE CASCADE,

  -- Bloco 1: O que foi trabalhado
  goals_achieved        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{goal: string, achieved: boolean}]
  what_was_done         text CHECK (what_was_done IS NULL OR length(what_was_done) <= 2000),
  engagement_level      text CHECK (engagement_level IN ('baixo','medio','alto')),

  -- Bloco 2: Observações clínicas (visibilidade controlada pelo toggle is_private)
  clinical_observations text CHECK (clinical_observations IS NULL OR length(clinical_observations) <= 3000),
  notable_behaviors     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{description: string, type: 'conquista'|'dificuldade'|'regulacao'|'comunicacao'|'interacao_social'|'outro'}]
  is_private            boolean NOT NULL DEFAULT false,

  -- Bloco 3: Instrução para família (SEMPRE visível — sem toggle de privacidade)
  family_instruction    text CHECK (family_instruction IS NULL OR length(family_instruction) <= 2000),
  frequency_suggestion  text CHECK (frequency_suggestion IS NULL OR length(frequency_suggestion) <= 200),

  -- Bloco 4: Próxima sessão
  points_to_continue    text CHECK (points_to_continue IS NULL OR length(points_to_continue) <= 1000),
  approach_adjustment   text CHECK (approach_adjustment IS NULL OR length(approach_adjustment) <= 1000),
  -- approach_adjustment é SEMPRE privado — nunca exposto via RLS de pais

  -- Controle de publicação
  is_draft              boolean NOT NULL DEFAULT true,
  published_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- 1 registro por evento
  UNIQUE (event_id)
);

ALTER TABLE public.session_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.session_records (therapist_id);
CREATE INDEX ON public.session_records (child_id);
CREATE INDEX ON public.session_records (event_id);

-- RLS: terapeuta tem acesso total aos próprios registros
CREATE POLICY "session_records_therapist_all" ON public.session_records
  FOR ALL TO authenticated
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- RLS: pais leem registros publicados, não-privados, das crianças às quais têm acesso
-- approach_adjustment nunca chega ao cliente pois a query do cliente não o seleciona,
-- mas a proteção em profundidade está na restrição is_private + is_draft
CREATE POLICY "session_records_parent_read" ON public.session_records
  FOR SELECT TO authenticated
  USING (
    is_private = false
    AND is_draft = false
    AND (
      -- Pai é dono da criança (criança cadastrada pelo próprio pai)
      EXISTS (
        SELECT 1 FROM public.children
        WHERE children.id = session_records.child_id
          AND children.user_id = auth.uid()
      )
      OR
      -- Pai tem acesso via convite do terapeuta
      has_therapist_parent_access(child_id)
    )
  );

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_session_records_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER session_records_updated_at
  BEFORE UPDATE ON public.session_records
  FOR EACH ROW EXECUTE FUNCTION public.set_session_records_updated_at();
