-- ============================================================
-- Melhorias no registro de sessão do terapeuta
-- Criado em: 04/06/2026
--   1. Vincular o registro a uma próxima sessão escolhida pelo terapeuta
--   2. Observações direcionadas a outro profissional (ainda não exposto aos pais)
-- ============================================================

-- ─── 1. next_session_event_id — sessão escolhida para receber os pontos a continuar ─
ALTER TABLE public.session_records
  ADD COLUMN IF NOT EXISTS next_session_event_id uuid
    REFERENCES public.agenda_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.session_records.next_session_event_id IS
  'Sessão futura escolhida pelo terapeuta para receber os pontos a continuar. NULL = usa a próxima sessão cronológica.';

-- ─── 2. professional_observations — observações para outros profissionais ──────────
ALTER TABLE public.session_records
  ADD COLUMN IF NOT EXISTS professional_observations jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.session_records.professional_observations IS
  'Observações direcionadas a outros profissionais: [{professional_id?: string, professional_name: string, notes: string}]. Por ora visível apenas ao terapeuta.';
