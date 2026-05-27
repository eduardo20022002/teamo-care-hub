# Tarefa: Módulo de Observabilidade — Painel Admin

## O que precisa ser feito

### 1. Acesso via menu

No menu que abre ao clicar nos três traços no canto superior direito (`AccountMenuDrawer`), adicionar uma seção chamada **"Administração"** visível apenas para usuários com `is_admin = true`. Essa seção deve ter duas opções:

- **Painel** → navega para `/painel`
- **Feedbacks** → navega para `/feedbacks`

A rota `/feedbacks` já existe e já funciona. O `AppShell` já busca `is_admin` do perfil — só precisa passar esse valor para o drawer e renderizar a seção condicionalmente.

---

### 2. Rota `/painel` — Painel Admin

A rota `/painel` existe mas hoje apenas redireciona. Transformá-la em um painel real de métricas, acessível apenas por admins (redirecionar para `/dashboard` se não for admin).

O painel deve ter três seções:

---

#### Seção 1 — Saúde Técnica

Métricas que indicam se o app está funcionando. O objetivo é saber de problemas antes que o usuário reclame:

- Erros de JavaScript capturados (por rota e frequência)
- Falhas de Edge Functions (invocações, falhas, tempo médio)
- Latência de queries ao banco
- Web Vitals por rota (LCP, CLS, INP) — o Vercel Analytics já coleta isso
- Taxa de erro por rota de API (4xx e 5xx)
- Status de disponibilidade do app e do Supabase

---

#### Seção 2 — Comportamento dos Usuários

Métricas de como os usuários usam o produto, baseadas em **eventos anonimizados** (nunca conteúdo clínico, nunca nomes):

- Funil de onboarding: em qual etapa as pessoas abandonam
- Adoção por módulo: quais módulos são abertos, quais têm ação criada (Registros, Documentos, Agenda, Profissionais, Compartilhamento)
- Profundidade de sessão: quantas ações distintas por sessão
- Funis de fluxos críticos: convite de co-cuidador, convite de profissional, upload de documento — com taxa de conclusão por etapa
- Uso do compartilhamento OTP: criados vs. acessados vs. expirados sem acesso
- Padrões de retorno: dias e horários de maior uso

Para isso, criar uma tabela `analytics_events` no banco que recebe eventos disparados pelo app. Os eventos carregam apenas metadados (tipo de ação, módulo, rota) — **jamais conteúdo, nomes ou dados clínicos**. Criar um `analytics.service.ts` centralizado para disparar esses eventos nos pontos certos do app (auth, onboarding, abertura de módulos, criação de itens).

---

#### Seção 3 — Saúde do Negócio

Métricas agregadas que respondem se o produto está crescendo e gerando valor:

- Total de cuidadores, profissionais e crianças cadastradas
- Crescimento semana a semana e mês a mês
- Taxa de ativação: % que completa onboarding e cria o primeiro item em 7 dias
- Retenção por coorte: semanas X+1, X+2, X+4, X+8
- DAU / WAU / MAU e stickiness (DAU/MAU)
- Volume gerado: registros criados, documentos enviados, eventos de agenda, links OTP
- Vínculos ativos: crianças com profissional vinculado, crianças com co-cuidador
- Churn: usuários que ficaram mais de 30 dias sem acessar

---

## Regras importantes

- O painel é exclusivo para `is_admin = true`. Dois bloqueios: guard na rota (frontend) e verificação no backend antes de qualquer query.
- Nenhum evento de analytics pode conter conteúdo clínico, nomes de crianças, profissionais ou cuidadores, textos de registros ou diagnósticos. Apenas tipos, contagens e metadados de ação.
- Falhas no disparo de eventos devem ser silenciosas — analytics nunca quebra a UX do usuário.
- Inserção em `analytics_events` apenas via ServerFn (nunca direto pelo cliente).
