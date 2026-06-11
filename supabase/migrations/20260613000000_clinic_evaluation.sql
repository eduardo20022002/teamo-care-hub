-- Fase 4: Avaliações — evaluation_reports, evaluation_goals, patient_profiles
-- Dados sensíveis de saúde (LGPD Art. 11). RLS restringe a terapeuta responsável
-- e coordenadores da clínica. Recepcionista NÃO acessa dados clínicos.

-- ── evaluation_reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_reports (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                 uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  queue_entry_id            uuid NOT NULL REFERENCES public.queue_entries(id) ON DELETE CASCADE,
  therapist_user_id         uuid NOT NULL REFERENCES auth.users(id),
  evaluation_dates          date[] NOT NULL DEFAULT '{}',
  instruments               text[] NOT NULL DEFAULT '{}',
  sessions_count            int DEFAULT 1,
  -- VB-MAPP
  vbmapp_level              int CHECK (vbmapp_level BETWEEN 1 AND 3),
  vbmapp_domains            jsonb DEFAULT '{}',
  vbmapp_barriers           jsonb DEFAULT '[]',
  -- Perfil funcional
  functional_profile        jsonb DEFAULT '{}',
  -- Comportamentos-desafio
  behavior_challenges       jsonb DEFAULT '[]',
  fba_conducted             boolean DEFAULT false,
  -- Recomendação
  recommended_modality      text[] DEFAULT '{}',
  recommended_hours_per_week int,
  clinical_justification    text,
  sessions_per_week         int,
  session_duration_minutes  int DEFAULT 60,
  -- Plano inicial
  initial_goals             jsonb DEFAULT '[]',
  -- Status
  status                    text DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado')),
  finalized_at              timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE public.evaluation_reports ENABLE ROW LEVEL SECURITY;

-- Apenas terapeuta responsável e coordenador da clínica leem — recepcionista bloqueada
CREATE POLICY "evaluation_reports_select" ON public.evaluation_reports
  FOR SELECT USING (
    therapist_user_id = auth.uid()
    OR is_clinic_coordinator(clinic_id)
  );

CREATE POLICY "evaluation_reports_insert" ON public.evaluation_reports
  FOR INSERT WITH CHECK (
    therapist_user_id = auth.uid()
    OR is_clinic_coordinator(clinic_id)
  );

CREATE POLICY "evaluation_reports_update" ON public.evaluation_reports
  FOR UPDATE USING (
    therapist_user_id = auth.uid()
    OR is_clinic_coordinator(clinic_id)
  );

-- ── evaluation_goals ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_goals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid NOT NULL REFERENCES public.evaluation_reports(id) ON DELETE CASCADE,
  domain            text NOT NULL,
  objective         text NOT NULL,
  mastery_criterion text NOT NULL,
  priority          int DEFAULT 1,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.evaluation_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evaluation_goals_select" ON public.evaluation_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_reports r
      WHERE r.id = report_id
        AND (r.therapist_user_id = auth.uid() OR is_clinic_coordinator(r.clinic_id))
    )
  );

CREATE POLICY "evaluation_goals_insert" ON public.evaluation_goals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.evaluation_reports r
      WHERE r.id = report_id
        AND (r.therapist_user_id = auth.uid() OR is_clinic_coordinator(r.clinic_id))
    )
  );

CREATE POLICY "evaluation_goals_update" ON public.evaluation_goals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_reports r
      WHERE r.id = report_id
        AND (r.therapist_user_id = auth.uid() OR is_clinic_coordinator(r.clinic_id))
    )
  );

CREATE POLICY "evaluation_goals_delete" ON public.evaluation_goals
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_reports r
      WHERE r.id = report_id
        AND (r.therapist_user_id = auth.uid() OR is_clinic_coordinator(r.clinic_id))
    )
  );

-- ── patient_profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  queue_entry_id          uuid NOT NULL REFERENCES public.queue_entries(id) ON DELETE CASCADE,
  evaluation_report_id    uuid REFERENCES public.evaluation_reports(id),
  -- Seção 1: Dados da criança
  child_full_name         text NOT NULL,
  child_cpf               text,
  child_birthdate         date NOT NULL,
  -- Seção 2: Responsáveis
  guardians               jsonb NOT NULL DEFAULT '[]',
  -- Seção 3-4: Endereço e emergência
  address                 jsonb DEFAULT '{}',
  emergency_contacts      jsonb DEFAULT '[]',
  -- Seção 5: Financeiro e convênio
  payment_type            text CHECK (payment_type IN ('convenio', 'particular', 'misto')),
  insurance_data          jsonb DEFAULT '{}',
  -- Seção 6-9: Clínico e educacional
  diagnosis_family_report text,
  comorbidities           text[] DEFAULT '{}',
  current_professionals   jsonb DEFAULT '[]',
  school_info             jsonb DEFAULT '{}',
  other_professionals     jsonb DEFAULT '[]',
  -- Seção 10-11: Contexto e consentimento
  family_routine          text,
  expectations            text,
  consent_given           boolean DEFAULT false,
  consent_date            timestamptz,
  -- Status de aprovação
  status                  text DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  approved_by             uuid REFERENCES auth.users(id),
  approved_at             timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;

-- Coordenador: lê e aprova qualquer perfil da clínica
-- Terapeuta: lê apenas perfis vinculados a relatórios que criou
-- Recepcionista: apenas SELECT de dados básicos (sem dados clínicos — controlado na query)
CREATE POLICY "patient_profiles_coordinator_all" ON public.patient_profiles
  FOR ALL USING (is_clinic_coordinator(clinic_id));

CREATE POLICY "patient_profiles_therapist_select" ON public.patient_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_reports r
      WHERE r.id = evaluation_report_id
        AND r.therapist_user_id = auth.uid()
    )
    OR is_clinic_coordinator(clinic_id)
  );

-- INSERT é feito via supabaseAdmin (form público com token)
-- UPDATE é feito via supabaseAdmin (submissão do Form 3)
