-- Adiciona terms_accepted_at para rastrear aceite de termos (LGPD Art. 8°).
-- Necessário para o fluxo de login via Google, onde o aceite ocorre na
-- tela /completar-perfil em vez do formulário de cadastro.
--
-- Usuários existentes (que aceitaram via formulário de signup) recebem
-- terms_accepted_at = created_at retroativamente.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- Backfill: todos os perfis existentes passaram pelo formulário de cadastro
-- que exige aceite de termos — registramos a data de criação como proxy.
UPDATE public.profiles
SET terms_accepted_at = created_at
WHERE terms_accepted_at IS NULL;

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Data em que o usuário aceitou os Termos de Uso e Política de Privacidade. NULL = ainda não aceitou (usuários OAuth novos).';
