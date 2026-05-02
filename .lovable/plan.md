# Plano — Anexos no formulário de novo registro + Central de Documentos

## 1. Anexar documentos ao **criar** um registro

Hoje, anexos só aparecem na **edição** (`AttendanceFormDialog` mostra "Salve o registro para começar a anexar documentos." na criação). Vamos permitir anexar já na criação.

**Abordagem:** "anexos pendentes em memória" — o usuário escolhe arquivos, eles ficam em uma fila local validada (sem subir ao Storage). Ao salvar o registro com sucesso, fazemos o upload de cada arquivo vinculado ao `record_id` recém-criado. Se algum upload falhar, o registro permanece criado e exibimos toast por arquivo com falha.

Mudanças:
- `AttendanceFormDialog.tsx`: substituir a mensagem "Salve o registro..." por uma **fila de arquivos pendentes** (lista com nome, tamanho, ícone e botão "remover"). Reaproveitar `AttachmentUploader` em modo "fila" (callback `onFiles` empurra para state local em vez de subir).
- Expor no `onSubmit` do diálogo um segundo argumento opcional: `pendingFiles: File[]`, OU emitir um callback `onCreated(recordId)` que dispare o upload. Decisão: **manter assinatura atual** e introduzir um novo prop `onCreate?: (data, files) => Promise<void>`; quando passado, é usado no lugar de `onSubmit` para criação. `onSubmit` continua para edição.
- `dashboard.tsx` e `registros.tsx`: ao receber `onCreate`, chamar `createAttendanceRecord` → pegar `record.id` retornado → fazer `uploadRecordAttachment` em loop (com toasts agregados de sucesso/falha) → invalidar queries.
- `attendance.service.ts`: garantir que `createAttendanceRecord` retorne o `id` do registro (verificar; ajustar se necessário).

Componentes novos:
- `src/components/attachments/PendingAttachmentsList.tsx` — lista visual simples para a fila local de `File[]` com remover.

## 2. Documentos da criança (avulsos) — manter

Já existe via `ChildDocumentsDialog` aberto pelo botão "Documentos" no `ChildCard`. **Sem mudanças**, apenas confirmar que continua funcionando. Esses anexos vivem em `child_attachments` e não estão atrelados a registros.

## 3. Acesso rápido **"Documentos"** no dashboard

Hoje a grade de Acessos rápidos tem 2 cards (Profissionais, Registros). Vamos para **3 cards** mantendo o layout 2-por-linha responsivo (no mobile, o terceiro card ocupa a linha inteira; em telas ≥ sm, vira grade de 2 colunas com 3 itens fluindo naturalmente).

- Adicionar 3º card "Documentos" (ícone `FolderOpen`) → leva para nova rota `/documentos`.
- Layout mantém `grid-cols-2 gap-3`. O 3º card simplesmente quebra para a linha de baixo ocupando metade da largura no mobile (ou full-width via `col-span-2` se preferir destaque). **Decisão proposta:** manter `grid-cols-2`, 3 cards, terceiro fica sozinho na 2ª linha ocupando uma coluna. Visualmente equilibrado e consistente.

## 4. Página `/documentos` — Central de documentos com filtros

Nova rota: `src/routes/_auth/documentos.tsx`.

**Conteúdo:**
- Header com título "Documentos" + voltar para dashboard.
- Filtros (em uma barra superior, responsiva):
  - **Criança**: select (Todas | cada criança).
  - **Origem**: select (Todos | Documentos da criança | Anexos de registros).
  - **Tipo de arquivo**: select (Todos | PDF | Imagens).
  - **Busca por nome**: input de texto que filtra `file_name` (case-insensitive, sem acento).
  - **Período**: opcional — select rápido (Todos | Últimos 7 dias | Últimos 30 dias | Este ano).
- Botão "Adicionar documento" abre dialog onde o usuário escolhe a criança e os arquivos (cria entradas em `child_attachments`). Reutiliza `AttachmentUploader`.
- Lista unificada (cards) ordenada por `created_at desc`, mostrando: nome, tamanho, data, criança, origem (badge: "Documento da criança" ou "Anexo do registro · {categoria/data}"), ações (abrir, excluir).
- Estado vazio dedicado.

**Serviço novo** `src/services/documents.service.ts`:
- `listAllDocuments()` — faz duas queries em paralelo (`child_attachments` join `children`, `record_attachments` join `attendance_records` + `children`), normaliza num shape comum:
  ```ts
  type UnifiedDocument = {
    id: string;
    source: "child" | "record";
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    child_id: string;
    child_name: string;
    record_id?: string;
    record_category?: string;
    record_date?: string;
  }
  ```
- Filtragem é feita client-side em cima do array (volume baixo no MVP, sem necessidade de paginação).

**Componentes novos:**
- `src/components/documents/DocumentFilters.tsx` — barra de filtros controlada.
- `src/components/documents/DocumentCard.tsx` — card unificado (similar a `AttachmentItem` mas com badge de origem e nome da criança).
- `src/components/documents/AddChildDocumentDialog.tsx` — dialog com select de criança + uploader.
- `src/components/documents/EmptyDocuments.tsx`.

## 5. Ajustes técnicos

- `attendance.service.ts`: confirmar que `createAttendanceRecord` retorna `{ id, ... }` (já parece retornar `.select().single()`).
- `routeTree.gen.ts`: gerado automaticamente após criar `/documentos`.
- Filtro por nome: helper de normalização (`lower + remover diacríticos`) — pode reusar abordagem de `slugifyName` em `attachments.service.ts`.

## 6. O que NÃO muda

- Estrutura das tabelas `record_attachments` e `child_attachments`, RLS, bucket privado, URLs assinadas.
- Componentes `AttachmentUploader`, `AttachmentItem`, `AttachmentList`, `DeleteAttachmentDialog`, `RecordAttachmentsSection`, `ChildDocumentsDialog`.
- Limites: 10 MB, PDF/JPG/PNG.

## 7. Pontos a confirmar

1. **Upload na criação do registro:** confirmar abordagem "fila local + upload pós-save". Se algum upload falhar, o registro fica criado com toast informando os arquivos que falharam (usuário pode reabrir em edição e tentar de novo). OK?
2. **Adicionar documento na Central:** propus dialog com select de criança obrigatório (sem criança não dá pra anexar avulso). OK?
3. **Layout do 3º acesso rápido:** manter `grid-cols-2` com o 3º card ocupando metade da largura na 2ª linha (assimetria leve). Alternativa: 3º card com `col-span-2` (full-width). Qual prefere?
4. **Filtro de período:** vale incluir agora ou deixar fora do MVP (apenas criança + origem + tipo + busca por nome)?
