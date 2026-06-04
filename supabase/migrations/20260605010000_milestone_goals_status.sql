-- Adiciona status e data de conquista às metas terapêuticas.
-- Hierarquia: objetivos de sessão → informam → meta → informa → marco.
ALTER TABLE milestone_goals
  ADD COLUMN status      text NOT NULL DEFAULT 'em_progresso'
    CHECK (status IN ('em_progresso', 'atingido')),
  ADD COLUMN achieved_at timestamptz;

ALTER TABLE milestone_goals ADD CONSTRAINT chk_goal_achieved_at CHECK (
  (status = 'atingido' AND achieved_at IS NOT NULL) OR
  (status = 'em_progresso' AND achieved_at IS NULL)
);
