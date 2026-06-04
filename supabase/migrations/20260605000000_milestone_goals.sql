-- Metas terapêuticas: sub-objetivos de cada marco de desenvolvimento.
-- Progresso derivado dos session_records.goals_achieved (JSONB).
CREATE TABLE milestone_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    uuid NOT NULL REFERENCES therapeutic_milestones(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  therapist_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description     text CHECK (length(description) <= 500),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE milestone_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_own_goals" ON milestone_goals
  FOR ALL TO authenticated USING (therapist_id = auth.uid());

CREATE POLICY "parents_read_goals" ON milestone_goals
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM therapeutic_milestones tm
      WHERE tm.id = milestone_goals.milestone_id
        AND tm.is_shared_with_parents = true
      ) AND
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = milestone_goals.child_id
        AND children.user_id = auth.uid()
    )
  );

CREATE INDEX idx_mg_milestone ON milestone_goals(milestone_id);
CREATE INDEX idx_mg_child     ON milestone_goals(child_id);
CREATE INDEX idx_mg_therapist ON milestone_goals(therapist_id);
