# Prompts das Routines — cole no `/schedule`

Cada bloco abaixo é o prompt de uma routine. São **autocontidos** (routines rodam
"a frio", sem contexto de sessão) e delegam o detalhe para o arquivo de agente
versionado no repo. Crie cada um com `/schedule` (ou em `claude.ai/code/routines`)
apontando para o repo **`teamo-care-hub`**, na cadência sugerida no `README.md`.

> Todos assumem `gh` autenticado no ambiente da routine (conector GitHub) e que as
> labels já foram criadas (ver `README.md`).

---

## 1. reviewer-seguranca — diário 06:00 BRT

```
Você está no repositório do TEAmo. Leia e siga EXATAMENTE as instruções em
`.claude/agents/reviewer-seguranca.md`. Faça a auditoria de segurança/LGPD do dia
sobre uma fatia do backend/migrations/rotas públicas, deduplicando contra as
issues já abertas com a label `review:seguranca`. Abra as issues novas conforme o
contrato de saída daquele arquivo. Você é READ-ONLY no código — não edite, não
faça commit, não faça push. Ao final, escreva um resumo de 3 linhas do que
auditou hoje e quantas issues abriu.
```

## 2. reviewer-usabilidade — diário 06:00 BRT

```
Você está no repositório do TEAmo. Leia e siga EXATAMENTE as instruções em
`.claude/agents/reviewer-usabilidade.md`. Faça a varredura de usabilidade/UX do
dia (rotacione o foco entre pais/terapeuta/clínica e fluxos públicos),
deduplicando contra as issues abertas com a label `review:usabilidade`. Use a
skill web-design-guidelines como referência. Abra no máximo 5 issues novas,
priorizando maior impacto. READ-ONLY no código. Ao final, resuma em 3 linhas.
```

## 3. reviewer-features — diário 06:00 BRT

```
Você está no repositório do TEAmo. Leia e siga EXATAMENTE as instruções em
`.claude/agents/reviewer-features.md`. Olhe o app pelas duas lentes (produto e
arquitetura), leia CONTEXT.md e docs/adr/ antes de propor, e abra no máximo 3
propostas novas fortes, deduplicando contra as issues com label `review:feature`.
READ-ONLY no código. Ao final, resuma em 3 linhas.
```

## 4. gerente-revisoes — diário 08:00 BRT (depois dos 3 revisores)

```
Você está no repositório do TEAmo. Leia e siga EXATAMENTE as instruções em
`.claude/agents/gerente-revisoes.md`. Colete as issues abertas dos três revisores
(labels review:usabilidade, review:seguranca, review:feature), deduplique,
priorize (segurança crítica primeiro; depois impacto÷esforço) e crie a issue de
digest do dia com a label `digest`, no formato especificado. NÃO adicione a label
`aprovado` — quem aprova é o Eduardo.
```

## 5. implementador (executor) — diário 20:00 BRT

```
Você está no repositório do TEAmo. Leia e siga EXATAMENTE as instruções em
`.claude/agents/implementador.md`. Pegue as issues com a label `aprovado`,
processe UMA por vez seguindo o pipeline especifica→TDD→code-review, e abra um PR
por issue numa branch `claude/*` (nunca toque no main). Se não houver issues
`aprovado`, encerre sem fazer nada. Não aplique migrations no banco remoto; não
comite secrets. Rode `npx tsc --noEmit` nos arquivos tocados antes de abrir o PR.
```

---

## Notas de operação

- **Repo:** aponte todas para `teamo-care-hub` (origin). Lembre que o deploy real
  (`teamotech.online`) vem do projeto Vercel `teamo-care-hub-dev` e NÃO faz
  auto-deploy por git — merge de PR no `teamo-care-hub` não publica sozinho no
  domínio; a publicação é um passo separado (ver memória de deploy topology).
- **Ajuste de cadência:** se estourar o limite diário de routines do seu plano,
  junte os 3 revisores num único routine que roda os três agentes em sequência
  (um prompt que diz "faça a auditoria de segurança, depois usabilidade, depois
  features, seguindo os respectivos arquivos em .claude/agents/").
- **Primeiro dia:** rode os revisores manualmente uma vez (via `/schedule` "run
  now" ou localmente com o Agent tool) para popular as primeiras issues e validar
  o formato antes de deixar no automático.
