-- Tabela record_attachments
CREATE TABLE public.record_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  record_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_record_attachments_record ON public.record_attachments(record_id);
CREATE INDEX idx_record_attachments_user ON public.record_attachments(user_id, created_at DESC);

ALTER TABLE public.record_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY record_attachments_select_own ON public.record_attachments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY record_attachments_insert_own ON public.record_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY record_attachments_update_own ON public.record_attachments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY record_attachments_delete_own ON public.record_attachments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Tabela child_attachments
CREATE TABLE public.child_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_child_attachments_child ON public.child_attachments(child_id);
CREATE INDEX idx_child_attachments_user ON public.child_attachments(user_id, created_at DESC);

ALTER TABLE public.child_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY child_attachments_select_own ON public.child_attachments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY child_attachments_insert_own ON public.child_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY child_attachments_update_own ON public.child_attachments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY child_attachments_delete_own ON public.child_attachments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Bucket privado para anexos
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage: caminho deve começar com {user_id}/...
-- Path layout: records/{user_id}/{record_id}/{file} ou children/{user_id}/{child_id}/{file}
-- portanto (storage.foldername(name))[2] = auth.uid()::text
CREATE POLICY "attachments_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "attachments_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "attachments_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "attachments_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );