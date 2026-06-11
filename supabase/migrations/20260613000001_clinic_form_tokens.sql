-- Fase 4: clinic_form_tokens — tokens para Form 2 (confirmação de horário) e Form 3 (cadastro completo)
-- Reutilizado na Fase 6 para clinic_communications.

CREATE TABLE IF NOT EXISTS public.clinic_form_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  token          text UNIQUE NOT NULL DEFAULT (
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  ),
  form_type      text NOT NULL CHECK (form_type IN ('form2_horario', 'form3_cadastro')),
  queue_entry_id uuid NOT NULL REFERENCES public.queue_entries(id) ON DELETE CASCADE,
  payload        jsonb DEFAULT '{}',
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '10 days'),
  used_at        timestamptz,
  created_by     uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE public.clinic_form_tokens ENABLE ROW LEVEL SECURITY;

-- Membros da clínica criam e leem tokens
CREATE POLICY "clinic_form_tokens_member_select" ON public.clinic_form_tokens
  FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_form_tokens_member_insert" ON public.clinic_form_tokens
  FOR INSERT WITH CHECK (is_clinic_member(clinic_id) AND created_by = auth.uid());

-- UPDATE via supabaseAdmin (marcar used_at no submit público)
