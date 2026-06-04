-- ============================================================================
-- TEAmo · Lembretes de sessão para o responsável
-- Permite que o pai/responsável ative lembretes (1 dia / 1 hora antes) em
-- sessões criadas pelo terapeuta — eventos que ele NÃO possui e não pode editar.
-- O scheduler passa a emitir notificações para o user_id do responsável.
-- ============================================================================

-- ====== Tabela parent_event_reminders =======================================
CREATE TABLE IF NOT EXISTS public.parent_event_reminders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  one_day_before  BOOLEAN     NOT NULL DEFAULT false,
  one_hour_before BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, event_id)
);

CREATE INDEX IF NOT EXISTS parent_event_reminders_event_idx
  ON public.parent_event_reminders(event_id);

ALTER TABLE public.parent_event_reminders ENABLE ROW LEVEL SECURITY;

-- O responsável gerencia apenas os próprios lembretes.
DO $$ BEGIN
  CREATE POLICY "parent_event_reminders_own" ON public.parent_event_reminders
    FOR ALL TO authenticated
    USING (parent_id = auth.uid())
    WITH CHECK (parent_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ====== Scheduler: emite notificações também para o responsável =============
-- Recria schedule_agenda_notifications() incluindo dois novos blocos que
-- materializam lembretes do responsável (parent_event_reminders) para sessões
-- do terapeuta às quais ele tem acesso ativo (therapist_parent_access).
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
  -- 1 dia antes (dono do evento)
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id, 'event_one_day_before', e.id,
    e.start_at - INTERVAL '24 hours',
    'Amanhã · ' || e.title, '/agenda/' || e.id
  FROM public.agenda_events e
  JOIN public.agenda_notification_prefs p ON p.user_id = e.user_id
  WHERE e.status = 'upcoming'
    AND p.one_day_before = true
    AND (e.reminders->>'oneDayBefore')::boolean = true
    AND e.start_at - INTERVAL '24 hours' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- 1 hora antes (dono do evento)
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id, 'event_one_hour_before', e.id,
    e.start_at - INTERVAL '1 hour',
    'Em 1 hora · ' || e.title, '/agenda/' || e.id
  FROM public.agenda_events e
  JOIN public.agenda_notification_prefs p ON p.user_id = e.user_id
  WHERE e.status = 'upcoming'
    AND p.one_hour_before = true
    AND (e.reminders->>'oneHourBefore')::boolean = true
    AND e.start_at - INTERVAL '1 hour' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- 1 dia antes (RESPONSÁVEL — sessão do terapeuta)
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    r.parent_id, 'event_one_day_before', e.id,
    e.start_at - INTERVAL '24 hours',
    'Amanhã · ' || e.title, '/agenda/' || e.id
  FROM public.agenda_events e
  JOIN public.parent_event_reminders r ON r.event_id = e.id
  JOIN public.therapist_parent_access tpa
    ON tpa.parent_id = r.parent_id
   AND tpa.child_id  = e.child_id
   AND tpa.status    = 'active'
  WHERE e.status = 'upcoming'
    AND e.therapist_id IS NOT NULL
    AND r.one_day_before = true
    AND e.start_at - INTERVAL '24 hours' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- 1 hora antes (RESPONSÁVEL — sessão do terapeuta)
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    r.parent_id, 'event_one_hour_before', e.id,
    e.start_at - INTERVAL '1 hour',
    'Em 1 hora · ' || e.title, '/agenda/' || e.id
  FROM public.agenda_events e
  JOIN public.parent_event_reminders r ON r.event_id = e.id
  JOIN public.therapist_parent_access tpa
    ON tpa.parent_id = r.parent_id
   AND tpa.child_id  = e.child_id
   AND tpa.status    = 'active'
  WHERE e.status = 'upcoming'
    AND e.therapist_id IS NOT NULL
    AND r.one_hour_before = true
    AND e.start_at - INTERVAL '1 hour' BETWEEN v_now AND v_horizon
  ON CONFLICT (user_id, kind, event_id)
  DO UPDATE SET fire_at = EXCLUDED.fire_at, body = EXCLUDED.body;

  -- Medicação no horário (tipo = 'medicacao')
  INSERT INTO public.agenda_notifications
    (user_id, kind, event_id, fire_at, body, deep_link)
  SELECT
    e.user_id, 'medication_due', e.id, e.start_at,
    'Hora da medicação · ' || e.title, '/agenda/' || e.id
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
    e.user_id, 'pending_observations', e.id,
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
    e.user_id, 'post_event_register_prompt', e.id,
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
