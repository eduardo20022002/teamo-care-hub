## C5 — RF-05: CRUD completo de registros de atendimento

### Estado atual (já entregue em C3/C4)
- `AttendanceFormDialog` já abre em modo edição pré-preenchido e exibe `RecordAttachmentsSection` (lista + upload + remoção de anexos individuais).
- `AttendanceCard` já tem botões de editar e excluir no header.
- `registros.tsx` já tem `updateMutation` e `deleteMutation` ligados.
- `DeleteAttendanceDialog` já existe com `AlertDialog` + confirmação.
- `attendance.service.ts` já expõe `updateAttendanceRecord` e `deleteAttendanceRecord`.

### Lacunas a fechar neste ciclo

**1. Exclusão em cascata dos anexos (Critério 4)**
Hoje `deleteAttendanceRecord` só apaga a linha em `attendance_records`. Como `record_attachments` não tem FK com `ON DELETE CASCADE` para `attendance_records`, as linhas ficam órfãs e os arquivos no bucket nunca são removidos. Precisamos garantir consistência:

- Em `src/services/attachments.service.ts`: nova função `deleteAllRecordAttachments(recordId)` que:
  1. Faz `select(storage_path)` em `record_attachments` filtrando por `record_id`.
  2. Remove os objetos do bucket `attachments` em uma única chamada `storage.remove([...paths])`.
  3. Faz `delete` das linhas em `record_attachments` por `record_id`.
  4. Erros de Storage são best-effort (não bloqueiam exclusão da linha do banco), mas erros do `delete` propagam.

- Em `src/services/attendance.service.ts`: `deleteAttendanceRecord` passa a chamar `deleteAllRecordAttachments(id)` antes do `delete` na tabela. Ordem: anexos → registro. Garante que mesmo em falha parcial não fica registro com anexos órfãos referenciando-o.

**2. Mensagem da exclusão menciona anexos (Critério 3)**
- `DeleteAttendanceDialog` recebe nova prop opcional `attachmentCount?: number`. Quando > 0, o texto da `AlertDialogDescription` informa que os N anexos vinculados também serão removidos permanentemente.
- `registros.tsx`: ao abrir o dialog de exclusão, busca a contagem (já temos `countRecordAttachments`) ou aproveita o cache da query `["record-attachments-count", id]` populada pelo `AttendanceCard` ao renderizar.

**3. Edição/exclusão acessíveis também a partir do Dashboard (Critério 5)**
Hoje os cards das crianças no Dashboard não listam registros recentes — a listagem só existe em `/registros`. O critério pede acesso "a partir do painel ou da visualização do registro". A visualização do registro hoje é a página `/registros`, então o critério já é atendido por lá.

Decisão proposta: **não adicionar listagem de registros no Dashboard neste ciclo** (fora do escopo declarado em C3). O ChildCard já tem botão "Registrar atendimento" e link para os registros da criança via `/registros`. Isso satisfaz o critério 5 de "acessível em local consistente".

### Componentes a modificar

| Arquivo | Mudança |
|---|---|
| `src/services/attachments.service.ts` | Adicionar `deleteAllRecordAttachments(recordId)` |
| `src/services/attendance.service.ts` | `deleteAttendanceRecord` chama `deleteAllRecordAttachments` antes do delete da linha |
| `src/components/attendance/DeleteAttendanceDialog.tsx` | Aceitar `attachmentCount` opcional e ajustar copy |
| `src/routes/_auth/registros.tsx` | Passar `attachmentCount` ao dialog (via `useQuery` da contagem do registro em `deleting`) e invalidar `["record-attachments-count", id]` e `["documents-all"]` no `onSuccess` da exclusão |

Nenhum componente novo.

### Funções de service

**`src/services/attachments.service.ts`:**
```ts
export async function deleteAllRecordAttachments(recordId: string): Promise<void>
```
- `select("storage_path").eq("record_id", recordId)`
- `storage.from("attachments").remove(paths)` (best-effort)
- `delete().eq("record_id", recordId)` (propaga erro)

**`src/services/attendance.service.ts`:**
```ts
export async function deleteAttendanceRecord(id: string): Promise<void> {
  await deleteAllRecordAttachments(id); // anexos primeiro
  // depois delete da linha (inalterado)
}
```

### Comportamento esperado na exclusão de registro com anexos

1. Usuário clica no ícone de lixeira no `AttendanceCard`.
2. `AlertDialog` abre com mensagem: *"Esta ação não pode ser desfeita. O registro e seus N anexos serão removidos permanentemente."* (quando count > 0).
3. Ao confirmar:
   - Service remove arquivos do Storage (best-effort, não bloqueia).
   - Service remove linhas em `record_attachments` por `record_id`.
   - Service remove linha em `attendance_records`.
   - RLS garante que tudo é restrito a `auth.uid() = user_id`.
4. Toast de sucesso "Registro excluído.".
5. Queries invalidadas: `["attendance"]`, `["record-attachments", id]`, `["record-attachments-count", id]`, `["documents-all"]`.
6. Em caso de erro no delete da linha do registro: toast amigável; arquivos já removidos do bucket ficam apenas como inconsistência tolerável (bucket é privado, sem URLs ativas).

### Sequência de implementação

1. Adicionar `deleteAllRecordAttachments` em `attachments.service.ts`.
2. Encadear chamada em `deleteAttendanceRecord` (`attendance.service.ts`).
3. Atualizar `DeleteAttendanceDialog` para aceitar `attachmentCount` e ajustar copy.
4. Em `registros.tsx`:
   - `useQuery` de `countRecordAttachments` quando `deleting` está setado.
   - Passar contagem ao dialog.
   - Adicionar invalidations adicionais no `onSuccess`.
5. Validar manualmente: criar registro com 2 anexos → excluir → confirmar que (a) o registro some, (b) abrindo a Central de Documentos os anexos não aparecem mais, (c) toast de sucesso aparece.

### Decisões em aberto que precisam de confirmação

1. **Cascata via service vs. trigger no Postgres**: optei por fazer no service (mais visível, sem mudar schema). Alternativa seria criar uma FK `record_attachments.record_id → attendance_records.id ON DELETE CASCADE` + trigger para limpar Storage. **Confirma fazer no service?** (Mais simples, sem migration, e o C5 não pede schema change.)

2. **Exclusão do registro a partir do Dashboard**: como discutido, o critério 5 já é atendido pela página `/registros`. **Confirma manter assim** (sem listar registros no Dashboard agora) ou prefere expor edit/delete também em alguma visualização do Dashboard?

3. **Comportamento se falhar a remoção do Storage**: proposta é best-effort silencioso (logs internos, não bloqueia o delete da linha). Alternativa seria abortar a exclusão e mostrar erro. **Confirma best-effort?**
