## Plano — C4 / RF-03: Anexação de documentos

### 1. Páginas e componentes a criar

**Componentes (`src/components/attachments/`):**

- `AttachmentUploader.tsx` — botão "Anexar arquivo" + input file oculto. Aceita múltiplos arquivos, valida formato e tamanho no cliente antes do upload, exibe lista de uploads em andamento com spinner por arquivo. Props: `scope: "record" | "child"`, `parentId: string`, `onUploaded?`.
- `AttachmentList.tsx` — lista os anexos já salvos. Renderiza miniatura para JPG/PNG (URL assinada do Storage) e ícone de PDF para documentos. Mostra nome, tamanho formatado e data. Ações: "Visualizar/Baixar" e "Remover".
- `AttachmentItem.tsx` — item individual reutilizado pela lista (mantém o card enxuto).
- `DeleteAttachmentDialog.tsx` — `AlertDialog` de confirmação para remoção.
- `EmptyAttachments.tsx` — estado vazio amigável para a aba "Documentos" da criança.
- `ChildDocumentsDialog.tsx` — dialog que abre a partir do `ChildCard` com `AttachmentUploader` + `AttachmentList` no escopo "child". Mantém o padrão de Dialog dos ciclos anteriores em vez de criar uma rota nova.

**Rotas:** nenhuma rota nova — anexo de atendimento vive dentro do `AttendanceCard`/`AttendanceFormDialog` existentes; documentos da criança vivem em um Dialog acessível pelo `ChildCard`.

### 2. Funções de service

`src/services/attachments.service.ts` — única camada que toca Supabase Storage e as tabelas de anexos:

- `listRecordAttachments(recordId)` / `listChildAttachments(childId)`
- `uploadRecordAttachment(userId, recordId, file)` / `uploadChildAttachment(userId, childId, file)` — faz upload no bucket e insere a linha de metadados na tabela correspondente, em uma única função (transação lógica: se o INSERT falhar, remove o arquivo do Storage).
- `deleteRecordAttachment(attachment)` / `deleteChildAttachment(attachment)` — remove a linha e o arquivo do Storage.
- `getAttachmentSignedUrl(storagePath)` — gera URL assinada de curta duração (60s) para visualizar/baixar.

`src/lib/validation.ts` — adicionar:
- `ALLOWED_ATTACHMENT_MIME = ["application/pdf", "image/jpeg", "image/png"]`
- `MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024`
- `validateAttachmentFile(file)` retornando `{ ok: true } | { ok: false, error: string }` com mensagens em PT-BR ("Formato não suportado. Aceitos: PDF, JPG, PNG.", "Arquivo acima de 10 MB.").

`src/lib/formatters.ts` — adicionar `formatFileSize(bytes)`.

### 3. Schema do Supabase

**Tabela `public.record_attachments`:**

| coluna | tipo | nulo | observação |
|---|---|---|---|
| `id` | uuid PK | não | `gen_random_uuid()` |
| `user_id` | uuid | não | dono (RLS) |
| `record_id` | uuid | não | FK → `attendance_records(id)` `ON DELETE CASCADE` |
| `storage_path` | text | não | caminho dentro do bucket |
| `file_name` | text | não | nome original exibido ao usuário |
| `mime_type` | text | não | validado na aplicação |
| `size_bytes` | bigint | não | |
| `created_at` | timestamptz | não | `now()` |

**Tabela `public.child_attachments`:** mesma estrutura, trocando `record_id` por `child_id` (FK → `children(id)` `ON DELETE CASCADE`).

- Índices: `(user_id, created_at desc)`, `(record_id)` / `(child_id)`.
- RLS habilitada nas duas tabelas, com 4 políticas (`SELECT/INSERT/UPDATE/DELETE`) usando `auth.uid() = user_id` — mesmo padrão dos C1/C2/C3.
- Sem `updated_at` nem trigger: anexo é imutável (substituir = remover + reenviar). Reduz superfície e mantém consistência com Storage.
- Política de exclusão: `ON DELETE CASCADE` garante que apagar o registro de atendimento ou a criança limpa as linhas; a limpeza dos arquivos no Storage é feita pelo service (chama `delete` antes do DELETE da linha quando o usuário remove pela UI).

**Tipos** em `src/types/database.ts`: `RecordAttachment`, `RecordAttachmentInsert`, `ChildAttachment`, `ChildAttachmentInsert`.

### 4. Estrutura do Supabase Storage

**Bucket:** `attachments` — **privado** (visualização sempre via URL assinada; protege contra acesso direto por URL).

**Paths:**
- Atendimento: `records/{user_id}/{record_id}/{uuid}-{slug-do-nome}.{ext}`
- Criança: `children/{user_id}/{child_id}/{uuid}-{slug-do-nome}.{ext}`

Prefixar com `{user_id}` no path permite escrever políticas de Storage robustas usando `(storage.foldername(name))[1] = auth.uid()::text`. Slug + uuid no nome final evita colisão e caracteres problemáticos, mas o `file_name` original é preservado na tabela para exibição.

**Políticas de storage** sobre `storage.objects` para o bucket `attachments` (4 políticas — SELECT/INSERT/UPDATE/DELETE), todas com:
```
bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text
```

### 5. Sequência de implementação

1. Migration: tabelas `record_attachments` e `child_attachments` + índices + RLS.
2. Migration: criação do bucket `attachments` (privado) + 4 políticas em `storage.objects`.
3. Tipos derivados em `src/types/database.ts`.
4. Validação + formatadores em `src/lib/`.
5. `attachments.service.ts` (upload com rollback, delete, signed URL, list).
6. Componentes de UI em `src/components/attachments/`.
7. Integrar no `AttendanceFormDialog`: na **edição** de um registro existente, mostrar `AttachmentUploader` + `AttachmentList`. Na **criação**, mostrar nota "Salve o registro para anexar arquivos" (anexos só após existir `record_id`). Alternativa avaliada: upload em duas fases após o submit do registro novo — descartada por complexidade desproporcional.
8. Integrar no `AttendanceCard`: mostrar contagem de anexos e expansão inline com `AttachmentList`.
9. Integrar no `ChildCard`: novo botão "Documentos" que abre `ChildDocumentsDialog`.
10. Atualizar README.

### 6. Decisões em aberto que precisam de confirmação

1. **Anexar arquivos durante a criação de um registro novo (antes do registro existir):**
   - **Proposta:** anexos só ficam disponíveis após o registro ser salvo (na edição). Na criação, mensagem "Salve o registro para começar a anexar documentos." Mantém o upload simples e atômico.
   - Alternativa: buffer no cliente + upload pós-INSERT (mais complexo, lida com falhas parciais).
   - Confirmar a proposta?

2. **Onde abrir os "Documentos da criança":**
   - **Proposta:** Dialog acionado por botão "Documentos" no `ChildCard` (consistente com o padrão de Dialog dos ciclos anteriores, sem criar rota nova).
   - Alternativa: rota dedicada `/_auth/criancas/$childId/documentos`.
   - Confirmar a proposta?

3. **Bucket privado + URL assinada vs. bucket público:**
   - **Proposta:** **privado** com URL assinada de 60s sob demanda. Atende RNF-09 (cada pai acessa só os próprios anexos) mesmo se o caminho vazar.
   - Confirmar a proposta?

4. **Múltiplos arquivos em uma única ação:**
   - **Proposta:** input com `multiple`, mas cada arquivo é validado e enviado individualmente (um falhar não derruba os outros). Cada upload mostra spinner próprio; toasts agregados ao final.
   - Confirmar a proposta?

5. **Indicador de progresso real vs. spinner:**
   - **Proposta:** spinner (estado "enviando") + barra indeterminada por arquivo. O SDK do Storage do Supabase não expõe progresso de upload de forma confiável no browser; barra real exigiria `XMLHttpRequest` direto contra o endpoint de Storage, fugindo do padrão do projeto (apenas o service toca Supabase).
   - Confirmar spinner/indeterminada?

6. **Limite de quantidade de anexos por registro/criança:**
   - **Proposta:** sem limite rígido neste ciclo (apenas o teto de 10 MB por arquivo). Se quiser teto (ex.: 20 por registro), defina aqui.

Aguardo aprovação e respostas às 6 decisões antes de implementar.
