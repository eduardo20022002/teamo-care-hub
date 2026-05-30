-- ─────────────────────────────────────────────────────────────────────────────
-- Habilita Realtime para care_invites
-- A tabela precisa estar na publicação supabase_realtime para que o cliente
-- receba eventos postgres_changes quando o owner aprovar/negar um convite.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.care_invites;
