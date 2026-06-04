-- Coluna para rastrear quando o pai/responsável celebrou (viu o overlay) um marco atingido
-- NULL = ainda não viu / não celebrou; preenchido = já celebrou e não deve mostrar novamente

ALTER TABLE therapeutic_milestones
  ADD COLUMN IF NOT EXISTS parent_celebrated_at timestamptz;

-- Política de UPDATE para que o pai possa marcar a coluna parent_celebrated_at
-- (apenas para marcos de crianças às quais tem acesso ativo)
CREATE POLICY "parent can mark celebration seen"
  ON therapeutic_milestones
  FOR UPDATE
  USING (has_therapist_parent_access(child_id))
  WITH CHECK (has_therapist_parent_access(child_id));
