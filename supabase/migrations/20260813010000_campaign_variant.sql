-- ─── Variante de conteúdo por comportamento (campaign_due_sends.variant) ─────
-- A régua de QUANDO enviar já estava na view. Falta o QUE enviar.
--
-- A variante é calculada AO VIVO (não gravada), porque o comportamento muda:
-- se um pai cadastrar uma criança entre o touch1 e o touch2, o touch2 já sai
-- com o texto certo. Gravar a variante congelaria uma informação que envelhece.
--
--   therapist     → texto profissional (registrar sessão, relatório)
--   parent_active → cadastrou criança: "volte para acompanhar"
--   parent_setup  → nunca cadastrou ninguém: "termine de configurar"
--                   (mandar "acompanhe a evolução" para quem não tem ninguém
--                    cadastrado cai no vazio e reforça o abandono)

CREATE OR REPLACE VIEW public.campaign_due_sends AS
SELECT
  cs.*,
  CASE
    WHEN cs.stopped_reason IS NOT NULL THEN NULL
    WHEN cs.touch1_sent_at IS NULL THEN 'touch1'
    WHEN cs.touch2_sent_at IS NULL AND now() >= cs.touch1_sent_at + interval '4 days' THEN 'touch2'
    WHEN cs.touch3_sent_at IS NULL AND cs.touch2_sent_at IS NOT NULL
      AND now() >= cs.touch2_sent_at + interval '5 days' THEN 'touch3'
    ELSE NULL
  END AS next_touch,
  CASE
    WHEN cs.segmento = 'therapist' THEN 'therapist'
    WHEN EXISTS (SELECT 1 FROM public.children c WHERE c.user_id = cs.user_id)
      THEN 'parent_active'
    ELSE 'parent_setup'
  END AS variant
FROM public.campaign_sends cs;

REVOKE ALL ON public.campaign_due_sends FROM PUBLIC, authenticated, anon;
