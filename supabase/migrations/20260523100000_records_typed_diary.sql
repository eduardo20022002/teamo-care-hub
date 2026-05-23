-- =============================================================================
-- 20260523100000_records_typed_diary.sql
-- Extends attendance_records with typed diary fields for parent/caregiver journal.
-- All new columns are nullable to preserve backward-compat with existing records.
-- =============================================================================

-- record_type: the 7 diary entry types
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS record_type text,
  ADD COLUMN IF NOT EXISTS shift       text,
  ADD COLUMN IF NOT EXISTS title       varchar(200),
  ADD COLUMN IF NOT EXISTS type_data   jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Check constraint for record_type
DO $$ BEGIN
  ALTER TABLE public.attendance_records
    ADD CONSTRAINT chk_record_type CHECK (
      record_type IS NULL OR record_type IN (
        'comportamento','conquista','sono','saude','alimentacao','sensorial','livre'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Check constraint for shift
DO $$ BEGIN
  ALTER TABLE public.attendance_records
    ADD CONSTRAINT chk_shift CHECK (
      shift IS NULL OR shift IN ('manha','tarde','noite','madrugada')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index for fast type-based filtering
CREATE INDEX IF NOT EXISTS idx_attendance_record_type
  ON public.attendance_records(user_id, record_type)
  WHERE record_type IS NOT NULL;

-- GIN index for querying type_data (future analytics)
CREATE INDEX IF NOT EXISTS idx_attendance_type_data_gin
  ON public.attendance_records USING gin(type_data)
  WHERE type_data != '{}'::jsonb;
