-- Fase 6: Comunicação com a Família
-- Cria clinic_communications, expande clinic_form_tokens e adiciona FK em clinic_replacements.

-- ─── 1. Expandir form_type CHECK em clinic_form_tokens ───────────────────────
-- Adicionar 'confirmacao_clinica' como tipo válido para tokens de confirmação.
ALTER TABLE public.clinic_form_tokens
  DROP CONSTRAINT IF EXISTS clinic_form_tokens_form_type_check;

ALTER TABLE public.clinic_form_tokens
  ADD CONSTRAINT clinic_form_tokens_form_type_check
  CHECK (form_type IN ('form2_horario', 'form3_cadastro', 'confirmacao_clinica'));

-- ─── 2. Tornar queue_entry_id anulável em clinic_form_tokens ─────────────────
-- Tokens de confirmação de comunicações podem não ter queue_entry_id
-- (ex: autorizacao_vencendo vem de patient_profiles, não de queue_entries).
ALTER TABLE public.clinic_form_tokens
  ALTER COLUMN queue_entry_id DROP NOT NULL;

-- ─── 3. Criar tabela clinic_communications ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clinic_communications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id            uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_profile_id   uuid REFERENCES public.patient_profiles(id) ON DELETE SET NULL,
  queue_entry_id       uuid REFERENCES public.queue_entries(id) ON DELETE SET NULL,
  comm_type            text NOT NULL CHECK (comm_type IN (
    'confirmacao_fila',
    'form2_horario',
    'form3_cadastro',
    'cancelamento_ausencia_terapeuta',
    'proposta_reposicao',
    'autorizacao_vencendo',
    'mudanca_terapeuta',
    'renovacao_contrato'
  )),
  token_id             uuid REFERENCES public.clinic_form_tokens(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'enviado' CHECK (status IN (
    'enviado', 'confirmado', 'sem_resposta', 'prazo_expirado'
  )),
  sent_at              timestamptz NOT NULL DEFAULT now(),
  confirmed_at         timestamptz,
  confirmation_ip_hash text,
  response_deadline    timestamptz,
  escalated_at         timestamptz,
  escalated_to         uuid REFERENCES auth.users(id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinic_communications ENABLE ROW LEVEL SECURITY;

-- Membros da clínica podem ler comunicações
CREATE POLICY "clinic_communications_member_select"
  ON public.clinic_communications FOR SELECT
  USING (is_clinic_member(clinic_id));

-- Coordenadores criam comunicações
CREATE POLICY "clinic_communications_coordinator_insert"
  ON public.clinic_communications FOR INSERT
  WITH CHECK (is_clinic_coordinator(clinic_id));

-- Coordenadores atualizam (escalada, status sem_resposta)
CREATE POLICY "clinic_communications_coordinator_update"
  ON public.clinic_communications FOR UPDATE
  USING (is_clinic_coordinator(clinic_id));

-- Confirmação pública via supabaseAdmin (não precisa de policy separada)

-- ─── 4. Adicionar FK em clinic_replacements.communication_id ─────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'clinic_replacements_communication_id_fkey'
    AND table_name = 'clinic_replacements'
  ) THEN
    ALTER TABLE public.clinic_replacements
      ADD CONSTRAINT clinic_replacements_communication_id_fkey
      FOREIGN KEY (communication_id)
      REFERENCES public.clinic_communications(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 5. Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_clinic_communications_clinic_id
  ON public.clinic_communications (clinic_id);

CREATE INDEX IF NOT EXISTS idx_clinic_communications_patient_profile_id
  ON public.clinic_communications (patient_profile_id)
  WHERE patient_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinic_communications_token_id
  ON public.clinic_communications (token_id)
  WHERE token_id IS NOT NULL;
