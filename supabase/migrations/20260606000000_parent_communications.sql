-- Tabela de recados diretos do terapeuta para os responsáveis de um paciente.
-- Visíveis a todos os responsáveis com vínculo ativo para aquela criança.

CREATE TABLE IF NOT EXISTS parent_communications (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id     UUID        NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 3000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE parent_communications ENABLE ROW LEVEL SECURITY;

-- Terapeuta: acesso total aos seus próprios recados
CREATE POLICY "therapist_own_communications" ON parent_communications
  FOR ALL TO authenticated
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

-- Pais/responsáveis: leitura via função de acesso ativo
CREATE POLICY "parents_read_communications" ON parent_communications
  FOR SELECT TO authenticated
  USING (has_therapist_parent_access(child_id));

-- Índice para queries por criança + terapeuta
CREATE INDEX IF NOT EXISTS parent_communications_child_therapist_idx
  ON parent_communications(child_id, therapist_id, created_at DESC);
