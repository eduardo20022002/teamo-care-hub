-- A-01: Revogar colunas privadas de session_records do role authenticated.
--
-- Contexto: approach_adjustment e professional_observations são campos exclusivos
-- do terapeuta. A política session_records_parent_read dava SELECT na linha inteira
-- quando is_private=false, então pais podiam consultar essas colunas via client.
--
-- Após este REVOKE:
--   - SELECT * em session_records por authenticated retorna a linha sem essas colunas.
--   - SELECT approach_adjustment FROM session_records retorna erro de permissão.
--   - Terapeutas que precisam dessas colunas devem usar a ServerFn
--     getSessionRecordPrivateServer (src/lib/session-records-private.functions.ts)
--     que usa supabaseAdmin com verificação de therapist_id = userId.

REVOKE SELECT (approach_adjustment, professional_observations)
  ON public.session_records
  FROM authenticated;
