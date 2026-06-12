-- LGPD L2 — Soft delete para dados financeiros de saúde
-- Dados financeiros de pacientes não devem ser hard-deleted conforme LGPD art. 16

ALTER TABLE insurance_authorizations
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE clinic_payment_records
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
