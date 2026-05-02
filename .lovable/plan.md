## C7 — RF-07 + RF-08: Compartilhamento seguro com OTP

### 1. Páginas e componentes a criar

**Rotas (src/routes/)**
- `compartilhamento.$token.tsx` — rota pública (fora de `_auth`), sem AppShell. Tela de OTP + visualização do conteúdo com marca d'água. Trata estados: aguardando OTP, OTP enviado, OTP inválido, link expirado, link revogado, link já consumido.
- `_auth/compartilhamentos.tsx` — área autenticada listando todos os compartilhamentos do pai com status (ativo/expirado/revogado/consumido), destinatário, escopo resumido e botão revogar.

**Componentes (src/components/sharing/)**
- `ShareDialog.tsx` — Dialog reutilizável com fluxo em 4 etapas (stepper visual). Aceita props `preSelectedRecords?`, `preSelectedDocuments?`, `preSelectedProfessional?`. Etapas: (1) seleção de conteúdo; (2) escolha do profissional + cadastro rápido inline; (3) prazo (6h / 24h / 48h); (4) confirmação + link gerado + botão "Enviar" via Web Share API.
- `ShareContentStep.tsx` — etapa 1: lista de registros e documentos do pai com checkboxes, agrupados por criança, com filtro/busca leve.
- `ShareProfessionalStep.tsx` — etapa 2: lista de profissionais com busca + botão "Cadastrar novo profissional" que expande mini-form inline (Zod `professionalSchema`) sem fechar o Dialog.
- `ShareExpiryStep.tsx` — etapa 3: radio com 3 opções de prazo.
- `ShareConfirmationStep.tsx` — etapa 4: link gerado, botão "Enviar" (Web Share API), botão "Copiar link" (fallback), link "Ver compartilhamentos ativos".
- `ShareStepper.tsx` — indicador visual de progresso entre etapas.
- `ShareTriggerButton.tsx` — pequeno botão `Share2` reutilizado em AttendanceCard, AttachmentItem e cards de busca.

**Componentes de tela pública (src/components/sharing/public/)**
- `OtpRequestForm.tsx` — formulário inicial: pede OTP (envia automaticamente ao montar) com input OTP de 6 dígitos.
- `SharedContentView.tsx` — visualização dos registros/documentos liberados, com cards reutilizando `CategoryBadge` e `formatDateBR`. Componente `WatermarkOverlay` fixo sobre o conteúdo.
- `SharedRecordCard.tsx` / `SharedDocumentItem.tsx` — versões somente-leitura de AttendanceCard/AttachmentItem (sem editar/excluir).
- `WatermarkOverlay.tsx` — div fixed com `pointer-events:none`, repetindo "{nome do profissional} · {timestamp}" em diagonal, baixa opacidade, sobre todo o conteúdo.
- `ResponseAreaPlaceholder.tsx` — espaço visual de resposta desabilitado, com aviso "Disponível em breve".
- `ShareErrorState.tsx` — tela amigável para link expirado/revogado/consumido/inválido.

**Componentes auxiliares**
- `src/components/sharing/ShareCardDashboard.tsx` — card "Compartilhar" no dashboard.
- `src/components/sharing/ActiveSharesList.tsx` + `ActiveShareCard.tsx` — lista da tela `/compartilhamentos` com badge de status e botão revogar (AlertDialog de confirmação).

### 2. Funções de service

**`src/services/sharing.service.ts`** (única camada com acesso a Supabase)
- `createShare({ professionalId, expiresInHours, recordIds, documentIds }) → { share, publicUrl }` — invoca Edge Function `create-share` que cria `shares` + `share_items` + signed URL público no formato `/compartilhamento/<token>`.
- `listShares() → ShareWithRelations[]` — lista compartilhamentos do pai com profissional + contagem de itens + status derivado.
- `revokeShare(id)` — UPDATE `revoked_at = now()`.
- `searchSharesForGlobalSearch(query, opts)` — usado pelo `search.service.ts`.

**`src/services/sharing-public.service.ts`** (chamada de rota pública, sem cliente Supabase autenticado — usa `fetch` direto para Edge Functions)
- `requestShareOtp(token) → { sent: true, professionalEmailMasked }` — chama Edge Function `request-share-otp`.
- `validateShareOtp(token, otp) → { accessToken, content }` — chama Edge Function `validate-share-otp`. Retorna conteúdo já carregado e access token de curta duração para gerar signed URLs dos documentos.
- `getSharedDocumentUrl(token, accessToken, documentRef)` — chama Edge Function `shared-document-url` que valida o access token e devolve signed URL.

**Modificação em `src/services/search.service.ts`**
- Nova `sharesSource` registrada em `SEARCH_SOURCES`. Indexa por nome do profissional destinatário e por nomes dos itens incluídos. Hits levam a `/compartilhamentos`.

### 3. Schema do Supabase

**Tabela `shares`**
```text
id              uuid PK default gen_random_uuid()
user_id         uuid not null
professional_id uuid not null
token           text not null unique         -- 32 bytes random base64url
otp_hash        text                          -- SHA-256 do OTP atual; null até 1ª solicitação
otp_expires_at  timestamptz                   -- expira 10 min após gerar
otp_attempts    int  not null default 0       -- protege contra brute force (máx 5)
expires_at      timestamptz not null          -- 48h máx a partir do create
revoked_at      timestamptz
consumed_at     timestamptz                   -- preenchido após acesso bem-sucedido
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()
```

**Tabela `share_items`**
```text
id           uuid PK default gen_random_uuid()
share_id     uuid not null  -- ON DELETE CASCADE via trigger (sem FK física, mantendo padrão do projeto)
user_id      uuid not null
item_type    text not null  -- 'record' | 'document_record' | 'document_child'
item_id      uuid not null
created_at   timestamptz not null default now()
```

**RLS — `shares` e `share_items`**
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id` (o pai só vê os próprios).
- Acesso público via Edge Functions (com `SUPABASE_SERVICE_ROLE_KEY`) — RLS continua restritivo, profissional nunca consulta direto.

**Validações via trigger** (não CHECK constraint, conforme guideline)
- `expires_at` ≤ `created_at + interval '48 hours'`.
- `expires_at` > `created_at`.

**Trigger** `update_updated_at_column` em `shares`.

**Auditoria** — sem nova tabela: usar `audit_logs` existente. Novos `event_type`:
- `share.created`, `share.revoked`, `share.otp_requested`, `share.otp_failed`, `share.otp_succeeded`, `share.access_denied_expired`, `share.access_denied_revoked`, `share.access_denied_consumed`.
- Metadata sempre inclui `share_id`. Nunca grava o OTP em texto claro.

### 4. Estratégia de geração e validação do OTP

- OTP de 6 dígitos numéricos (`crypto.getRandomValues` no Edge Function).
- Armazenado como hash SHA-256 (`otp_hash`), nunca em texto claro.
- TTL de 10 minutos (`otp_expires_at`). Reenviar gera novo OTP e zera `otp_attempts`.
- Máx 5 tentativas (`otp_attempts`). Excedeu → bloqueia o link (mesmo efeito de revogado) e registra em `audit_logs`.
- Comparação em tempo constante (timing-safe) no Edge Function.
- Após validação correta: marca `consumed_at`, devolve um JWT curto (HS256, 30 min, segredo no Edge) que autoriza apenas signed URLs dos documentos daquele share — não permite re-acesso ao link em si.

### 5. Estratégia de envio de e-mail

Conforme regra do projeto: **usar Lovable Email** (zero-config). Sequência:
1. `email_domain--check_email_domain_status` — se não houver domínio, exibir o setup dialog ao usuário antes de seguir.
2. Após domínio configurado: `email_domain--setup_email_infra` (cria infra de fila).
3. `email_domain--scaffold_transactional_email` (cria server routes e registry).
4. Criar template React Email `share-otp.tsx` em `src/lib/email-templates/` com:
   - Saudação ao profissional (`{name}`)
   - Nome do responsável que compartilhou (`{parentName}`)
   - OTP em destaque (`{otp}`)
   - Aviso "código válido por 10 min, link expira em até 48h, uso único"
   - Sem link (o link já está com o profissional). Sem unsubscribe próprio (system-managed).
5. Edge Function `request-share-otp` chama `sendTransactionalEmail({ templateName: 'share-otp', recipientEmail, idempotencyKey: 'share-otp-' + shareId + '-' + nonce, templateData })`.
6. **Fallback** (RNF-12): se o envio falhar, a tela pública mostra "Não foi possível enviar agora. Tente novamente em instantes." e permite reenvio manual; o fluxo do pai não é bloqueado.

### 6. Estratégia de marca d'água

- Componente puramente CSS: `WatermarkOverlay` em `position:fixed inset-0 pointer-events-none z-50`, contendo um grid de spans com `transform: rotate(-30deg)`, `opacity: 0.12`, `font-size: clamp(14px, 2vw, 18px)`, repetindo `"{professionalName} · {timestamp ISO}"`.
- Renderizada no nível mais alto da rota pública, acima de todo conteúdo, mas abaixo de modais nativos.
- Não removível via DevTools de forma trivial (renderizada em todo refresh; texto vem do servidor junto com o conteúdo). Aviso explícito de uso responsável.

### 7. Web Share API + fallback

Hook `useShareLink()` em `src/hooks/useShareLink.ts`:
```text
async function share({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ title, text, url }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
```
UI mostra um único botão "Enviar"; o toast confirma ("Compartilhamento enviado." ou "Link copiado para a área de transferência.").

### 8. Rota pública

- `/compartilhamento/$token` — fora de `_auth`, sem AppShell. Layout próprio com `BrandLogo`. Mobile-first.
- Estados:
  - **Inicial:** chama `request-share-otp` ao montar; mostra "Enviamos um código de 6 dígitos para o e-mail cadastrado." + input OTP.
  - **Validando:** chama `validate-share-otp`; em sucesso, exibe `SharedContentView`.
  - **Erros:** "Link expirado", "Acesso revogado pelo responsável", "Este link já foi utilizado", "Código incorreto" (com contagem de tentativas restantes).
- `ResponseAreaPlaceholder` desabilitado, indicando "Disponível em breve" (gancho para C9).

### 9. Registro em `search.service.ts`

Nova `sharesSource` (kind: `'share'`):
- Busca: nome do profissional destinatário + títulos dos itens incluídos (truncados).
- Sem termo: lista todos compartilhamentos por `created_at` desc.
- Hit `payload`: `{ kind: 'share', share }`. Click navega para `/compartilhamentos`.
- `SearchKindLabel` adiciona `share: "Compartilhamentos"`.
- Filtros existentes (`dateFrom/dateTo`) aplicam-se via `created_at`.

### 10. Sequência de implementação

1. **Infra de e-mail**: `check_email_domain_status` → setup dialog se necessário → `setup_email_infra` → `scaffold_transactional_email` → criar template `share-otp.tsx` → registrar em `registry.ts`.
2. **Banco**: migração com tabelas `shares` e `share_items`, RLS, triggers, índices em `(user_id, created_at desc)` e `(token)`.
3. **Edge Functions** em `supabase/functions/` (TanStack server routes em `src/routes/api/public/share/*.ts`):
   - `POST /api/public/share/request-otp` (gera OTP, envia e-mail).
   - `POST /api/public/share/validate-otp` (valida OTP, marca consumed, devolve JWT + conteúdo).
   - `GET  /api/public/share/document-url` (valida JWT curto, gera signed URL).
   - `POST /api/share/create` (autenticado, cria share — pode ser server function `createServerFn` em vez de rota pública).
4. **Service layer**: `sharing.service.ts` + `sharing-public.service.ts` + atualização do `search.service.ts`.
5. **ShareDialog** completo + stepper + cadastro inline de profissional.
6. **Pontos de entrada**: card no dashboard, botão em AttendanceCard, AttachmentItem, AttendanceFormDialog (após salvar), perfil de profissional, resultado da busca global.
7. **Rota pública** `/compartilhamento/$token` com todos os estados + marca d'água.
8. **Tela** `/compartilhamentos` (lista + revogar).
9. **Itens menores**: substituir o card "Compartilhamento com profissionais" da seção "Em breve" por entrada real; remover do array `COMING_SOON` no dashboard.
10. **Auditoria** em todos os eventos relevantes.
11. Atualização do `README.md` com a nova fonte de busca e o fluxo de compartilhamento.

### 11. Decisões em aberto que precisam de confirmação

1. **Domínio de e-mail Lovable**: ainda não há domínio configurado no projeto. Antes de implementar, será necessário acionar o setup dialog. Você prefere (a) configurar agora um subdomínio próprio (`notify.<seu-domínio>`) ou (b) usar provisoriamente o domínio padrão do Lovable para validar o fluxo e configurar o seu depois? Sem domínio configurado, o envio fica em fila mas não dispara.
2. **Prazos pré-definidos**: vou oferecer **6h / 24h / 48h** como opções fixas (cumpre RF-08 critério 1 com simplicidade). Se preferir um seletor livre até 48h, posso trocar por input numérico de horas.
3. **Retroativo dashboard**: o card "Compartilhamento com profissionais" da seção "Em breve" será removido (a feature passa a existir). Confirma?
4. **Cadastro rápido inline**: o mini-formulário pedirá apenas **nome, especialidade e e-mail** (telefone fica opcional, oculto na criação rápida) para reduzir fricção. Confirma?
5. **Acesso único por link (RF-07 critério 7)**: após sucesso, o link é invalidado por completo. Caso o profissional precise rever, o pai precisará gerar novo link. Confirma essa interpretação estrita (alternativa: permitir múltiplos acessos do mesmo profissional dentro das 48h até o link ser revogado).
