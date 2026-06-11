-- ─── Form 1 — Redesign UX: payload rico ─────────────────────────────────────
-- Adiciona coluna form_payload (jsonb) à queue_entries para armazenar os dados
-- estruturados do novo Form 1: múltiplos responsáveis, condições com status,
-- comportamentos, terapia ABA atual, disponibilidade detalhada e protocolo.
--
-- Coluna aditiva e nullable-com-default — não altera o trigger de priorização,
-- que continua lendo factor_a/factor_b/factor_c (derivados no servidor a partir
-- deste payload). RLS já está ativo na tabela; a nova coluna herda as policies.

ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS form_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.queue_entries.form_payload IS
  'Form 1 completo: responsaveis[], condicoes{}, comportamentos{}, terapia_aba_atual, terapia_aba_horas, como_soube, observacoes, disponibilidade{}, protocol';

-- Índice para busca de duplicata por criança (nome + data de nascimento + clínica)
CREATE INDEX IF NOT EXISTS queue_entries_child_dedupe_idx
  ON public.queue_entries (clinic_id, lower(child_name), child_birthdate);
