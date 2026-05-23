-- ============================================================================
-- TEAmo · Agenda — Personalização por tipo de compromisso
-- ----------------------------------------------------------------------------
-- 1. Renomeia o tipo 'medica' para 'consulta' (cobre qualquer profissional,
--    não só médico — neuropsicólogo, fono em avaliação, exame, etc).
-- 2. Adiciona coluna JSONB `type_data` para campos específicos de cada tipo
--    (medicação, terapia, consulta, escola, outro). A validação rígida do
--    shape ocorre na camada de aplicação (Zod). RLS herdada da linha.
-- 3. Adiciona `linked_event_id` para vincular o evento de retorno gerado
--    automaticamente quando a mãe marca "Retorno já agendado?" numa consulta.
-- 4. Estende o set de valores aceitos em recurrence.freq para suportar a
--    linguagem natural pedida no design ("Todo dia", "A cada X dias",
--    "Toda semana mesmo horário", "Quinzenal", "Intensivo", etc).
--    O shape continua JSONB e a validação é feita no app.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Soltar o CHECK antigo do tipo
-- ---------------------------------------------------------------------------
ALTER TABLE public.agenda_events
  DROP CONSTRAINT IF EXISTS agenda_events_type_check;

-- ---------------------------------------------------------------------------
-- 2. Migrar dados existentes: 'medica' → 'consulta'
-- ---------------------------------------------------------------------------
UPDATE public.agenda_events
  SET type = 'consulta'
  WHERE type = 'medica';

-- ---------------------------------------------------------------------------
-- 3. Recriar o CHECK com o novo conjunto de tipos
-- ---------------------------------------------------------------------------
ALTER TABLE public.agenda_events
  ADD CONSTRAINT agenda_events_type_check
  CHECK (type IN ('terapia','consulta','escola','medicacao','outro'));

-- ---------------------------------------------------------------------------
-- 4. Coluna type_data — JSONB com campos específicos por tipo.
--
-- Shapes esperados (validados no app via Zod):
--
--   medicacao:
--     { medicationName: string, dose: { value:number, unit, customUnit? },
--       route: 'oral'|'sublingual'|'nasal'|'other', routeCustom?: string,
--       moment: 'fasting'|'with_food'|'bedtime'|'any'|'other',
--       momentCustom?: string, times: string[],
--       isContinuous: boolean, endsOn?: ISO date,
--       prescriptionExpiresOn?: ISO date, clinicalNotes?: string }
--
--   terapia:
--     { therapyType, therapyTypeCustom?, duration, durationCustom?,
--       hasContract: boolean, plannedSessions?: number,
--       reassessmentOn?: ISO date }
--
--   consulta:
--     { consultType, consultTypeCustom?, specialty, specialtyCustom?,
--       documentsChecklist: { id, label, done }[],
--       returnScheduled: boolean }
--
--   escola:
--     { eventType, eventTypeCustom?,
--       documentsChecklist: { id, label, done }[] }
--
--   outro:
--     { notes?: string }
-- ---------------------------------------------------------------------------
ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS type_data JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.agenda_events.type_data IS
  'Campos específicos por tipo de compromisso. Shape varia conforme agenda_events.type. Validado no app (Zod).';

-- ---------------------------------------------------------------------------
-- 5. linked_event_id — usado para amarrar o evento de retorno (consulta)
--    criado automaticamente. Soft FK (SET NULL) para preservar histórico
--    caso o evento principal seja apagado.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agenda_events
  ADD COLUMN IF NOT EXISTS linked_event_id UUID
  REFERENCES public.agenda_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.agenda_events.linked_event_id IS
  'Referência opcional a outro evento — usado para vincular um retorno (consulta) ao evento principal.';

CREATE INDEX IF NOT EXISTS idx_agenda_events_linked_event_id
  ON public.agenda_events(linked_event_id)
  WHERE linked_event_id IS NOT NULL;

COMMIT;
