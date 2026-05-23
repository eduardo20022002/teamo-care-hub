-- ─────────────────────────────────────────────────────────────────────────────
-- Feedback de usuários (RF-admin)
-- Usuários autenticados podem inserir feedback; apenas o admin pode ler.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Adiciona is_admin à tabela profiles (default false, nunca alterado pelo app)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_admin IS
  'Flag de administrador. Definido manualmente via SQL. Nunca alterado pelo app ou por RLS.';

-- 2. Tabela de feedback
CREATE TABLE public.feedback (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     smallint    NOT NULL CHECK (rating IN (1, 2, 3)),
  message    text        CHECK (char_length(message) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- rating: 1 = 😔 Difícil | 2 = 😊 Ok | 3 = 🤩 Incrível
-- O e-mail do usuário NÃO é persistido aqui (minimização LGPD).
-- É buscado em runtime via supabaseAdmin.auth.admin.getUserById() apenas para
-- notificação ao admin e exibição na lista — nunca armazenado.

COMMENT ON TABLE public.feedback IS
  'Feedback dos usuários. Append-only. Somente admin pode ler. E-mail não armazenado (LGPD).';

CREATE INDEX feedback_created_at_idx ON public.feedback(created_at DESC);
CREATE INDEX feedback_user_id_idx    ON public.feedback(user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados: INSERT apenas do próprio feedback
CREATE POLICY "feedback_insert_own"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Somente admin pode fazer SELECT (via flag is_admin em profiles)
CREATE POLICY "feedback_select_admin"
  ON public.feedback
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND is_admin = true
    )
  );

-- Append-only: bloqueia UPDATE e DELETE para o papel authenticated
REVOKE UPDATE, DELETE ON public.feedback FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASSO MANUAL (rodar UMA VEZ no SQL editor do Supabase após o deploy):
--
--   UPDATE public.profiles
--   SET is_admin = true
--   WHERE email = 'eduardo.meirelles@ufpe.br';
--
-- Não incluído nesta migration para evitar hardcode de dados pessoais em
-- arquivos de controle de versão.
-- ─────────────────────────────────────────────────────────────────────────────
