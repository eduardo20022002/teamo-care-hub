-- ─── Atividade de acesso (user_sessions) ─────────────────────────────────────
-- Ciclo de vida de sessão para o painel admin (quem logou, quando, por quanto tempo).
-- audit_logs continua como TRILHA DE SEGURANÇA append-only; esta tabela é a fonte
-- de análise de sessão (duração via heartbeat, mesmo sem logout explícito).
--
-- IP e user_agent são dados pessoais (LGPD): base legal = segurança/legítimo interesse;
-- só o admin lê (via getLoginActivityServer); retenção limitada (purge diário abaixo).
--
-- Regra 1 do CLAUDE.md: RLS obrigatório. Toda escrita/leitura passa pelo service_role
-- (supabaseAdmin) — o cliente não acessa a tabela diretamente.

-- ===========================================================================
-- 1. Tabela user_sessions
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL,                         -- reusa o __teamo_sid do cliente
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),    -- heartbeat → duração mesmo sem logout
  ended_at      timestamptz,
  end_reason    text CHECK (end_reason IS NULL OR end_reason IN ('logout', 'idle')),
  ip            text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)                          -- reload reusa a mesma linha (upsert)
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_started_idx ON public.user_sessions(started_at);
-- Sessões "ativas agora" (sem fim, vistas recentemente).
CREATE INDEX IF NOT EXISTS user_sessions_active_idx
  ON public.user_sessions(last_seen_at)
  WHERE ended_at IS NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
-- Sem policies para o cliente: leitura/escrita só via service_role (supabaseAdmin),
-- como em parent_professional_access. Admin lê pelo ServerFn getLoginActivityServer.

-- ===========================================================================
-- 2. Retenção LGPD — purge diário (espelha purge_old_audit_logs)
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.purge_old_user_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sessões com mais de 365 dias são removidas (mínimo necessário — LGPD Art. 16).
  DELETE FROM public.user_sessions
  WHERE started_at < now() - INTERVAL '365 days';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_user_sessions() FROM PUBLIC, authenticated, anon;

-- Agenda limpeza diária às 03:10 UTC via pg_cron (10 min após o purge de audit_logs).
SELECT cron.schedule(
  'purge-user-sessions-daily',
  '10 3 * * *',
  'SELECT public.purge_old_user_sessions()'
);
