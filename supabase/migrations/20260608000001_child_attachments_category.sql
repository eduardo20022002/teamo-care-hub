-- Adiciona colunas de categoria aos anexos de crianças
-- RLS: sem alteração (policies existentes cobrem por user_id/child_id)

ALTER TABLE public.child_attachments
  ADD COLUMN IF NOT EXISTS category              TEXT,
  ADD COLUMN IF NOT EXISTS category_description  TEXT;
