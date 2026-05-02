## C1 — RF-06: Conta de usuário e perfil da criança

Ciclo de fundação: autenticação, onboarding de criança, AppShell, dashboard placeholder, RLS, auditoria e estrutura modular. Backend via Lovable Cloud (Supabase). Observação: o stack do projeto é **TanStack Start** com roteamento em `src/routes/` (não `src/pages/`) — manterei a arquitetura modular pedida adaptando o nome do diretório de páginas para `src/routes/` (convenção obrigatória do framework). Confirmação no item 6.

---

### 1. Estrutura de pastas a criar

```
src/
  routes/                    # páginas (TanStack file-based routing)
    __root.tsx               # modificar: providers (QueryClient, Toaster, AuthProvider)
    index.tsx                # modificar: redireciona p/ /login ou /dashboard
    login.tsx                # tela de login
    cadastro.tsx             # tela de cadastro (signup)
    _auth.tsx                # layout-route protegido (beforeLoad guard)
    _auth/
      onboarding.tsx         # cadastro de criança(s) pós-signup
      dashboard.tsx          # dashboard com cards de crianças + "Em breve"
  components/
    auth/
      AuthForm.tsx           # form compartilhado login/cadastro
      PasswordRequirements.tsx
    layout/
      AppShell.tsx           # header TEAmo + menu + container responsivo
      BrandLogo.tsx          # "TEA"+"mo" estilizado
    children/
      ChildCard.tsx
      ChildFormDialog.tsx
    common/
      LoadingSpinner.tsx
      ComingSoonCard.tsx
  services/
    auth.service.ts          # signUp, signIn, signOut, getSession, onAuthChange
    children.service.ts      # listChildren, createChild, deleteChild
    audit.service.ts         # logAuthEvent (success/failure)
  hooks/
    useAuth.tsx              # AuthProvider + useAuth (contexto de sessão)
    useIdleTimeout.ts        # logout após 20min inatividade
    useChildren.ts           # query/mutation wrapper
  lib/
    validation.ts            # schemas Zod (email, senha forte, criança)
    formatters.ts            # idade, data PT-BR
    queryClient.ts
  types/
    database.ts              # tipos das tabelas
    auth.ts
  integrations/supabase/     # gerado pelo Cloud
```

### 2. Services (única camada que toca Supabase)

- `**auth.service.ts**`: `signUp(email, password)`, `signIn(email, password)`, `signOut()`, `getSession()`, `onAuthStateChange(cb)`. Após cada tentativa de login chama `audit.service.logAuthEvent`.
- `**children.service.ts**`: `listChildrenByUser(userId)`, `createChild({name, birthDate})`, `deleteChild(id)`. Todas as queries dependem de RLS (sem filtro manual de `user_id` além do exigido pelo insert).
- `**audit.service.ts**`: `logAuthEvent(userId|null, eventType, metadata)` — insere em `audit_logs`. Nunca registra senha.

Regra: nenhum componente importa `@/integrations/supabase/client`. Apenas services.

### 3. Schema Supabase

**Tabela `profiles**` (1:1 com `auth.users`)

- `id uuid PK references auth.users(id) on delete cascade`
- `email text not null`
- `full_name text` (opcional, vazio neste ciclo)
- `created_at timestamptz default now()`

**Tabela `children**`

- `id uuid PK default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `name text not null`
- `birth_date date not null`
- `created_at timestamptz default now()`

**Tabela `audit_logs**`

- `id uuid PK default gen_random_uuid()`
- `user_id uuid references auth.users(id) on delete set null`
- `event_type text not null` (`auth.login_success`, `auth.login_failure`, `auth.signup_success`, `auth.logout`)
- `metadata jsonb default '{}'`
- `created_at timestamptz default now()`

**RLS — habilitada em todas:**

- `profiles`: SELECT/UPDATE `auth.uid() = id`; INSERT via trigger.
- `children`: SELECT/INSERT/UPDATE/DELETE `auth.uid() = user_id`.
- `audit_logs`: SELECT `auth.uid() = user_id`; INSERT permitido para usuários autenticados (próprio user_id) e via service role para falhas anônimas.

**Trigger `handle_new_user**`

- Função `SECURITY DEFINER` em `public` que insere linha em `profiles` ao criar usuário em `auth.users`.

### 4. Configuração Supabase Auth

- Provider: **Email/Senha** habilitado.
- **Auto-confirm email = ON** (sem verificação por e-mail neste ciclo, para fluxo direto signup → onboarding).
- Política de senha: validada no frontend via Zod (≥8, letra, número, caractere especial). Supabase mantém bcrypt nativo.
- Site URL configurado para o preview.

### 5. Fluxos & guards

- `**/**`: redireciona para `/dashboard` (autenticado) ou `/login`.
- `**/login`, `/cadastro**`: públicas; se autenticado, redirecionam para `/dashboard` (ou `/onboarding` se sem criança).
- `**_auth` layout**: `beforeLoad` checa `supabase.auth.getUser()`; sem sessão → redirect `/login`. Inclui `useIdleTimeout(20min)` que faz `signOut()` + toast "Sessão expirada por inatividade".
- `**/onboarding**`: dentro de `_auth`. Após signup, redireciona aqui. Permite adicionar várias crianças (lista + "+ Adicionar outra criança"). Botão "Continuar" habilitado apenas com ≥1 criança → vai para `/dashboard`.
- `**/dashboard**`: cards de crianças + "+ Adicionar" (abre dialog) + seção "Em breve no TEAmo" com 5 cards (Registros, Profissionais, Agenda, Compartilhamento, Linha do tempo).

### 6. Design system (`src/styles.css`)

Tokens em oklch equivalentes a:

- `--primary`: #3B5BDB (azul TEAmo)
- `--accent`: #E64980 (coral, uso pontual)
- `--background`: #F8F9FA
- `--card`: #FFFFFF
- `--foreground`: #212529
- `--muted-foreground`: #6C757D
- `--border`: #DEE2E6
- `--success`: #2F9E44 (novo token, usado no botão "Continuar")

Fonte Inter via Google Fonts em `__root.tsx`. Cards `rounded-xl shadow-sm`. Ícones Lucide stroke fino. Layout mobile-first.

### 7. RNFs estruturais

- **RNF-08**: guard `_auth` + idle timeout 20min + `signOut` no logout.
- **RNF-09**: RLS por `auth.uid()` em todas as tabelas.
- **RNF-10**: bcrypt nativo do Supabase + Zod no frontend; sem logs de senha.
- **RNF-11**: tabela `audit_logs` + chamadas em sucesso/falha de auth.
- **RNF-13**: pastas modulares; regra "components nunca importam supabase".
- **RNF-14**: README.md com objetivo, stack (TanStack Start + Lovable Cloud), execução local, env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), estrutura de pastas.
- **RNF-15**: ESLint + Prettier já presentes — adicionar regra `no-console` (warn, off para `console.error`/`warn`); manter `strict: true` no tsconfig.

### 8. Sequência de implementação

1. Habilitar Lovable Cloud + criar tabelas, RLS e trigger via migration.
2. Configurar tokens de design em `styles.css` + fonte Inter.
3. Estrutura de pastas + tipos + queryClient + AuthProvider.
4. Services (`auth`, `children`, `audit`).
5. Componentes base (BrandLogo, AppShell, AuthForm, PasswordRequirements).
6. Rotas: `login`, `cadastro`, `_auth`, `onboarding`, `dashboard`, `index`.
7. Hook `useIdleTimeout`.
8. README + ajuste ESLint (`no-console`).
9. Verificação manual dos 9 critérios de aceite.

### 9. Decisões em aberto

1. `**src/pages/` vs `src/routes/**`: o template usa TanStack Start, que exige `src/routes/`. Vou seguir `src/routes/` (não há como ter ambos). OK? Ok
2. **Confirmação de e-mail**: proponho desativar para evitar fricção no MVP (signup → onboarding direto). Se preferir manter verificação, o fluxo passa por uma tela "verifique seu e-mail". Vamos evitar por ora.
3. **Logout por inatividade = 20min**: medido por eventos `mousemove/keydown/touchstart/click` em janela; aceitável? Sim
4. **Idade da criança**: exibir "X anos" arredondando para baixo, "0 anos" para <1 ano (consistente com mockup). OK. Caso tenha menos de 1 ano, coloque de forma arredondada para baixo a quantidade de meses da criança.
5. **Logs de falha de login sem usuário**: como `audit_logs.user_id` não existe ainda, registrarei `user_id = null` com `metadata.email`. OK? Ok.