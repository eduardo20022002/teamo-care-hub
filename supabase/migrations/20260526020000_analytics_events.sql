-- Tabela de eventos de analytics anonimizados para o painel admin.
-- NUNCA armazena conteúdo clínico, nomes de crianças/profissionais,
-- textos de registros, diagnósticos ou qualquer dado sensível (PHI).
-- Somente tipos de ação, módulos, rotas e metadados de timing.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id   text,           -- ID gerado no cliente por sessão; não é identificável sozinho
  event_type   text NOT NULL,  -- ex: 'module.open', 'record.create', 'share.create'
  module       text,           -- ex: 'registros', 'documentos', 'compartilhamento'
  route        text,           -- ex: '/registros', '/agenda'
  duration_ms  integer,        -- para Web Vitals (LCP/CLS/INP) e latência de ServerFn
  properties   jsonb NOT NULL DEFAULT '{}',  -- metadados extras sem PHI
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS: apenas service_role (supabaseAdmin) pode inserir — nunca o cliente diretamente.
-- Admins podem ler via funções server-side que verificam is_admin.
-- Usuários comuns não têm acesso de leitura nem de escrita via RLS.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Sem políticas de SELECT/INSERT para roles públicos:
-- o service_role bypassa RLS automaticamente.
-- Leitura exclusiva via ServerFn admin-only.

-- Índices para os padrões de query do painel admin:
-- filtros por tipo de evento, módulo, usuário e janela de tempo.
CREATE INDEX IF NOT EXISTS analytics_events_event_type_created_at
  ON public.analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_module_created_at
  ON public.analytics_events (module, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_id_created_at
  ON public.analytics_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_created_at
  ON public.analytics_events (created_at DESC);

-- Index parcial para funis de onboarding (apenas eventos de sessão/auth)
CREATE INDEX IF NOT EXISTS analytics_events_session_funnel
  ON public.analytics_events (session_id, event_type, created_at)
  WHERE session_id IS NOT NULL;
