-- Agenda: suporte a séries (recorrência materializada para eventos de pais).
-- Cada ocorrência/dose materializada compartilha o mesmo series_id, permitindo
-- "excluir/editar esta e as próximas" e o top-up de séries indefinidas.
--
-- Não há nova política de RLS: agenda_events já restringe por user_id = auth.uid().

ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS series_id UUID;

CREATE INDEX IF NOT EXISTS idx_agenda_events_series_id
  ON public.agenda_events(series_id)
  WHERE series_id IS NOT NULL;

COMMENT ON COLUMN public.agenda_events.series_id IS
  'Agrupa ocorrências/doses materializadas de uma mesma recorrência. NULL para eventos avulsos.';
