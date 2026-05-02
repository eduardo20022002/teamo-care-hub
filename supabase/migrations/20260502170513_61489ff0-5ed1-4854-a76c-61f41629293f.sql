CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES public.professionals(id) ON DELETE SET NULL,
  professional_name text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  record_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_user_date ON public.attendance_records (user_id, record_date DESC);
CREATE INDEX idx_attendance_child ON public.attendance_records (child_id);
CREATE INDEX idx_attendance_professional ON public.attendance_records (professional_id);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_records_select_own ON public.attendance_records
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY attendance_records_insert_own ON public.attendance_records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY attendance_records_update_own ON public.attendance_records
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY attendance_records_delete_own ON public.attendance_records
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();