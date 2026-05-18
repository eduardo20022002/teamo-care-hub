-- ============================================================================
-- TEAmo · Agenda — Scheduler de notificações server-side
-- Cria tabela agenda_notifications + função schedule_agenda_notifications()
-- que materializa notificações em batch, e agenda execução via pg_cron.
-- ============================================================================

-- ====== Tabela agenda_notifications =========================================
CREATE TABLE IF NOT EXISTS public.agenda_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'event_one_day_before',
    'event_one_hour_before',
    'pending_observations',
    'post_event_register_prompt',
    'medication_due'
  )),
  event_id UUID REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  observation_ids UUID[],
  fire_at TIMESTAMP WITH TIME ZONE NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  actioned_at TIMESTAMP WITH TIME ZONE,
  body TEXT NOT NULL,
  deep_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Dedup: mesmo user + mesmo evento + mesmo kind só pode existir uma vez
  -- (a entry é apagada na re-materialização se as condições mudam)
  CONSTRAINT agenda_notifications_dedup UNIQUE NULLS NOT DISTINCT (user_id, kind, event_id)
);

CREATE INDEX IF NOT EXISTS idx_agenda_notif_user_fire
  ON public.agenda_notifications(user_id, fire_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_notif_unread
  ON public.agenda_notifications(user_id, fire_at DESC) WHERE read_at IS NULL;

ALTER TABLE public.agenda_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_notif_select_own"
  ON public.agenda_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "agenda_notif_update_own"
  ON public.agenda_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
-- INSERT só pelo scheduler (service_role) — não há policy de INSERT pra authenticated.
-- DELETE também só pelo scheduler.

-- ====== Função schedule_agenda_notifications() ==============================
-- Materializa notificações que devem disparar nas próximas 36h.
-- Idempotente: usa ON CONFLICT DO UPDATE pra ajustar fire_at/body se mudaram.
CREATE OR REPLACE FUNCTION public.schedule_agenda_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_horizon TIMESTAMPTZ := now() + INTERVAL '36 hours';
BEGIN
  -- 1 dia antes
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id,
    'event_one_day_before',
    e.id,
    e.start_at - INTERVAL '24 hours',
    'Amanhã · ' || e.title,
    '/agenda/' || e.id
  FROM public.agenda_events e
  JOIN public.agenda_notification_prefs p ON p.user_id = e.user_id
  WHERE e.status = 'upcoming'
    AND p.one_day_before = true
    AND (e.reminders->>'oneDayBefore')::boolean = true
    AND e.start_at - INTERVAL '24 hours' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- 1 hora antes
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id,
    'event_one_hour_before',
    e.id,
    e.start_at - INTERVAL '1 hour',
    'Em 1 hora · ' || e.title,
    '/agenda/' || e.id
  FROM public.agenda_events e
  JOIN public.agenda_notification_prefs p ON p.user_id = e.user_id
  WHERE e.status = 'upcoming'
    AND p.one_hour_before = true
    AND (e.reminders->>'oneHourBefore')::boolean = true
    AND e.start_at - INTERVAL '1 hour' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- Medicação no horário (tipo = 'medicacao')
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id,
    'medication_due',
    e.id,
    e.start_at,
    'Hora da medicação · ' || e.title,
    '/agenda/' || e.id
  FROM public.agenda_events e
  WHERE e.status = 'upcoming'
    AND e.type = 'medicacao'
    AND e.start_at BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- Pendentes (2h antes do evento, se há obs apontando)
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link, observation_ids)
  SELECT
    e.user_id,
    'pending_observations',
    e.id,
    e.start_at - INTERVAL '2 hours',
    (
      SELECT count(*)::text || ' coisas pra mencionar' ||
        CASE WHEN e.professional_id IS NOT NULL THEN ' à ' || (
          SELECT split_part(name, ' ', 1) || ' ' || split_part(name, ' ', 2)
          FROM public.professionals WHERE id = e.professional_id
        ) ELSE '' END
      FROM public.agenda_observations o2
      WHERE o2.reminder_target_event_id = e.id
        AND o2.reminder_enabled = true
        AND o2.reminder_dismissed = false
        AND o2.promoted_to_record_id IS NULL
    ),
    '/agenda/' || e.id,
    ARRAY(
      SELECT id FROM public.agenda_observations
      WHERE reminder_target_event_id = e.id
        AND reminder_enabled = true
        AND reminder_dismissed = false
        AND promoted_to_record_id IS NULL
    )
  FROM public.agenda_events e
  JOIN public.agenda_notification_prefs p ON p.user_id = e.user_id
  WHERE e.status = 'upcoming'
    AND p.pending_observations = true
    AND e.start_at - INTERVAL '2 hours' BETWEEN v_now AND v_horizon
    AND EXISTS (
      SELECT 1 FROM public.agenda_observations o
      WHERE o.reminder_target_event_id = e.id
        AND o.reminder_enabled = true
        AND o.reminder_dismissed = false
        AND o.promoted_to_record_id IS NULL
    )
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET
    fire_at = EXCLUDED.fire_at,
    body = EXCLUDED.body,
    observation_ids = EXCLUDED.observation_ids;

  -- Pós-atendimento (1h depois de end_at se o usuário não registrou)
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id,
    'post_event_register_prompt',
    e.id,
    COALESCE(e.end_at, e.start_at) + INTERVAL '1 hour',
    'Como foi ' || e.title || '?',
    '/painel?prefillFromEvent=' || e.id
  FROM public.agenda_events e
  JOIN public.agenda_notification_prefs p ON p.user_id = e.user_id
  WHERE e.status = 'upcoming'
    AND p.post_event_register = true
    AND COALESCE(e.end_at, e.start_at) + INTERVAL '1 hour' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- Limpeza: remove notificações de eventos cancelados/perdidos
  DELETE FROM public.agenda_notifications n
  WHERE EXISTS (
    SELECT 1 FROM public.agenda_events e
    WHERE e.id = n.event_id AND e.status IN ('missed', 'rescheduled')
  );

  -- Limpeza: notificações antigas (>30 dias) já lidas
  DELETE FROM public.agenda_notifications
  WHERE read_at IS NOT NULL AND read_at < now() - INTERVAL '30 days';
END;
$$;

-- ====== Cron: roda a cada 5 minutos =========================================
-- Requer extensão pg_cron habilitada no projeto Supabase.
-- (Habilitação manual no Dashboard → Database → Extensions → pg_cron)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'agenda-notifications-scheduler',
      '*/5 * * * *',
      'SELECT public.schedule_agenda_notifications();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Se pg_cron não estiver habilitado, ignora silenciosamente.
  -- O hook pode ser invocado manualmente via RPC ou Edge Function.
  NULL;
END $$;

-- ============================================================================
-- Notas:
-- 1. Em produção, habilite pg_cron via Dashboard se ainda não estiver.
-- 2. A função schedule_agenda_notifications() é SECURITY DEFINER para poder
--    inserir em agenda_notifications mesmo sem session de usuário.
-- 3. A constraint UNIQUE NULLS NOT DISTINCT exige Postgres 15+ (Supabase usa).
-- 4. Edge Function /functions/v1/agenda-scheduler também pode ser usada
--    como bridge externa (webhook / vercel cron) chamando esta função.
-- ============================================================================
