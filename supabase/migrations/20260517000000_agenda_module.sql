-- ============================================================================
-- TEAmo · Módulo Agenda
-- Cria as 4 tabelas centrais do módulo de Agenda + RLS LGPD-compliant.
-- ----------------------------------------------------------------------------
-- Princípios:
--  - RLS obrigatório (LGPD/HIPAA) em toda tabela com dados sensíveis.
--  - Mínimo necessário: políticas restritas ao próprio user_id.
--  - Soft links a Profissionais e Attendance (ON DELETE SET NULL) para preservar
--    histórico se a referência for removida.
--  - Recurrence e reminders em JSONB para flexibilidade do modelo.
-- ============================================================================

-- ====== 1. agenda_events ====================================================
-- Compromisso (terapia, médica, escola, medicação, outro).
CREATE TABLE public.agenda_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('terapia','medica','escola','medicacao','outro')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  professional_name_raw TEXT CHECK (professional_name_raw IS NULL OR length(professional_name_raw) <= 120),
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE,
  locale TEXT CHECK (locale IS NULL OR length(locale) <= 200),
  -- Recurrence shape:
  --   { freq: 'none'|'weekly'|'biweekly'|'monthly'|'daily'|'custom',
  --     daysOfWeek?: int[] (0=Domingo..6=Sábado),
  --     interval?: int,
  --     endsAt?: ISO date }
  recurrence JSONB NOT NULL DEFAULT '{"freq":"none"}'::jsonb,
  -- Reminders shape:
  --   { oneDayBefore: bool, oneHourBefore: bool, customMinutes?: int[] }
  reminders JSONB NOT NULL DEFAULT '{"oneDayBefore":true,"oneHourBefore":true}'::jsonb,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','happened','rescheduled','missed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT agenda_events_endat_after_startat CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX idx_agenda_events_user_id ON public.agenda_events(user_id);
CREATE INDEX idx_agenda_events_child_id ON public.agenda_events(child_id);
CREATE INDEX idx_agenda_events_start_at ON public.agenda_events(user_id, start_at);
CREATE INDEX idx_agenda_events_professional_id ON public.agenda_events(professional_id) WHERE professional_id IS NOT NULL;

ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_events_select_own"
  ON public.agenda_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_events_insert_own"
  ON public.agenda_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agenda_events_update_own"
  ON public.agenda_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_events_delete_own"
  ON public.agenda_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_agenda_events_updated_at
  BEFORE UPDATE ON public.agenda_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== 2. agenda_observations ==============================================
-- Observação livre dentro de um evento.
CREATE TABLE public.agenda_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (length(text) BETWEEN 1 AND 5000),
  -- Reminder cruzado (opcional): a mãe quer ser lembrada de mencionar isto
  -- com outro profissional na próxima consulta dele.
  reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  reminder_target_professional_id UUID REFERENCES public.professionals(id) ON DELETE SET NULL,
  reminder_target_event_id UUID REFERENCES public.agenda_events(id) ON DELETE SET NULL,
  reminder_fire_at TIMESTAMP WITH TIME ZONE,
  reminder_dismissed BOOLEAN NOT NULL DEFAULT false,
  -- Vínculo bi-direcional com Registros (attendance_records) — quando a mãe
  -- usa "↗ Virar registro", aqui guardamos o id do registro criado.
  promoted_to_record_id UUID REFERENCES public.attendance_records(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agenda_obs_user_id ON public.agenda_observations(user_id);
CREATE INDEX idx_agenda_obs_event_id ON public.agenda_observations(event_id);
-- Index parcial: só interessa olhar pending por profissional quando o reminder está ativo e não foi dispensado.
CREATE INDEX idx_agenda_obs_pending_by_prof
  ON public.agenda_observations(reminder_target_professional_id)
  WHERE reminder_enabled = true AND reminder_dismissed = false AND promoted_to_record_id IS NULL;
CREATE INDEX idx_agenda_obs_pending_by_event
  ON public.agenda_observations(reminder_target_event_id)
  WHERE reminder_enabled = true AND reminder_dismissed = false AND promoted_to_record_id IS NULL;

ALTER TABLE public.agenda_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_obs_select_own"
  ON public.agenda_observations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_obs_insert_own"
  ON public.agenda_observations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agenda_obs_update_own"
  ON public.agenda_observations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_obs_delete_own"
  ON public.agenda_observations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_agenda_obs_updated_at
  BEFORE UPDATE ON public.agenda_observations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ====== 3. agenda_observation_attachments ===================================
-- Anexos (mídia) de uma observação. Storage path em Supabase Storage,
-- mesmo bucket "attachments" usado pelos record_attachments (políticas idênticas).
CREATE TABLE public.agenda_observation_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  observation_id UUID NOT NULL REFERENCES public.agenda_observations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL CHECK (length(storage_path) <= 500),
  filename TEXT NOT NULL CHECK (length(filename) BETWEEN 1 AND 200),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- max 10MB
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','application/pdf','audio/mpeg','audio/mp4','audio/wav','audio/webm','video/mp4','video/webm','video/quicktime')),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio','pdf','other')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agenda_obs_attach_user_id ON public.agenda_observation_attachments(user_id);
CREATE INDEX idx_agenda_obs_attach_obs_id ON public.agenda_observation_attachments(observation_id);

ALTER TABLE public.agenda_observation_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_obs_attach_select_own"
  ON public.agenda_observation_attachments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_obs_attach_insert_own"
  ON public.agenda_observation_attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agenda_obs_attach_delete_own"
  ON public.agenda_observation_attachments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ====== 4. agenda_notification_prefs ========================================
-- Preferências de notificação por usuário (uma linha por user).
CREATE TABLE public.agenda_notification_prefs (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  one_day_before BOOLEAN NOT NULL DEFAULT true,
  one_hour_before BOOLEAN NOT NULL DEFAULT true,
  pending_observations BOOLEAN NOT NULL DEFAULT true,
  post_event_register BOOLEAN NOT NULL DEFAULT false,
  -- Estado do onboarding da agenda — true significa que a mãe já viu o tutorial.
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_notif_prefs_select_own"
  ON public.agenda_notification_prefs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_notif_prefs_insert_own"
  ON public.agenda_notification_prefs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agenda_notif_prefs_update_own"
  ON public.agenda_notification_prefs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_agenda_notif_prefs_updated_at
  BEFORE UPDATE ON public.agenda_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Notas:
-- 1. As notificações computadas (table Notification do brief) NÃO foram criadas
--    neste primeiro passo — elas dependem de um job recorrente (Edge Function
--    + pg_cron). Serão tratadas em fase posterior junto com a lógica de
--    scheduler. Por ora, o módulo só persiste prefs e calcula reminders
--    on-demand no cliente quando há observação com reminder_enabled.
-- 2. O bucket "attachments" do Supabase Storage já existe e tem as políticas
--    de MIME/size aplicadas via migration 20260514200000_storage_mime_restrictions.
--    Os anexos de observação reusam o mesmo bucket com prefixo
--    `<user_id>/agenda/<observation_id>/<filename>`.
-- ============================================================================
