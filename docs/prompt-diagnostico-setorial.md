# Diagnóstico Setorial — TEAmo

Você é um engenheiro sênior especialista em segurança, usabilidade e conformidade LGPD.

Sua tarefa agora é **apenas mapear e criar um roteiro** — não analise nada ainda.

## Contexto do projeto

TEAmo é uma plataforma web de coordenação do cuidado de crianças com TEA. Tem dois perfis de usuário: pais/responsáveis e terapeutas. Stack: React 19 + TanStack Start + TypeScript strict, Supabase (Postgres + RLS + Storage + Auth), Tailwind + shadcn/ui, Vercel.

O projeto está em `/` — leia todos os arquivos de `src/`, `supabase/migrations/`, `supabase/functions/` e arquivos de configuração raiz.

## O que fazer

1. Leia toda a estrutura do projeto — rotas, componentes, services, libs, server functions, migrations SQL, funções edge e configurações.

2. Divida o app em setores lógicos de análise. Cada setor deve ser independente o suficiente para ser analisado em uma sessão separada.

3. Para cada setor, liste os arquivos que o compõem.

4. Ao final, produza um **roteiro numerado** — a ordem em que os setores devem ser analisados, priorizando: maior risco de segurança e LGPD primeiro, depois maior impacto de uso, depois dependências que bloqueiam outros setores.

## Quando cada setor for analisado (nas próximas sessões), a análise cobrirá

- Usabilidade: fluxos completos, estados de erro/vazio/loading, feedbacks visuais, consistência
- Segurança: RLS correto, ServerFns autenticados, dados sensíveis protegidos, rate limiting
- LGPD: base legal, dados de saúde protegidos, audit log, direito ao esquecimento, consentimento
- Qualidade: TypeScript strict, sem console.log com dados, validação Zod, tratamento de erros
- Bugs e fluxos incompletos: casos de borda, dead ends, race conditions, redirecionamentos errados

## Formato de saída

Para cada setor:
- Nome e descrição em uma linha
- Lista de arquivos
- Riscos específicos que saltam à vista só de ver os arquivos (sem análise profunda ainda)

Ao final: o roteiro numerado com a ordem de análise e o motivo de cada prioridade.

Não analise. Apenas mapeie e gere o roteiro.
