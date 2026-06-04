-- Fix: RLS de marcos/metas para responsáveis conectados via terapeuta
-- Os pais acessam pacientes do terapeuta via has_therapist_parent_access(),
-- não via children.user_id (que aponta para o terapeuta, não para o pai).

-- ─── therapeutic_milestones ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parents_read_shared_milestones" ON therapeutic_milestones;

CREATE POLICY "parents_read_shared_milestones" ON therapeutic_milestones
  FOR SELECT TO authenticated
  USING (
    is_shared_with_parents = true
    AND (
      -- Filho cadastrado pelos próprios pais
      EXISTS (
        SELECT 1 FROM children
        WHERE children.id = therapeutic_milestones.child_id
          AND children.user_id = auth.uid()
      )
      OR
      -- Paciente do terapeuta, acessado via convite aceito
      has_therapist_parent_access(therapeutic_milestones.child_id)
    )
  );

-- ─── milestone_goals ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parents_read_goals" ON milestone_goals;

CREATE POLICY "parents_read_goals" ON milestone_goals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM therapeutic_milestones tm
      WHERE tm.id = milestone_goals.milestone_id
        AND tm.is_shared_with_parents = true
    )
    AND (
      EXISTS (
        SELECT 1 FROM children
        WHERE children.id = milestone_goals.child_id
          AND children.user_id = auth.uid()
      )
      OR
      has_therapist_parent_access(milestone_goals.child_id)
    )
  );
