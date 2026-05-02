# Plano — C3 / RF-02: Registro de Atendimentos

## 1. Páginas e componentes a criar

- `src/routes/_auth/registros.tsx` — página de listagem geral, agrupada por criança e por data (mais recente primeiro), com botão "Novo registro", busca opcional por texto, e estado vazio.
- `src/components/attendance/AttendanceFormDialog.tsx` — Dialog (Shadcn) reutilizável para criar/editar. Campos: criança, profissional (combobox híbrido), data, categoria, conteúdo. Aceita `defaultChildId` para abrir já com criança pré-selecionada.
- `src/components/attendance/ProfessionalCombobox.tsx` — combobox com busca em tempo real sobre os profissionais cadastrados; quando o termo digitado não bate com nenhum, exibe a opção `"Usar este nome: <texto>"`. Emite um valor estruturado: `{ professionalId?: string; professionalName: string }`.
- `src/components/attendance/AttendanceCard.tsx` — card de leitura mostrando data (formatada PT-BR), categoria (badge), nome do profissional (com indicação visual sutil quando for "não cadastrado"), criança e trecho do conteúdo, com ações editar/excluir.
- `src/components/attendance/DeleteAttendanceDialog.tsx` — AlertDialog de confirmação.
- `src/components/attendance/EmptyAttendance.tsx` — estado vazio com CTA "Registrar atendimento".
- `src/components/attendance/CategoryBadge.tsx` — badge tematizada por categoria (orientação, observação clínica, conduta, evolução).

## 2. Funções de service

`src/services/attendance.service.ts` (única camada que toca Supabase):

- `listAttendanceRecords()` — SELECT com join leve para `children(name)` e `professionals(name)`, ordenado por `record_date desc, created_at desc`.
- `listAttendanceByChild(childId)` — variante filtrada (uso futuro; útil para o dashboard).
- `createAttendanceRecord(userId, input)`
- `updateAttendanceRecord(id, input)`
- `deleteAttendanceRecord(id)`

## 3. Schema do Supabase

Nova tabela `public.attendance_records`:


| coluna              | tipo        | nulo | default                | observação                                    |
| ------------------- | ----------- | ---- | ---------------------- | --------------------------------------------- |
| `id`                | uuid        | não  | `gen_random_uuid()` PK | &nbsp;                                        |
| `user_id`           | uuid        | não  | —                      | dono / responsável                            |
| `child_id`          | uuid        | não  | —                      | FK → `children(id)` `ON DELETE CASCADE`       |
| `professional_id`   | uuid        | sim  | —                      | FK → `professionals(id)` `ON DELETE SET NULL` |
| `professional_name` | text        | não  | —                      | snapshot do nome (sempre preenchido)          |
| `category`          | text        | não  | —                      | enum lógico via Zod (4 valores)               |
| `content`           | text        | não  | —                      | conteúdo descritivo                           |
| `record_date`       | date        | não  | —                      | informada pelo pai, **não** sobrescrita       |
| `created_at`        | timestamptz | não  | `now()`                | &nbsp;                                        |
| `updated_at`        | timestamptz | não  | `now()`                | &nbsp;                                        |


- Índices: `(user_id, record_date desc)`, `(child_id)`, `(professional_id)`.
- RLS habilitada com 4 políticas (`SELECT/INSERT/UPDATE/DELETE`) via `auth.uid() = user_id` (mesmo padrão dos C1/C2).
- Trigger `update_attendance_records_updated_at` reutilizando a função `public.update_updated_at_column()` já existente.
- Categoria validada na aplicação (Zod enum). Sem CHECK constraint para evitar problemas de imutabilidade/migração futura.
- `professional_id` é opcional, mas `professional_name` é obrigatório — garante que o histórico sobreviva à exclusão do profissional cadastrado.

## 4. Decisão sobre profissional híbrido (cadastrado vs. não cadastrado)

Adoto a estratégia de **snapshot + referência opcional**:

- O combobox sempre devolve um `professional_name` (string). Se o item escolhido for um cadastrado, devolve também o `professional_id`.
- No banco: `professional_id` (FK opcional, `ON DELETE SET NULL`) + `professional_name` (sempre preenchido).
- **Por que assim:**
  - Atende o critério 2 (selecionar cadastrado **ou** digitar livremente) sem bifurcar o schema.
  - Preserva o histórico mesmo se o pai apagar o profissional cadastrado depois (`SET NULL` mantém o nome).
  - Permite no futuro (C7 — compartilhamento via OTP) recuperar dados de contato pelo `professional_id` quando existir, sem perder os registros "manuais".
  - Evita criar implicitamente um profissional cadastrado a cada nome digitado (ruído no cadastro do usuário).

## 5. Validação Zod (`src/lib/validation.ts`)

```ts
export const ATTENDANCE_CATEGORIES = [
  "orientacao",
  "observacao_clinica",
  "conduta",
  "evolucao",
] as const;

export const ATTENDANCE_CATEGORY_LABELS: Record<AttendanceCategory, string> = {
  orientacao: "Orientação",
  observacao_clinica: "Observação clínica",
  conduta: "Conduta",
  evolucao: "Evolução",
};

export const attendanceRecordSchema = z.object({
  child_id: z.string().uuid("Selecione uma criança."),
  professional_id: z.string().uuid().nullable().optional(),
  professional_name: z.string().trim().min(1, "Informe o profissional.").max(120),
  category: z.enum(ATTENDANCE_CATEGORIES, { message: "Selecione a categoria." }),
  content: z.string().trim().min(1, "Descreva o atendimento.").max(5000),
  record_date: z.string().min(1, "Informe a data.").refine(/* data válida e ≤ hoje */),
});
```

## 6. Modificações em arquivos existentes

- `src/routes/_auth/dashboard.tsx`:
  - Card "Registros de atendimento" deixa de estar em "Em breve" e migra para a seção **Acessos rápidos**, ao lado de "Rede de profissionais", como `<Link to="/registros">`. Demais cards "Em breve" intactos.
  - Em cada `ChildCard` da listagem, exibir botão de atalho **"+ Registrar"** que abre o `AttendanceFormDialog` com `defaultChildId` preenchido.
- `src/components/children/ChildCard.tsx`: aceitar prop opcional `onQuickRegister?: (child) => void` para renderizar o botão sem violar a separação de camadas (o dashboard cuida do estado do dialog).
- `src/types/database.ts`: adicionar `AttendanceRecord`, `AttendanceRecordInsert`, `AttendanceRecordUpdate`, `AttendanceCategory`.
- `README.md`: registrar a nova tabela e o padrão híbrido de profissional.

## 7. Sequência de implementação

1. Migration Supabase: `attendance_records` + índices + RLS + trigger `updated_at`.
2. Tipos derivados em `src/types/database.ts` (após regeneração).
3. Schema Zod + enum de categorias em `src/lib/validation.ts`.
4. `attendance.service.ts`.
5. `ProfessionalCombobox` (núcleo de UX deste ciclo).
6. `AttendanceFormDialog` + `CategoryBadge` + `DeleteAttendanceDialog` + `EmptyAttendance` + `AttendanceCard`.
7. Rota `/_auth/registros.tsx` com TanStack Query (lista, criação, edição, exclusão), agrupamento por criança/data.
8. Ajustes no dashboard: card "Registros" clicável + atalho "+ Registrar" no `ChildCard`.
9. README + verificação manual dos 6 critérios + RNFs.

## 8. RNFs transversais — como serão atendidos

- **RNF-04** PT-BR: rótulos de categoria, mensagens de erro, toasts e formatação de data (`dd/MM/yyyy`).
- **RNF-05** Responsivo: lista em coluna única no mobile; Dialog full-screen em mobile via Shadcn; combobox usa Popover já mobile-friendly.
- **RNF-06** Spinners no carregamento, toasts de sucesso/erro, botões `disabled` durante mutations, estados de loading no combobox.
- **RNF-07** Página dentro do `AppShell` (rota em `/_auth/`).
- **RNF-09** RLS `auth.uid() = user_id` nas 4 operações.
- **RNF-12** `onError` mantém o Dialog aberto com dados preservados; toast amigável; tratamento específico para perda de conexão.
- **RNF-13** Apenas `attendance.service.ts` importa o cliente Supabase.

## 9. Decisões em aberto — preciso confirmação

1. **Formulário: Dialog vs. tela dedicada.** Proposta: **Dialog** em todos os pontos de entrada (dashboard, página de registros). Mantém o usuário no contexto, é menos disruptivo, e o conteúdo cabe confortavelmente. Confirmar? Sim
2. **Edição de registros.** O RF não pede explicitamente, mas o padrão dos C1/C2 inclui editar. Proposta: **incluir editar e excluir** desde já (custo marginal, evita refator no C4). Confirmar? Sim
3. **Limite de tamanho do conteúdo.** Proposta: 5000 caracteres (texto longo, mas evita abuso). Confirmar? Sim
4. **Data futura.** O critério 6 fala em preservar a data informada, mas não proíbe data futura. Proposta: **bloquear data futura** (`record_date <= hoje`) — atendimento ainda não ocorreu não faz sentido como "registro". Confirmar? Sim
5. **Agrupamento na listagem.** Proposta: agrupar por **criança → data**, com cabeçalho de data formatado ("Hoje", "Ontem", "12/03/2026"). Alternativa: lista plana ordenada só por data. Qual prefere? Primeira proposta
6. **Filtro por criança na listagem.** Proposta: incluir um seletor simples de criança no topo da página `/registros` (todas / criança X). Útil já em famílias com 2+ crianças. Confirmar? Sim

Aguardo aprovação e respostas às 6 decisões em aberto antes de implementar.