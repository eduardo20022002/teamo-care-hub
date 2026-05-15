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

## Skills Ativas

| Skill | Quando acionar |
|---|---|
| `saude-app` | Qualquer tarefa envolvendo Supabase, Vercel, dados de pacientes, LGPD/HIPAA ou nova feature |
| `hipaa` | Revisão de compliance HIPAA, auditoria de código, análise de risco |
| `frontend-design` | Criação ou refatoração de componentes de UI |
| `pdf` | Geração, leitura ou manipulação de arquivos PDF |
| `docx` / `xlsx` | Exportação ou importação de documentos Word/Excel |
| `file-reading` | Leitura e parsing de arquivos enviados por usuários |
| `product-self-knowledge` | Dúvidas sobre funcionalidades do próprio TEAmo |

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

1. Verificar impacto em RLS e dados clínicos
2. Criar issue no GitHub (use template LGPD se tocar dados de pacientes)
3. Implementar com checklist LGPD/HIPAA da skill `saude-app`
4. Configurar env vars no Vercel (nunca em código)
5. Testar permissões por role via MCP Supabase
6. Revisar PR com foco em segurança antes de merge

## Referências

- [Supabase MCP](.claude/skills/saude-app/references/supabase-mcp.md)
- [GitHub MCP](.claude/skills/saude-app/references/github-mcp.md)
- [Vercel MCP](.claude/skills/saude-app/references/vercel-mcp.md)
- [LGPD / HIPAA](.claude/skills/saude-app/references/lgpd-hipaa.md)
