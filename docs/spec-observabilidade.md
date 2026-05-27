# Spec — Módulo de Observabilidade e Painel Admin

**Versão:** 1.0
**Status:** Pronto para implementação

---

## Visão geral

Implementar observabilidade do TEAmo em três camadas — saúde técnica, comportamento do usuário e saúde do negócio — com um painel interno acessível exclusivamente por admins via menu de navegação. Nenhum dado clínico ou de conteúdo deve trafegar para os eventos de analytics. Apenas metadados de ação.

---

## 1. Mudanças no menu de navegação

### 1.1 `AccountMenuDrawer.tsx`

Adicionar prop `isAdmin?: boolean` à interface `AccountMenuDrawerProps`.

Quando `isAdmin === true`, renderizar uma nova seção logo acima do separador de logout. Seguir o mesmo padrão visual de `SectionLabel` + `MenuRow` já existente no componente.

```tsx
// Adicionar à interface:
isAdmin?: boolean;

// Adicionar dentro do drawer, logo acima de <div className="my-4 h-px bg-border" />:
{isAdmin && (
  <>
    <SectionLabel>Administração</SectionLabel>
    <MenuRow
      icon={<BarChart2 className="h-5 w-5 text-violet-600" strokeWidth={1.75} />}
      iconBg="bg-violet-100"
      label="Painel"
      subtitle="Métricas e uso da plataforma"
      onClick={() => go("/painel")}
    />
    <MenuRow
      icon={<MessageSquare className="h-5 w-5 text-violet-600" strokeWidth={1.75} />}
      iconBg="bg-violet-100"
      label="Feedbacks"
      subtitle="Mensagens enviadas pelos usuários"
      onClick={() => go("/feedbacks")}
    />
  </>
)}
```

Importar `BarChart2` e `MessageSquare` do `lucide-react`.

### 1.2 `AppShell.tsx`

O `AppShell` já consulta `profile.is_admin` na query `profile-shell`. Apenas passar esse valor para o `AccountMenuDrawer`:

```tsx
// Antes:
<AccountMenuDrawer
  open={menuOpen}
  onClose={() => setMenuOpen(false)}
  fullName={profile?.full_name ?? null}
  email={user?.email ?? null}
/>

// Depois:
<AccountMenuDrawer
  open={menuOpen}
  onClose={() => setMenuOpen(false)}
  fullName={profile?.full_name ?? null}
  email={user?.email ?? null}
  isAdmin={profile?.is_admin ?? false}
/>
```

Nenhuma outra mudança no `AppShell`.

---

## 2. Migration — tabela `analytics_events`

Criar arquivo `supabase/migrations/[timestamp]_analytics_events.sql`:

```sql
-- Tabela central de eventos de analytics anonimizados.
-- Nunca armazenar conteúdo clínico, nomes ou identificadores diretos.

create table public.analytics_events (
  id              uuid primary key default gen_random_uuid(),
  -- ID rotacionável, desvinculado do user_id real. Gerado no cadastro.
  analytics_id    text not null,
  -- Nome do evento. Ex: 'record_created', 'module_opened', 'onboarding_completed'
  event_name      text not null,
  -- Propriedades do evento — apenas metadados, sem conteúdo.
  -- Ex: { "module": "records", "record_type": "session" }
  properties      jsonb not null default '{}',
  -- Contexto técnico
  route           text,            -- rota onde o evento ocorreu
  session_id      text,            -- ID da sessão de navegação (gerado no cliente, sem vínculo com auth)
  created_at      timestamptz not null default now()
);

-- Índices para as queries do painel
create index idx_analytics_events_name       on public.analytics_events (event_name);
create index idx_analytics_events_created_at on public.analytics_events (created_at desc);
create index idx_analytics_events_analytics_id on public.analytics_events (analytics_id);

-- RLS: apenas service_role escreve (via ServerFn), apenas admin lê.
alter table public.analytics_events enable row level security;

create policy "admin pode ler analytics_events"
  on public.analytics_events for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- INSERT bloqueado para authenticated: só service_role (ServerFn) insere.
-- Nenhum cliente pode inserir diretamente.
```

### Migration — coluna `analytics_id` em `profiles`

```sql
-- Adicionar analytics_id à tabela profiles.
-- Gerado automaticamente no cadastro, nunca exposto ao usuário.

alter table public.profiles
  add column if not exists analytics_id text unique default gen_random_uuid()::text;

-- Garantir que todos os perfis existentes tenham um analytics_id
update public.profiles set analytics_id = gen_random_uuid()::text
  where analytics_id is null;

-- O analytics_id nunca deve ser retornado nas queries de perfil do cliente.
-- Bloquear leitura por usuários comuns:
create policy "analytics_id não é lido pelo cliente"
  on public.profiles for select
  to authenticated
  using (id = auth.uid())
  -- Nota: as queries de SELECT de perfil devem explicitamente listar colunas
  -- e nunca incluir analytics_id. Isso é garantia por convenção + revisão de código.
```

---

## 3. Service — `analytics.service.ts`

Criar `src/services/analytics.service.ts`.

Este service é o único ponto de disparo de eventos. Nenhum componente deve chamar Supabase diretamente para analytics. Toda chamada passa por aqui.

```typescript
// src/services/analytics.service.ts
// Regra: nunca passar conteúdo clínico, nomes ou PII para este service.
// Apenas tipos, contagens e metadados de ação.

import { createServerFn } from "@tanstack/start";
import { supabase } from "@/integrations/supabase/client";

// Tipos de evento permitidos — adicionar aqui ao criar novos eventos.
export type AnalyticsEventName =
  // Auth
  | "login_success"
  | "login_failure"
  | "logout"
  | "signup_started"
  | "signup_email_verified"
  // Onboarding
  | "onboarding_started"
  | "onboarding_child_added"
  | "onboarding_completed"
  | "onboarding_abandoned"
  // Navegação de módulos
  | "module_opened"
  // Registros
  | "record_created"
  | "record_edited"
  | "record_deleted"
  | "record_attachment_uploaded"
  // Documentos
  | "document_uploaded"
  | "document_deleted"
  // Profissionais
  | "professional_linked"
  | "professional_unlinked"
  // Agenda
  | "agenda_event_created"
  | "agenda_event_edited"
  | "agenda_event_deleted"
  // Compartilhamento OTP
  | "share_link_created"
  | "share_link_accessed"
  | "share_link_expired_unused"
  // Co-cuidador
  | "co_caregiver_invite_sent"
  | "co_caregiver_invite_accepted"
  | "co_caregiver_approved"
  | "co_caregiver_denied"
  | "co_caregiver_revoked"
  // Sessão
  | "session_started"
  | "session_ended"
  // Engajamento
  | "feedback_submitted";

export interface AnalyticsProperties {
  // Módulo envolvido (nunca nomes de crianças ou profissionais)
  module?: string;
  // Tipo de registro/documento (nunca o conteúdo)
  record_type?: string;
  // Especialidade do profissional (fono, psicólogo, etc.)
  professional_specialty?: string;
  // Extensão de arquivo (pdf, jpg, etc.) — nunca o nome
  file_extension?: string;
  // Faixa de tamanho de arquivo em KB
  file_size_bucket?: "small" | "medium" | "large"; // <100KB, 100KB-1MB, >1MB
  // Etapa de onboarding abandonada
  onboarding_step?: string;
  // Duração de sessão em bucket
  session_duration_bucket?: "<1min" | "1-5min" | "5-15min" | ">15min";
  // Rota de origem do evento
  from_route?: string;
  // Qualquer outra propriedade segura — sem conteúdo clínico
  [key: string]: string | number | boolean | undefined;
}

// ServerFn: insere o evento no banco com service_role (sem RLS).
// Recebe analytics_id, nunca user_id.
export const trackEventServer = createServerFn({ method: "POST" })
  .validator((data: {
    analyticsId: string;
    eventName: AnalyticsEventName;
    properties?: AnalyticsProperties;
    route?: string;
    sessionId?: string;
  }) => data)
  .handler(async ({ data }) => {
    // Dupla verificação: garantir que nenhum campo proibido está nas properties
    const safeProperties = sanitizeProperties(data.properties ?? {});

    const { error } = await supabase
      .from("analytics_events")
      .insert({
        analytics_id: data.analyticsId,
        event_name: data.eventName,
        properties: safeProperties,
        route: data.route,
        session_id: data.sessionId,
      });

    if (error) {
      // Falha silenciosa — analytics nunca deve quebrar a UX
      console.warn("[analytics] Falha ao registrar evento:", error.message);
    }
    return { ok: true };
  });

// Sanitização: bloquear campos que jamais devem entrar no evento
const BLOCKED_PROPERTY_KEYS = [
  "name", "full_name", "email", "child_name", "patient_name",
  "professional_name", "content", "notes", "observations",
  "diagnosis", "medication", "message", "text", "description",
];

function sanitizeProperties(props: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (BLOCKED_PROPERTY_KEYS.includes(key.toLowerCase())) continue;
    if (typeof value === "string" && value.length > 100) continue; // texto longo = suspeito
    safe[key] = value;
  }
  return safe;
}

// Hook cliente para disparar eventos facilmente nos componentes
// Uso: const { track } = useAnalytics();
//      track("record_created", { module: "records", record_type: "session" });
export function useAnalytics() {
  // analytics_id vem do perfil do usuário — buscar do contexto de auth
  // session_id é gerado uma vez por carregamento de página
  const sessionId =
    typeof window !== "undefined"
      ? (window.__TEAMO_SESSION_ID__ ??= crypto.randomUUID())
      : undefined;

  const track = async (
    eventName: AnalyticsEventName,
    properties?: AnalyticsProperties,
    route?: string,
  ) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("analytics_id")
        .maybeSingle();

      if (!profile?.analytics_id) return;

      await trackEventServer({
        data: {
          analyticsId: profile.analytics_id,
          eventName,
          properties,
          route: route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
          sessionId,
        },
      });
    } catch {
      // Falha silenciosa
    }
  };

  return { track };
}

// Declaração do tipo global para session_id
declare global {
  interface Window {
    __TEAMO_SESSION_ID__?: string;
  }
}
```

---

## 4. Pontos de disparo de eventos no app

Adicionar chamadas ao `useAnalytics().track()` nos seguintes pontos. Seguir o padrão: disparar **após** a ação ser concluída com sucesso, nunca antes.

### Auth (`auth.service.ts` / telas de login e cadastro)
- Login bem-sucedido → `login_success`
- Falha de login → `login_failure`
- Logout → `logout`
- Início do cadastro (renderização da tela de cadastro) → `signup_started`
- Email verificado → `signup_email_verified`

### Onboarding (`onboarding.tsx`)
- Tela de onboarding carregada → `onboarding_started`
- Criança adicionada com sucesso → `onboarding_child_added`
- Onboarding concluído e redirecionado → `onboarding_completed`
- Saída da tela sem concluir (unmount sem completar) → `onboarding_abandoned` com `{ onboarding_step: "child_form" }`

### Módulos — abertura (`dashboard.tsx` e rotas de módulo)
Disparar `module_opened` com `{ module: "records" | "documents" | "professionals" | "agenda" | "sharing" | "co_caregiver" }` ao navegar para cada rota de módulo. Pode ser feito no `useEffect` da rota ou no `beforeLoad`.

### Registros (`attendance.service.ts`)
- Criação bem-sucedida → `record_created` com `{ module: "records", record_type: tipo_do_registro }`
- Edição → `record_edited` com `{ module: "records" }`
- Exclusão → `record_deleted` com `{ module: "records" }`
- Upload de anexo → `record_attachment_uploaded` com `{ file_extension, file_size_bucket }`

### Documentos (`documents.service.ts`)
- Upload → `document_uploaded` com `{ file_extension, file_size_bucket }`
- Exclusão → `document_deleted`

### Profissionais (`professionals.service.ts`)
- Vinculação → `professional_linked` com `{ professional_specialty }` se disponível
- Desvinculação → `professional_unlinked`

### Agenda (`src/services/agenda/`)
- Criação de evento → `agenda_event_created`
- Edição → `agenda_event_edited`
- Exclusão → `agenda_event_deleted`

### Compartilhamento OTP (`sharing.service.ts`)
- Link criado → `share_link_created`
- Link acessado (rota pública) → `share_link_accessed`

### Feedback (`feedback`)
- Feedback enviado → `feedback_submitted`

---

## 5. Rota `/painel` — Painel Admin

### Guard de acesso

Substituir o `beforeLoad` atual (que redireciona para `/registros`) pela lógica de verificação de admin:

```typescript
// src/routes/_auth/painel.tsx
export const Route = createFileRoute("/_auth/painel")({
  head: () => ({ meta: [{ title: "Painel — TEAmo" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: PainelPage,
});
```

### Layout e seções do painel

O painel é dividido em três seções correspondentes às três camadas de observabilidade. Cada seção tem um título, descrição curta e cards de métricas.

Todas as métricas são calculadas por **views/funções Postgres** (descritas na seção 6). O componente apenas faz `SELECT` nas views — nunca queries diretas nas tabelas clínicas.

#### Seção 1 — Saúde da Plataforma

Cards:
- **Usuários cadastrados** — total de profiles na tabela `profiles`
- **Crianças com perfil ativo** — total de rows em `children`
- **Novos usuários (últimos 7 dias)** — profiles criados nos últimos 7 dias
- **Novos usuários (últimos 30 dias)** — profiles criados nos últimos 30 dias

#### Seção 2 — Comportamento dos Usuários

Cards:
- **Usuários ativos (7 dias)** — analytics_ids distintos com evento nos últimos 7 dias
- **Usuários ativos (30 dias)** — idem para 30 dias
- **Taxa de ativação** — % de usuários que dispararam `onboarding_completed` em relação ao total de `signup_email_verified`
- **Módulo mais acessado** — event_name = `module_opened`, propriedade `module` mais frequente nos últimos 30 dias
- **Sessões iniciadas (últimos 7 dias)** — contagem de `session_started`
- **Feedbacks enviados (total)** — contagem de `feedback_submitted`

Gráfico de linha simples: eventos por dia nos últimos 30 dias (eixo X = data, eixo Y = contagem de eventos). Usar a biblioteca de gráficos já disponível no projeto ou Recharts (já listado como dependência disponível).

#### Seção 3 — Saúde do Produto

Cards:
- **Registros criados (últimos 30 dias)** — contagem de `record_created`
- **Documentos enviados (últimos 30 dias)** — contagem de `document_uploaded`
- **Profissionais vinculados (total ativo)** — contagem na tabela `professionals` (query direta, pois é dado estrutural, não clínico)
- **Links OTP criados (últimos 30 dias)** — contagem de `share_link_created`
- **Links OTP acessados (últimos 30 dias)** — contagem de `share_link_accessed`
- **Co-cuidadores ativos (total)** — quando o módulo for implementado: contagem em `child_caregivers` com `status = 'active'`

#### Tabela: Eventos por tipo (últimos 30 dias)

Tabela simples com duas colunas: nome do evento (legível) e contagem. Ordenada por contagem decrescente. Mostra os top 10 eventos mais frequentes. Isso dá visão rápida do que os usuários fazem mais.

---

## 6. Views e funções Postgres para o painel

Criar como parte de uma migration dedicada `[timestamp]_analytics_views.sql`:

```sql
-- View: métricas de saúde da plataforma
create or replace view admin_platform_health as
select
  (select count(*) from public.profiles)                                     as total_users,
  (select count(*) from public.children)                                     as total_children,
  (select count(*) from public.profiles
   where created_at >= now() - interval '7 days')                            as new_users_7d,
  (select count(*) from public.profiles
   where created_at >= now() - interval '30 days')                           as new_users_30d;

-- Segurança: apenas admin acessa
alter view admin_platform_health owner to authenticated;
create policy "apenas admin acessa admin_platform_health"
  on public.profiles for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- View: usuários ativos por janela de tempo
create or replace view admin_active_users as
select
  count(distinct analytics_id) filter (
    where created_at >= now() - interval '7 days'
  ) as active_7d,
  count(distinct analytics_id) filter (
    where created_at >= now() - interval '30 days'
  ) as active_30d
from public.analytics_events;

-- View: contagem de eventos por nome (últimos 30 dias)
create or replace view admin_event_counts_30d as
select
  event_name,
  count(*) as total
from public.analytics_events
where created_at >= now() - interval '30 days'
group by event_name
order by total desc;

-- View: eventos por dia nos últimos 30 dias (para o gráfico)
create or replace view admin_events_daily_30d as
select
  date_trunc('day', created_at)::date as day,
  count(*)                             as total
from public.analytics_events
where created_at >= now() - interval '30 days'
group by 1
order by 1;

-- RLS nas views de analytics: apenas admin
-- (as views herdam RLS da tabela base analytics_events,
--  que já permite SELECT apenas para is_admin = true)
```

---

## 7. Proteção adicional — ServerFn de leitura do painel

Para garantir a segunda camada de proteção (além do RLS), as queries do painel devem rodar via ServerFn com verificação explícita de admin:

```typescript
// src/lib/admin.functions.ts

export const getPlatformHealthServer = createServerFn({ method: "GET" })
  .handler(async ({ context }) => {
    // Verificação server-side de admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("403");

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) throw new Error("403");

    const [health, activeUsers, eventCounts, dailyEvents] = await Promise.all([
      supabase.from("admin_platform_health").select("*").maybeSingle(),
      supabase.from("admin_active_users").select("*").maybeSingle(),
      supabase.from("admin_event_counts_30d").select("*").limit(10),
      supabase.from("admin_events_daily_30d").select("*"),
    ]);

    return {
      health: health.data,
      activeUsers: activeUsers.data,
      eventCounts: eventCounts.data ?? [],
      dailyEvents: dailyEvents.data ?? [],
    };
  });
```

---

## 8. Checklist de implementação

Seguir nesta ordem para evitar dependências quebradas:

- [ ] Migration: `analytics_events` + `analytics_id` em `profiles`
- [ ] Migration: views `admin_*`
- [ ] `analytics.service.ts` criado
- [ ] `AccountMenuDrawer.tsx`: prop `isAdmin` + seção Administração
- [ ] `AppShell.tsx`: passar `isAdmin` para o drawer
- [ ] Rota `/painel`: guard de admin + componente com as 3 seções
- [ ] Disparos de eventos nos pontos listados na seção 4 (auth, onboarding e módulos primeiro — são os mais críticos)
- [ ] `admin.functions.ts` com ServerFns de leitura
- [ ] Testar: usuário não-admin não vê seção Administração no menu
- [ ] Testar: usuário não-admin acessando `/painel` diretamente é redirecionado para `/dashboard`
- [ ] Testar: admin vê o menu e acessa o painel corretamente
- [ ] Testar: nenhum evento contém conteúdo clínico (revisar sanitizeProperties)

---

## 9. Regras inegociáveis

1. **Nenhum evento carrega conteúdo clínico.** Nomes, diagnósticos, textos de registros, nomes de documentos — jamais. Apenas tipos, contagens e faixas.
2. **`analytics_id` nunca é retornado ao cliente** nas queries normais de perfil. O SELECT de perfil deve listar colunas explicitamente e excluir `analytics_id`.
3. **Inserção em `analytics_events` apenas via ServerFn** (service_role). Clientes nunca inserem diretamente.
4. **Falhas de analytics são silenciosas.** O `track()` nunca deve lançar exceção nem interromper o fluxo do usuário. Try/catch em todo disparo.
5. **Painel protegido em duas camadas**: guard no `beforeLoad` da rota (frontend) + verificação de `is_admin` na ServerFn de leitura (backend). RLS é a terceira camada.
