# Revisores em nuvem do TEAmo (Topologia A)

Sistema de revisão contínua do código do TEAmo por agentes agendados (Claude Code
**Routines**), coordenando via **estado do GitHub** (issues + labels). Cada agente
tem escopo próprio, definido em `.claude/agents/*.md` (versionado no git).

## Como funciona (visão geral)

```
        (cloud routines, 1x/dia)                     (você, pelo celular)
┌─────────────────────────────────┐
│  reviewer-usabilidade  ─┐        │        digest ──►  você lê no GitHub
│  reviewer-seguranca    ─┤ abrem  │                    e adiciona a label
│  reviewer-features     ─┘ issues │──►  gerente-revisoes  ──►  `aprovado`
│                                  │     (lê+prioriza)             │
└─────────────────────────────────┘                               ▼
                                              ┌───────────────────────────────┐
                                              │ implementador (routine executor)│
                                              │ especifica→TDD→code-review→PR   │
                                              │ branch claude/* → você dá merge │
                                              └───────────────────────────────┘
```

**Os agentes não conversam em tempo real** — coordenam-se assincronamente pelas
issues e labels do GitHub. Isso é intencional: routines rodam autônomas e não
esperam resposta ao vivo (limitação da plataforma), então o "estado" fica no
GitHub, que ambos os lados enxergam.

## Os agentes

| Agente | Papel | Escreve código? | Saída |
|---|---|---|---|
| `reviewer-usabilidade` | Varre UX/acessibilidade das 3 visões + mobile | ❌ | issues `review:usabilidade` |
| `reviewer-seguranca` | Audita RLS, LGPD, tenant, secrets, rate-limit | ❌ | issues `review:seguranca` (+`critico`) |
| `reviewer-features` | Propõe features de produto + refatorações | ❌ | issues `review:feature` |
| `gerente-revisoes` | Deduplica, prioriza, gera o digest do dia | ❌ | issue `digest` |
| `implementador` | Constrói o que você aprovou (Matt Pocock: especifica→TDD→revisa) | ✅ (só `claude/*`) | PRs |

## Fluxo de aprovação (o SEU papel)

1. De manhã, abra a issue **`digest`** do dia no GitHub (app do celular serve).
2. Nas sugestões que você quer executar, adicione a label **`aprovado`**
   (ou comente `/aprovar`).
3. O routine **executor** (`implementador`) roda mais tarde, pega tudo que está
   `aprovado`, implementa numa branch `claude/*` e abre um **PR** (`closes #<n>`).
4. Você revisa o PR e dá **merge** quando quiser. Nada vai pro `main` sem seu merge.

> Aprovar = adicionar label. Rejeitar = fechar a issue (ou deixar sem `aprovado`).

## Labels usadas

Rode uma vez para criar as labels no repo (precisa do `gh` autenticado):

```bash
gh label create "review:usabilidade" --color BFD4F2 --description "Achado de UX/usabilidade" 2>/dev/null || true
gh label create "review:seguranca"   --color D93F0B --description "Achado de segurança/LGPD" 2>/dev/null || true
gh label create "review:feature"     --color 0E8A16 --description "Proposta de feature/arquitetura" 2>/dev/null || true
gh label create "critico"            --color B60205 --description "Severidade crítica/alta" 2>/dev/null || true
gh label create "digest"             --color 5319E7 --description "Digest diário do gerente" 2>/dev/null || true
gh label create "aprovado"           --color 0E8A16 --description "Eduardo aprovou p/ implementar" 2>/dev/null || true
gh label create "em-progresso"       --color FBCA04 --description "Implementador está construindo" 2>/dev/null || true
gh label create "pr-aberto"          --color 1D76DB --description "PR aberto, aguardando merge" 2>/dev/null || true
```

## Agendamento

Ver `prompts.md` para os prompts prontos de cada routine. Crie-os com `/schedule`
no Claude Code ou em `claude.ai/code/routines`, apontando para o repositório
**`teamo-care-hub`** (origin/upstream).

Cadência sugerida (horário BRT; routines têm intervalo mínimo de 1h):
- 06:00 — `reviewer-seguranca`
- 06:00 — `reviewer-usabilidade`
- 06:00 — `reviewer-features`
- 08:00 — `gerente-revisoes` (depois dos 3)
- 20:00 — `implementador` (pega o que você aprovou durante o dia)

> **Limite de routines/dia:** Pro = 5, Max = 15. Este plano usa 5 runs/dia — cabe
> no Pro, com folga no Max.

## Notificação

Fase 1 (atual): as issues do GitHub **são** a superfície — você acompanha pelo app.
Fase 2 (depois): `scripts/notify-telegram.sh` manda o digest no Telegram. Ver o
próprio script para o setup do bot.

## Segurança do próprio sistema

- Os 3 revisores e o gerente são **read-only** no código; só o `implementador`
  escreve, e apenas em branches `claude/*` (nunca `main`).
- Routines empurram só para branches `claude/*` por padrão — reforça a regra acima.
- Nenhum agente aplica migrations no banco remoto nem toca em secrets.
