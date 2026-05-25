-- Campos adicionais do perfil do cuidador
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS birth_date   date;

-- Relação do cuidador com cada criança cadastrada (ex: Pai, Mãe, Avô, Cuidador)
ALTER TABLE children
  ADD COLUMN IF NOT EXISTS relation     text;
