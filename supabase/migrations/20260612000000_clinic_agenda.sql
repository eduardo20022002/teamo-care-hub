-- ─── Fase 3: Agenda da Clínica ──────────────────────────────────────────────
-- 6 tabelas: clinic_rooms, clinic_therapist_availability,
--   clinic_recurring_schedules, clinic_sessions,
--   clinic_replacements, clinic_therapist_absences
-- Prefixo clinic_ em tudo para não conflitar com tabela sessions existente.

-- ─── 1. clinic_rooms ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name        text NOT NULL,
  capacity    int  DEFAULT 1,
  resources   text[] DEFAULT '{}',
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_rooms_select" ON public.clinic_rooms
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_rooms_insert" ON public.clinic_rooms
  FOR INSERT WITH CHECK (is_clinic_coordinator(clinic_id));

CREATE POLICY "clinic_rooms_update" ON public.clinic_rooms
  FOR UPDATE USING (is_clinic_coordinator(clinic_id));

CREATE POLICY "clinic_rooms_delete" ON public.clinic_rooms
  FOR DELETE USING (is_clinic_coordinator(clinic_id));

-- ─── 2. clinic_therapist_availability ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_therapist_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week  int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  UNIQUE(clinic_id, user_id, day_of_week, start_time)
);

ALTER TABLE public.clinic_therapist_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_therapist_availability_select" ON public.clinic_therapist_availability
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_therapist_availability_insert" ON public.clinic_therapist_availability
  FOR INSERT WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinic_therapist_availability_update" ON public.clinic_therapist_availability
  FOR UPDATE USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_therapist_availability_delete" ON public.clinic_therapist_availability
  FOR DELETE USING (is_clinic_member(clinic_id));

-- ─── 3. clinic_recurring_schedules ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_recurring_schedules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  queue_entry_id      uuid REFERENCES public.queue_entries(id) ON DELETE SET NULL,
  therapist_user_id   uuid NOT NULL REFERENCES auth.users(id),
  room_id             uuid NOT NULL REFERENCES public.clinic_rooms(id),
  patient_name        text NOT NULL,
  day_of_week         int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time          time NOT NULL,
  duration_minutes    int  DEFAULT 60,
  session_type        text DEFAULT 'terapeutica'
    CHECK (session_type IN ('terapeutica','avaliacao','devolutiva','reposicao','orientacao_pais')),
  starts_on           date NOT NULL,
  ends_on             date,
  active              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_recurring_schedules_select" ON public.clinic_recurring_schedules
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_recurring_schedules_insert" ON public.clinic_recurring_schedules
  FOR INSERT WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinic_recurring_schedules_update" ON public.clinic_recurring_schedules
  FOR UPDATE USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_recurring_schedules_delete" ON public.clinic_recurring_schedules
  FOR DELETE USING (is_clinic_coordinator(clinic_id));

-- ─── 4. clinic_sessions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_sessions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  recurring_schedule_id    uuid REFERENCES public.clinic_recurring_schedules(id) ON DELETE SET NULL,
  therapist_user_id        uuid NOT NULL REFERENCES auth.users(id),
  room_id                  uuid NOT NULL REFERENCES public.clinic_rooms(id),
  patient_name             text NOT NULL,
  session_date             date NOT NULL,
  start_time               time NOT NULL,
  duration_minutes         int  DEFAULT 60,
  session_type             text DEFAULT 'terapeutica'
    CHECK (session_type IN ('terapeutica','avaliacao','devolutiva','reposicao','orientacao_pais')),
  status                   text DEFAULT 'agendada'
    CHECK (status IN ('agendada','realizada','falta_justificada','falta_nao_justificada','cancelada_clinica')),
  notes                    text,
  insurance_authorization_id uuid,  -- FK insurance_authorizations (Fase 5)
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  UNIQUE(clinic_id, therapist_user_id, session_date, start_time)
);

ALTER TABLE public.clinic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_sessions_select" ON public.clinic_sessions
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_sessions_insert" ON public.clinic_sessions
  FOR INSERT WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinic_sessions_update" ON public.clinic_sessions
  FOR UPDATE USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_sessions_delete" ON public.clinic_sessions
  FOR DELETE USING (is_clinic_coordinator(clinic_id));

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.clinic_sessions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clinic_sessions_updated_at
  BEFORE UPDATE ON public.clinic_sessions
  FOR EACH ROW EXECUTE FUNCTION public.clinic_sessions_set_updated_at();

-- ─── 5. clinic_replacements ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_replacements (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  original_session_id     uuid NOT NULL REFERENCES public.clinic_sessions(id) ON DELETE CASCADE,
  therapist_user_id       uuid NOT NULL REFERENCES auth.users(id),
  patient_name            text NOT NULL,
  event_type              text NOT NULL
    CHECK (event_type IN ('falta_familia','cancelamento_clinica','ausencia_terapeuta')),
  status                  text DEFAULT 'pendente'
    CHECK (status IN ('pendente','agendada','realizada','expirada')),
  deadline_date           date NOT NULL,
  replacement_session_id  uuid REFERENCES public.clinic_sessions(id) ON DELETE SET NULL,
  communication_id        uuid,  -- FK clinic_communications (Fase 6)
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_replacements_select" ON public.clinic_replacements
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_replacements_insert" ON public.clinic_replacements
  FOR INSERT WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinic_replacements_update" ON public.clinic_replacements
  FOR UPDATE USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_replacements_delete" ON public.clinic_replacements
  FOR DELETE USING (is_clinic_coordinator(clinic_id));

CREATE OR REPLACE FUNCTION public.clinic_replacements_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER clinic_replacements_updated_at
  BEFORE UPDATE ON public.clinic_replacements
  FOR EACH ROW EXECUTE FUNCTION public.clinic_replacements_set_updated_at();

-- ─── 6. clinic_therapist_absences ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_therapist_absences (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id          uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  therapist_user_id  uuid NOT NULL REFERENCES auth.users(id),
  absence_type       text NOT NULL
    CHECK (absence_type IN ('doenca','emergencia','falta_justificada','falta_nao_justificada','outro')),
  starts_on          date NOT NULL,
  ends_on            date NOT NULL,
  partial            boolean DEFAULT false,
  affected_times     jsonb DEFAULT '[]',
  notes              text,
  sessions_cancelled int DEFAULT 0,
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_therapist_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_therapist_absences_select" ON public.clinic_therapist_absences
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_therapist_absences_insert" ON public.clinic_therapist_absences
  FOR INSERT WITH CHECK (is_clinic_member(clinic_id));

CREATE POLICY "clinic_therapist_absences_update" ON public.clinic_therapist_absences
  FOR UPDATE USING (is_clinic_coordinator(clinic_id));

CREATE POLICY "clinic_therapist_absences_delete" ON public.clinic_therapist_absences
  FOR DELETE USING (is_clinic_coordinator(clinic_id));
