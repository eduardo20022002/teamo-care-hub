-- Tabela de marcos de desenvolvimento terapêuticos
CREATE TABLE therapeutic_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description     text CHECK (length(description) <= 500),
  area            text NOT NULL CHECK (area IN (
                    'comunicacao', 'socializacao', 'autonomia',
                    'comportamento', 'cognicao', 'motricidade'
                  )),
  status          text NOT NULL DEFAULT 'em_progresso'
                  CHECK (status IN ('em_progresso', 'atingido', 'pausado')),
  is_shared_with_parents boolean NOT NULL DEFAULT true,
  started_at      timestamptz NOT NULL DEFAULT now(),
  achieved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- achieved_at só pode ser preenchido quando status = 'atingido'
ALTER TABLE therapeutic_milestones
  ADD CONSTRAINT chk_achieved_at CHECK (
    (status = 'atingido' AND achieved_at IS NOT NULL) OR
    (status != 'atingido' AND achieved_at IS NULL)
  );

-- RLS
ALTER TABLE therapeutic_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_own_milestones" ON therapeutic_milestones
  FOR ALL TO authenticated
  USING (therapist_id = auth.uid());

CREATE POLICY "parents_read_shared_milestones" ON therapeutic_milestones
  FOR SELECT TO authenticated
  USING (
    is_shared_with_parents = true
    AND EXISTS (
      SELECT 1 FROM children
      WHERE children.id = therapeutic_milestones.child_id
        AND children.user_id = auth.uid()
    )
  );

-- Índices
CREATE INDEX idx_milestones_child      ON therapeutic_milestones(child_id);
CREATE INDEX idx_milestones_therapist  ON therapeutic_milestones(therapist_id);
CREATE INDEX idx_milestones_area       ON therapeutic_milestones(child_id, area);
