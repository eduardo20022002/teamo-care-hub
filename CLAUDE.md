# TEAmo — Contexto do Projeto para Claude Code

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TanStack Start + TypeScript (strict) |
| Backend | TanStack ServerFn (Nitro) + Supabase Edge Functions |
| Banco | Supabase (PostgreSQL 15) + Row-Level Security |
| Auth | Supabase Auth — email/senha, TOTP MFA, OTP compartilhamento |
| Storage | Supabase Storage (documentos clínicos) |
| Deploy | Vercel (Nitro preset) |
| Estilo | Tailwind CSS + shadcn/ui |

## MCPs Disponíveis

| MCP | Quando usar |
|---|---|
| **Supabase** | Inspecionar RLS, rodar migrações, consultar audit_logs, testar permissões |
| **GitHub** | Criar issues de compliance, revisar PRs, rastrear tarefas LGPD |
| **Vercel** | Checar deploys, gerenciar env vars, ver logs de funções serverless |

## 6 Regras Inegociáveis de Segurança

1. **RLS obrigatório** — toda tabela nova deve ter Row-Level Security ativado antes do primeiro INSERT
2. **Nunca logar dados sensíveis** — use `logger.ts` com redação automática; nunca `console.log(patient)` ou similar
3. **Nunca hardcodar secrets** — use variáveis de ambiente; `.env` está no `.gitignore`
4. **Audit log server-only** — `logAuthEvent` e derivados rodam apenas em ServerFn, nunca no cliente
5. **Mínimo necessário** — funções e queries retornam apenas os campos necessários para aquele papel (paciente/médico/admin)
6. **Rate limiting em toda rota pública** — endpoints sem auth usam sliding-window por IP

## Skills Instaladas

| Skill | Quando acionar |
|---|---|
| `hipaa-compliance` | Compliance LGPD/HIPAA, auditoria de código, análise de risco, qualquer dado sensível |
| `improve-codebase-architecture` | Refatoração, avaliação de impacto arquitetural, modularização |
| `supabase` | Qualquer tarefa com Supabase: Auth, RLS, migrations, Edge Functions, Storage |
| `supabase-postgres-best-practices` | Otimização de queries, schema design, índices, tipos Postgres |
| `tdd` | Escrever testes antes de implementar qualquer feature ou fix |
| `vercel-react-best-practices` | Componentes React, performance, data fetching (adaptar: projeto usa TanStack Start, não Next.js) |
| `web-design-guidelines` | Revisão de UI, acessibilidade, responsividade |
| `deploy-to-vercel` | Deploy para staging ou produção no Vercel |
| `systematic-debugging` | Bugs difíceis de diagnosticar — seguir processo metódico |

## Padrão de Commits

```
tipo(escopo): descrição curta em português

Exemplos:
feat(sharing): adiciona validade configurável para links OTP
fix(auth): corrige timeout de sessão em dispositivos móveis
security(rls): restringe acesso a documentos clínicos por tenant
chore(deps): atualiza supabase-js para 2.45
```

## Fluxo para Novas Features

Ver workflow completo em `/Users/eduardoterra/Downloads/teamo-dev-workflow.md`.

Resumo das 6 fases:
1. Especificação formal (`hipaa-compliance`)
2. Plano arquitetural em Plan Mode (`improve-codebase-architecture` + `supabase`)
3. Implementação: testes primeiro (`tdd`) → migration → RLS → backend → frontend → UI
4. Revisão de segurança e LGPD (`hipaa-compliance`)
5. Deploy (`deploy-to-vercel`)
6. Commit + PR + atualizar CLAUDE.md se necessário

## Referências

- [Contexto de domínio](CONTEXT.md)
- [Decisões arquiteturais](docs/adr/)
- [Workflow de desenvolvimento](/Users/eduardoterra/Downloads/teamo-dev-workflow.md)
