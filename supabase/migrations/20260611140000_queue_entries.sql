-- ─── Fase 2 — Módulo de Fila de Espera ──────────────────────────────────────
-- Cria queue_entries, queue_priority_config, queue_history.
-- Adiciona coluna slug à tabela clinics.
-- Todas as tabelas com RLS ativo antes do primeiro INSERT.
-- Trigger de priorização automática em queue_entries.

-- ===========================================================================
-- 1. ADD COLUMN slug à tabela clinics
-- ===========================================================================

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS slug text;

-- Índice único para slug (permite NULL para clínicas ainda sem slug)
CREATE UNIQUE INDEX IF NOT EXISTS clinics_slug_unique ON public.clinics (slug)
  WHERE slug IS NOT NULL;

-- ===========================================================================
-- 2. Tabela: queue_entries
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.queue_entries (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,

  -- Dados da criança
  child_name            text        NOT NULL CHECK (length(child_name) BETWEEN 1 AND 200),
  child_birthdate       date        NOT NULL,
  child_diagnosis       text,
  child_cid             text,

  -- Fatores de priorização
  factor_a              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  factor_b              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  factor_c              jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Modalidades de interesse
  modalidades           text[]      NOT NULL DEFAULT ARRAY[]::text[],

  -- Disponibilidade de horários
  disponibilidade       jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Contato do responsável
  responsavel_nome      text        NOT NULL CHECK (length(responsavel_nome) BETWEEN 1 AND 200),
  responsavel_email     text        NOT NULL CHECK (responsavel_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  responsavel_telefone  text,

  -- Priorização calculada pelo trigger
  priority_score        numeric     NOT NULL DEFAULT 0,
  priority_tier         text        NOT NULL DEFAULT 'triagem'
                          CHECK (priority_tier IN ('alta','moderada','rotina','triagem')),

  -- Estado do caso
  status                text        NOT NULL DEFAULT 'aguardando'
                          CHECK (status IN ('aguardando','em_avaliacao','agendado','inativo')),

  -- Auditoria
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS queue_entries_clinic_id_idx ON public.queue_entries (clinic_id);
CREATE INDEX IF NOT EXISTS queue_entries_clinic_tier_idx ON public.queue_entries (clinic_id, priority_tier);
CREATE INDEX IF NOT EXISTS queue_entries_clinic_status_idx ON public.queue_entries (clinic_id, status);

-- ===========================================================================
-- 3. Tabela: queue_priority_config
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.queue_priority_config (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         uuid    NOT NULL UNIQUE REFERENCES public.clinics(id) ON DELETE CASCADE,
  weight_factor_a   numeric NOT NULL DEFAULT 40,
  weight_factor_b   numeric NOT NULL DEFAULT 35,
  weight_factor_c   numeric NOT NULL DEFAULT 15,
  weight_time       numeric NOT NULL DEFAULT 10,
  tier_alta_min     numeric NOT NULL DEFAULT 70,
  tier_moderada_min numeric NOT NULL DEFAULT 40,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_priority_config ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- 4. Tabela: queue_history
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.queue_history (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     uuid        NOT NULL REFERENCES public.queue_entries(id) ON DELETE CASCADE,
  clinic_id    uuid        NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  changed_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  change_type  text        NOT NULL CHECK (change_type IN ('score_recalc','tier_manual','status_change')),
  old_tier     text,
  new_tier     text,
  old_score    numeric,
  new_score    numeric,
  justificativa text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS queue_history_entry_id_idx ON public.queue_history (entry_id);
CREATE INDEX IF NOT EXISTS queue_history_clinic_id_idx ON public.queue_history (clinic_id);

-- ===========================================================================
-- 5. Função: cálculo de priority_score e priority_tier (trigger)
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

  -- Factor A fields
  v_sem_servico    boolean;
  v_diag_recente   boolean;
  v_idade_critica  boolean;

  -- Factor B fields
  v_comportamento  boolean;
  v_gravidade      text;

  -- Factor C fields
  v_renda_baixa    boolean;
  v_resp_solo      boolean;
  v_distancia_km   int;
BEGIN
  -- Carregar configuração da clínica (ou usar defaults)
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

  -- Se não existe config, usar defaults
  IF NOT FOUND THEN
    v_weight_a := 40; v_weight_b := 35; v_weight_c := 15; v_weight_time := 10;
    v_tier_alta := 70; v_tier_mod := 40;
  END IF;

  -- ── Fator A (urgência clínica) ──
  v_sem_servico   := COALESCE((NEW.factor_a->>'sem_servico_atual')::boolean, false);
  v_diag_recente  := COALESCE((NEW.factor_a->>'diagnose_recente')::boolean, false);
  v_idade_critica := COALESCE((NEW.factor_a->>'idade_critica')::boolean, false);

  -- Score A: pesos por campo, normalizado para 0-100
  -- sem_servico = 40%, diagnose_recente = 35%, idade_critica = 25%
  v_score_a := (
    CASE WHEN v_sem_servico   THEN 40 ELSE 0 END +
    CASE WHEN v_diag_recente  THEN 35 ELSE 0 END +
    CASE WHEN v_idade_critica THEN 25 ELSE 0 END
  );

  -- ── Fator B (comportamento desafio) ──
  v_comportamento := COALESCE((NEW.factor_b->>'comportamento_desafio')::boolean, false);
  v_gravidade     := COALESCE(NEW.factor_b->>'gravidade', 'leve');

  IF v_comportamento THEN
    v_score_b := CASE v_gravidade
      WHEN 'grave'    THEN 100
      WHEN 'moderado' THEN 66
      ELSE                 33  -- leve ou não especificado
    END;
  ELSE
    v_score_b := 0;
  END IF;

  -- ── Fator C (vulnerabilidade socioeconômica) ──
  v_renda_baixa  := COALESCE((NEW.factor_c->>'renda_baixa')::boolean, false);
  v_resp_solo    := COALESCE((NEW.factor_c->>'responsavel_solo')::boolean, false);
  v_distancia_km := COALESCE((NEW.factor_c->>'distancia_km')::int, 0);

  -- renda_baixa = 50%, resp_solo = 30%, distancia > 30km = 20%
  v_score_c := (
    CASE WHEN v_renda_baixa THEN 50 ELSE 0 END +
    CASE WHEN v_resp_solo   THEN 30 ELSE 0 END +
    CASE WHEN v_distancia_km > 30 THEN 20 ELSE 0 END
  );

  -- ── Modificador de tempo ──
  v_days_in_queue := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 86400;
  -- Score cresce até 100% em 180 dias
  v_score_time := LEAST(v_days_in_queue / 180.0 * 100, 100);

  -- ── Score total (média ponderada) ──
  v_total_score := (
    v_score_a * v_weight_a +
    v_score_b * v_weight_b +
    v_score_c * v_weight_c +
    v_score_time * v_weight_time
  ) / GREATEST(v_weight_a + v_weight_b + v_weight_c + v_weight_time, 1);

  v_total_score := ROUND(v_total_score, 2);

  -- ── Determinar tier ──
  v_new_tier := CASE
    WHEN v_total_score >= v_tier_alta THEN 'alta'
    WHEN v_total_score >= v_tier_mod  THEN 'moderada'
    ELSE                                   'rotina'
  END;

  -- Registrar histórico apenas se o score mudou (UPDATE) ou é INSERT
  IF TG_OP = 'UPDATE' AND (
    OLD.priority_score IS DISTINCT FROM v_total_score OR
    OLD.priority_tier  IS DISTINCT FROM v_new_tier
  ) THEN
    INSERT INTO public.queue_history (
      entry_id, clinic_id, changed_by, change_type,
      old_tier, new_tier, old_score, new_score
    ) VALUES (
      NEW.id, NEW.clinic_id, NULL, 'score_recalc',
      OLD.priority_tier, v_new_tier,
      OLD.priority_score, v_total_score
    );
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.queue_history (
      entry_id, clinic_id, changed_by, change_type,
      old_tier, new_tier, old_score, new_score
    ) VALUES (
      NEW.id, NEW.clinic_id, NULL, 'score_recalc',
      NULL, v_new_tier, NULL, v_total_score
    );
  END IF;

  NEW.priority_score := v_total_score;
  NEW.priority_tier  := v_new_tier;
  NEW.updated_at     := now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER queue_entries_priority_trigger
  BEFORE INSERT OR UPDATE OF factor_a, factor_b, factor_c, created_at
  ON public.queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_queue_priority();

-- Trigger de updated_at em queue_priority_config
CREATE OR REPLACE FUNCTION public.update_queue_priority_config_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER queue_priority_config_updated_at
  BEFORE UPDATE ON public.queue_priority_config
  FOR EACH ROW EXECUTE FUNCTION public.update_queue_priority_config_updated_at();

-- ===========================================================================
-- 6. RLS — queue_entries
-- ===========================================================================

-- Membros da clínica lêem todas as entradas dela
CREATE POLICY "queue_entries_select_members" ON public.queue_entries
  FOR SELECT TO authenticated
  USING (is_clinic_member(clinic_id));

-- INSERT público (Form 1) — via supabaseAdmin (service_role bypassa RLS)
-- INSERT autenticado permitido para membros (cadastro direto)
CREATE POLICY "queue_entries_insert_members" ON public.queue_entries
  FOR INSERT TO authenticated
  WITH CHECK (is_clinic_member(clinic_id));

-- UPDATE apenas por membros
CREATE POLICY "queue_entries_update_members" ON public.queue_entries
  FOR UPDATE TO authenticated
  USING  (is_clinic_member(clinic_id))
  WITH CHECK (is_clinic_member(clinic_id));

-- DELETE apenas por coordinator
CREATE POLICY "queue_entries_delete_coordinator" ON public.queue_entries
  FOR DELETE TO authenticated
  USING (is_clinic_coordinator(clinic_id));

-- ===========================================================================
-- 7. RLS — queue_priority_config
-- ===========================================================================

CREATE POLICY "queue_priority_config_select_members" ON public.queue_priority_config
  FOR SELECT TO authenticated
  USING (is_clinic_member(clinic_id));

CREATE POLICY "queue_priority_config_upsert_coordinator" ON public.queue_priority_config
  FOR ALL TO authenticated
  USING  (is_clinic_coordinator(clinic_id))
  WITH CHECK (is_clinic_coordinator(clinic_id));

-- ===========================================================================
-- 8. RLS — queue_history
-- ===========================================================================

CREATE POLICY "queue_history_select_members" ON public.queue_history
  FOR SELECT TO authenticated
  USING (is_clinic_member(clinic_id));

-- INSERT é feito via trigger (SECURITY DEFINER) ou via service_role — sem policy de insert para authenticated
-- (history é imutável pela aplicação)
