# TEAmo

**TEAmo** é uma aplicação web que ajuda pais e responsáveis a coordenar o cuidado de crianças com Transtorno do Espectro Autista (TEA): consolida informações dos diferentes profissionais envolvidos e facilita o compartilhamento estruturado.

> Status atual — **Ciclo C1**: conta de usuário e perfil da criança. Próximos ciclos adicionam registros de atendimento, profissionais, agenda, compartilhamento via OTP e linha do tempo.

## Stack

- **Frontend**: React 19 + TanStack Start (file-based routing) + TypeScript estrito
- **UI**: Tailwind CSS v4 + shadcn/ui + Lucide icons
- **Estado server**: TanStack Query
- **Backend**: Lovable Cloud (Postgres + Auth + Storage gerenciados)
- **Validação**: Zod
- **Padronização**: ESLint + Prettier

## Execução local

```bash
bun install
bun run dev
```

A aplicação sobe em `http://localhost:5173` (ou porta indicada pelo Vite).

## Variáveis de ambiente

Geradas automaticamente pelo Lovable Cloud no arquivo `.env`. Não comitar valores reais.

| Variável | Uso |
| --- | --- |
| `VITE_SUPABASE_URL` | URL pública do backend (cliente) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública do backend (cliente, RLS aplicada) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | Equivalentes server-side |

## Estrutura de pastas

```
src/
  routes/                 # Páginas (TanStack file-based routing)
    __root.tsx            # Layout raiz: providers, fonte, metas
    index.tsx             # Redireciona p/ /login ou /dashboard
    login.tsx             # Tela de login
    cadastro.tsx          # Tela de criação de conta
    _auth.tsx             # Guard de rotas autenticadas + idle timeout
    _auth/
      onboarding.tsx      # Cadastro obrigatório de criança(s)
      dashboard.tsx       # Dashboard inicial
  components/             # UI — não acessa Supabase diretamente
    auth/                 # Formulários e indicadores de auth
    children/             # Cards e formulários de criança
    common/               # Loading, ComingSoon, etc.
    layout/               # AppShell e logo
    ui/                   # Componentes shadcn/ui
  services/               # Única camada que acessa Supabase
    auth.service.ts
    children.service.ts
    audit.service.ts
  hooks/                  # Hooks de domínio (useAuth, useIdleTimeout)
  lib/                    # Validação, formatação, queryClient
  types/                  # Tipos derivados do schema
  integrations/supabase/  # Cliente gerado (NÃO editar)
```

## Regras arquiteturais

- **Componentes nunca importam o cliente Supabase**. Toda chamada passa por `src/services/`.
- **TypeScript estrito**: build falha com erros de tipo.
- **Sem `console.log` em produção** (use ferramentas de erro/auditoria).
- **RLS** habilitada em todas as tabelas (cada usuário acessa apenas seus dados).
- **Auditoria**: eventos de autenticação registrados em `audit_logs` (sem senhas).

## Tabelas

| Tabela | Descrição |
| --- | --- |
| `profiles` | Perfil do responsável, criado automaticamente no cadastro |
| `children` | Crianças sob cuidado de cada responsável |
| `audit_logs` | Eventos de autenticação (sucesso, falha, logout, expiração) |
