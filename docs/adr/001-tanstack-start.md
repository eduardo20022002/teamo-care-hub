# ADR-001 — TanStack Start como framework principal

**Data:** 2026-05  
**Status:** Aceito

## Decisão

Usar TanStack Start (React 19 + TanStack Router + Nitro) como framework fullstack, em vez de Next.js.

## Razões

- TanStack Router oferece type-safety completa nas rotas (params, search params, loaders)
- Nitro como servidor permite deploy no Vercel sem lock-in ao Next.js
- File-based routing com `createFileRoute` elimina configuração manual
- SSR opcional por rota, sem overhead onde não é necessário

## Consequências

- A skill `vercel-react-best-practices` é focada em Next.js — aplicar padrões gerais de React, ignorar APIs específicas do Next.js (`app/`, `page.tsx`, `layout.tsx`, `use server`)
- Rotas são geradas em `routeTree.gen.ts` — não editar manualmente
- ServerFn substitui API Routes do Next.js
