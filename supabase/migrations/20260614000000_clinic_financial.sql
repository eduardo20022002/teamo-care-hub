-- Fase 5: Módulo Financeiro e Convênios
-- insurance_authorizations + clinic_payment_records + FK em clinic_sessions + trigger de cota

-- ─── Adiciona FK de clinic_sessions para insurance_authorizations (prevista Fase 3) ───
-- A coluna já existe (sem FK); adicionamos a constraint agora.
-- Precisamos criar a tabela insurance_authorizations antes de adicionar a FK.

-- ─── Tabela: insurance_authorizations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS insurance_authorizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_profile_id  uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
  insurance_plan      text NOT NULL,
  authorization_number text NOT NULL,
  valid_from          date NOT NULL,
  valid_until         date NOT NULL,
  sessions_authorized int NOT NULL,
  sessions_used       int NOT NULL DEFAULT 0,
  sessions_remaining  int GENERATED ALWAYS AS (sessions_authorized - sessions_used) STORED,
  status              text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa','vencendo','vencida','renovacao_em_andamento','encerrada')),
  archived            boolean NOT NULL DEFAULT false,
  notes               text,
  created_by          uuid NOT NULL REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Histórico imutável: proibir DELETE via RLS (sem política DELETE)
ALTER TABLE insurance_authorizations ENABLE ROW LEVEL SECURITY;

-- Apenas coordenador da clínica tem acesso
CREATE POLICY "insurance_authorizations_coordinator_all"
  ON insurance_authorizations
  FOR ALL
  USING (is_clinic_coordinator(clinic_id));

-- ─── Tabela: clinic_payment_records ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_payment_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_profile_id  uuid NOT NULL REFERENCES patient_profiles(id) ON DELETE RESTRICT,
  payment_type        text NOT NULL CHECK (payment_type IN ('convenio','particular','misto')),
  reference_month     date NOT NULL,
  amount_cents        int,
  status              text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','pago','em_atraso')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinic_payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_payment_records_coordinator_all"
  ON clinic_payment_records
  FOR ALL
  USING (is_clinic_coordinator(clinic_id));

-- ─── FK de clinic_sessions.insurance_authorization_id ────────────────────────────────
-- A coluna já existe como uuid sem FK (criada na Fase 3). Adicionamos a constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'clinic_sessions_insurance_authorization_id_fkey'
      AND table_name = 'clinic_sessions'
  ) THEN
    ALTER TABLE clinic_sessions
      ADD CONSTRAINT clinic_sessions_insurance_authorization_id_fkey
      FOREIGN KEY (insurance_authorization_id)
      REFERENCES insurance_authorizations(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- ─── Trigger: decrementa cota quando sessão é marcada como 'realizada' ────────────────
CREATE OR REPLACE FUNCTION decrement_insurance_quota()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Só age quando muda para 'realizada' E havia authorization vinculada
  IF NEW.status = 'realizada'
    AND (OLD.status IS DISTINCT FROM 'realizada')
    AND NEW.insurance_authorization_id IS NOT NULL
  THEN
    UPDATE insurance_authorizations
    SET sessions_used = sessions_used + 1,
        updated_at    = now()
    WHERE id = NEW.insurance_authorization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_insurance_quota ON clinic_sessions;
CREATE TRIGGER trg_decrement_insurance_quota
  AFTER UPDATE OF status ON clinic_sessions
  FOR EACH ROW EXECUTE FUNCTION decrement_insurance_quota();

-- ─── Índices ──────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_insurance_auth_clinic_id
  ON insurance_authorizations(clinic_id);

CREATE INDEX IF NOT EXISTS idx_insurance_auth_patient_profile_id
  ON insurance_authorizations(patient_profile_id);

CREATE INDEX IF NOT EXISTS idx_insurance_auth_valid_until
  ON insurance_authorizations(valid_until);

CREATE INDEX IF NOT EXISTS idx_payment_records_clinic_id
  ON clinic_payment_records(clinic_id);

CREATE INDEX IF NOT EXISTS idx_payment_records_patient_profile_id
  ON clinic_payment_records(patient_profile_id);
