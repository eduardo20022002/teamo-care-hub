-- ─── Fix: Form 1 falhava ao enviar (fila de espera) ─────────────────────────
--
-- BUG: a função calculate_queue_priority() rodava como BEFORE INSERT e, dentro
-- dela, inseria uma linha em queue_history referenciando NEW.id. No momento do
-- BEFORE INSERT a linha em queue_entries AINDA NÃO EXISTE, então o INSERT em
-- queue_history violava a foreign key queue_history.entry_id → queue_entries(id)
-- e abortava a transação inteira. Resultado: nenhuma submissão do Form 1 público
-- jamais foi persistida (queue_entries ficou com 0 linhas).
--
-- FIX: separar responsabilidades em dois triggers —
--   1. BEFORE INSERT/UPDATE  → calcula priority_score/priority_tier (altera NEW)
--   2. AFTER  INSERT/UPDATE  → grava o histórico (a linha-pai já existe → FK ok)
--
-- A lógica de cálculo é idêntica à original; apenas removemos o INSERT de
-- histórico da função BEFORE e o recriamos numa função AFTER dedicada.

-- ===========================================================================
-- 1. Função BEFORE: apenas cálculo (sem gravar histórico)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.calculate_queue_priority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight_a    numeric;
  v_weight_b    numeric;
  v_weight_c    numeric;
  v_weight_time numeric;
  v_tier_alta   numeric;
  v_tier_mod    numeric;

  v_score_a     numeric := 0;
  v_score_b     numeric := 0;
  v_score_c     numeric := 0;
  v_score_time  numeric := 0;
  v_total_score numeric := 0;
  v_new_tier    text;
  v_days_in_queue numeric;

  v_sem_servico    boolean;
  v_diag_recente   boolean;
  v_idade_critica  boolean;

  v_comportamento  boolean;
  v_gravidade      text;

  v_renda_baixa    boolean;
  v_resp_solo      boolean;
  v_distancia_km   int;
BEGIN
  SELECT
    COALESCE(weight_factor_a, 40),
    COALESCE(weight_factor_b, 35),
    COALESCE(weight_factor_c, 15),
    COALESCE(weight_time,     10),
    COALESCE(tier_alta_min,   70),
    COALESCE(tier_moderada_min, 40)
  INTO v_weight_a, v_weight_b, v_weight_c, v_weight_time, v_tier_alta, v_tier_mod
  FROM public.queue_priority_config
  WHERE clinic_id = NEW.clinic_id;

  IF NOT FOUND THEN
    v_weight_a := 40; v_weight_b := 35; v_weight_c := 15; v_weight_time := 10;
    v_tier_alta := 70; v_tier_mod := 40;
  END IF;

  -- Fator A (urgência clínica)
  v_sem_servico   := COALESCE((NEW.factor_a->>'sem_servico_atual')::boolean, false);
  v_diag_recente  := COALESCE((NEW.factor_a->>'diagnose_recente')::boolean, false);
  v_idade_critica := COALESCE((NEW.factor_a->>'idade_critica')::boolean, false);

  v_score_a := (
    CASE WHEN v_sem_servico   THEN 40 ELSE 0 END +
    CASE WHEN v_diag_recente  THEN 35 ELSE 0 END +
    CASE WHEN v_idade_critica THEN 25 ELSE 0 END
  );

  -- Fator B (comportamento desafio)
  v_comportamento := COALESCE((NEW.factor_b->>'comportamento_desafio')::boolean, false);
  v_gravidade     := COALESCE(NEW.factor_b->>'gravidade', 'leve');

  IF v_comportamento THEN
    v_score_b := CASE v_gravidade
      WHEN 'grave'    THEN 100
      WHEN 'moderado' THEN 66
      ELSE                 33
    END;
  ELSE
    v_score_b := 0;
  END IF;

  -- Fator C (vulnerabilidade socioeconômica)
  v_renda_baixa  := COALESCE((NEW.factor_c->>'renda_baixa')::boolean, false);
  v_resp_solo    := COALESCE((NEW.factor_c->>'responsavel_solo')::boolean, false);
  v_distancia_km := COALESCE((NEW.factor_c->>'distancia_km')::int, 0);

  v_score_c := (
    CASE WHEN v_renda_baixa THEN 50 ELSE 0 END +
    CASE WHEN v_resp_solo   THEN 30 ELSE 0 END +
    CASE WHEN v_distancia_km > 30 THEN 20 ELSE 0 END
  );

  -- Modificador de tempo
  v_days_in_queue := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 86400;
  v_score_time := LEAST(v_days_in_queue / 180.0 * 100, 100);

  -- Score total (média ponderada)
  v_total_score := (
    v_score_a * v_weight_a +
    v_score_b * v_weight_b +
    v_score_c * v_weight_c +
    v_score_time * v_weight_time
  ) / GREATEST(v_weight_a + v_weight_b + v_weight_c + v_weight_time, 1);

  v_total_score := ROUND(v_total_score, 2);

  v_new_tier := CASE
    WHEN v_total_score >= v_tier_alta THEN 'alta'
    WHEN v_total_score >= v_tier_mod  THEN 'moderada'
    ELSE                                   'rotina'
  END;

  NEW.priority_score := v_total_score;
  NEW.priority_tier  := v_new_tier;
  NEW.updated_at     := now();

  RETURN NEW;
END;
$$;

-- ===========================================================================
-- 2. Função AFTER: grava histórico (linha-pai já existe → FK satisfeita)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.record_queue_priority_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.queue_history (
      entry_id, clinic_id, changed_by, change_type,
      old_tier, new_tier, old_score, new_score
    ) VALUES (
      NEW.id, NEW.clinic_id, NULL, 'score_recalc',
      NULL, NEW.priority_tier, NULL, NEW.priority_score
    );
  ELSIF TG_OP = 'UPDATE' AND (
    OLD.priority_score IS DISTINCT FROM NEW.priority_score OR
    OLD.priority_tier  IS DISTINCT FROM NEW.priority_tier
  ) THEN
    INSERT INTO public.queue_history (
      entry_id, clinic_id, changed_by, change_type,
      old_tier, new_tier, old_score, new_score
    ) VALUES (
      NEW.id, NEW.clinic_id, NULL, 'score_recalc',
      OLD.priority_tier, NEW.priority_tier,
      OLD.priority_score, NEW.priority_score
    );
  END IF;

  RETURN NULL; -- AFTER trigger: valor de retorno é ignorado
END;
$$;

-- ===========================================================================
-- 3. Recriar triggers: BEFORE (cálculo) + AFTER (histórico)
-- ===========================================================================

DROP TRIGGER IF EXISTS queue_entries_priority_trigger ON public.queue_entries;

CREATE TRIGGER queue_entries_priority_trigger
  BEFORE INSERT OR UPDATE OF factor_a, factor_b, factor_c, created_at
  ON public.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_queue_priority();

CREATE TRIGGER queue_entries_priority_history_trigger
  AFTER INSERT OR UPDATE OF factor_a, factor_b, factor_c, created_at
  ON public.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.record_queue_priority_history();
