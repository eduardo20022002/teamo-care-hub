# Monetização desligada — como reativar

Este documento registra o **kill-switch de cobrança** do TEAmo: o que ele faz,
onde atua e como reativar a cobrança quando (e se) quiser.

## Estado atual

A cobrança está **DESLIGADA**. Todos os usuários têm acesso total ao app (como
se fossem Premium), e **nenhuma superfície de cobrança aparece** (sem paywall,
sem modais de upgrade, sem selos de plano, sem página de planos). O código do
sistema de pagamento (AbacatePay, webhook, tabelas `subscriptions`, componentes
premium) **continua intacto no repositório** — apenas dormente. Nada foi
deletado.

## O interruptor

Fonte única de verdade: a constante em `src/lib/plan-limits.ts`.

```ts
export const BILLING_ENABLED = false; // false = cobrança desligada
```

- `false` → cobrança **desligada** (estado atual)
- `true`  → cobrança **ligada** (freemium normal: gates + paywall + AbacatePay)

## O que o flag controla

Quando `BILLING_ENABLED === false`:

### Backend — `src/lib/subscription.server.ts`
- `getTherapistPlan`, `getParentPlan`, `getClinicPlan` retornam `"premium"` no
  topo. Isso cobre **todo** o enforcement do servidor, porque os asserts e gates
  espalhados (`isTherapistPremium`/`isParentPremium`/`isClinicPremium`,
  `assertTherapistPremium`/`assertParentPremium`, `clinicGateError` e as
  checagens de limite em ~11 arquivos `*.functions.ts`) derivam dessas 3 funções.
- `runGetMySubscriptionStatus` e `runGetClinicPlanStatus` retornam planos
  `"premium"` (status `"active"`, sem trial) → a UI (`usePlan`/`useClinicPlan`)
  enxerga premium. É isso que libera os limites de **pais** (registros/documentos),
  que só têm gate no frontend.
- `runCreateSubscriptionCheckout` retorna `{ ok:false, error:"BILLING_DISABLED" }`
  logo no início → ninguém alcança o AbacatePay, nem por chamada direta.

### Frontend
- `src/components/premium/PlanStatusChip.tsx` retorna `null` → nenhum selo de
  plano no dashboard (terapeuta, pais) nem na home da clínica.
- Rotas `src/routes/_auth/premium.tsx` e `premium.ativado.tsx` redirecionam para
  `/dashboard` no `beforeLoad`.
- Todo o resto (`UpgradeModal`, `PremiumPreview`, `UsageBar`, `PremiumBadge`,
  chamadas `openUpgrade`) se esconde **automaticamente**, porque toda guarda de
  UI checa `isPremium`, que agora é sempre verdadeiro.

## Como reativar a cobrança

### Passo 1 — religar o freemium (volta tudo como era)

1. Em `src/lib/plan-limits.ts`, trocar `BILLING_ENABLED` para `true`.
2. Redeploy.

Pronto: gates, paywall, selos de plano e a página `/premium` voltam
exatamente como eram antes. **Nada mais precisa mudar** no código.

### Passo 2 — cobrar de verdade (sair do sandbox AbacatePay)

O AbacatePay está em **devMode (sandbox)** — processa pagamentos de teste, não
cobra dinheiro real. Para cobrar de verdade, além do Passo 1:

1. No painel AbacatePay: **desativar o Dev Mode**.
2. Gerar a **API key de produção** e atualizar `ABACATEPAY_API_KEY` em `.env`,
   Vercel e secrets do Supabase.
3. **Recriar os 3 produtos** com `devMode: false` (os atuais têm `devMode:true`)
   e atualizar `ABACATEPAY_PRODUCT_THERAPIST_ID`, `ABACATEPAY_PRODUCT_PARENT_ID`,
   `ABACATEPAY_PRODUCT_CLINIC_ID` nos mesmos 3 lugares.
4. Registrar o **webhook de produção** e atualizar o `ABACATEPAY_WEBHOOK_SECRET`.
5. Testar 1 cobrança real com cartão de verdade (fluxo `/premium` → checkout →
   `/premium/ativado`, confirmando `subscriptions` + `*_plan = 'premium'` no banco).

## Referências

- Planos e limites: `src/lib/plan-limits.ts`
- Gates e checkout: `src/lib/subscription.server.ts`, `src/lib/subscription.functions.ts`
- Webhook: `supabase/functions/abacatepay-webhook/index.ts`
- Hooks de UI: `src/services/subscription.service.ts`
- Componentes premium: `src/components/premium/`
