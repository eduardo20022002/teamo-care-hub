# ADR-002 — Supabase Auth com verificação de email obrigatória

**Data:** 2026-05  
**Status:** Aceito

## Decisão

Usar Supabase Auth com verificação de email via magic link antes de qualquer acesso autenticado.

## Razões

- `email_confirmed_at` é verificado no guard `_auth.tsx` — usuário sem confirmação é redirecionado para `/verificar-conta`
- Magic link (não OTP numérico) foi escolhido pela simplicidade: sem input necessário, clique no email ativa a conta
- `emailRedirectTo` aponta para `/onboarding` — destino após confirmação

## Consequências

- Usuário precisa ter acesso ao email cadastrado antes de usar qualquer feature
- `sessionStorage("teamo:pendingEmail")` passa o email entre `/cadastro` e `/verificar-conta`
- Sem Twilio, OTP por SMS não está disponível — SMS pode ser adicionado futuramente
