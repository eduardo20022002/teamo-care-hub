## Plano — C2 / RF-01: Cadastro de Profissionais

### 1. Páginas e componentes a criar

- `src/routes/_auth/profissionais.tsx` — rota dedicada dentro do AppShell, com listagem, busca, estado vazio, botão "Adicionar profissional", e ações de editar/excluir.
- `src/components/professionals/ProfessionalCard.tsx` — card individual exibindo nome, especialidade e e-mail, com botões "Editar" e "Excluir".
- `src/components/professionals/ProfessionalFormDialog.tsx` — Dialog (Shadcn) para criar/editar, com campos: nome, especialidade, e-mail. Reusa `safeParse` + erros inline (padrão do `ChildFormDialog`).
- `src/components/professionals/DeleteProfessionalDialog.tsx` — AlertDialog de confirmação de exclusão.
- `src/components/professionals/EmptyProfessionals.tsx` — estado vazio amigável com CTA para cadastrar o primeiro.

### 2. Funções de service

`src/services/professionals.service.ts` (única camada que toca Supabase):

- `listProfessionals()` — SELECT ordenado por `name`.
- `createProfessional(userId, input)` — INSERT.
- `updateProfessional(id, input)` — UPDATE.
- `deleteProfessional(id)` — DELETE.

### 3. Schema do Supabase

Nova tabela `public.professionals`:


| coluna       | tipo        | nulo | default                |
| ------------ | ----------- | ---- | ---------------------- |
| `id`         | uuid        | não  | `gen_random_uuid()` PK |
| `user_id`    | uuid        | não  | — (dono / responsável) |
| `name`       | text        | não  | —                      |
| `specialty`  | text        | não  | —                      |
| `email`      | text        | não  | —                      |
| `created_at` | timestamptz | não  | `now()`                |
| `updated_at` | timestamptz | não  | `now()`                |


- Índice em `user_id`.
- RLS habilitada com 4 políticas (`SELECT/INSERT/UPDATE/DELETE`) usando `auth.uid() = user_id` (mesmo padrão do C1).
- Trigger `update_professionals_updated_at` usando função `public.update_updated_at_column()` (criada se ainda não existir).
- Validação de e-mail no nível de aplicação (Zod). Sem CHECK constraint para evitar problemas de imutabilidade.

### 4. Validação Zod (`src/lib/validation.ts`)

Adicionar:

```ts
export const professionalSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  specialty: z.string().trim().min(1, "Informe a especialidade.").max(120),
  email: emailSchema, // já existente
});
export type ProfessionalInput = z.infer<typeof professionalSchema>;
```

### 5. Tipos (`src/types/database.ts`)

Adicionar `Professional` e `ProfessionalInsert` derivados de `Tables<"professionals">`.

### 6. Modificações no Dashboard

Em `src/routes/_auth/dashboard.tsx`: o card "Rede de profissionais" deixa de ser `ComingSoonCard` e passa a ser um card clicável que navega para `/profissionais`. Demais cards "Em breve" permanecem intactos.

Pode requerer um pequeno componente `NavCard` (ou variante de card clicável) para manter consistência visual com os demais cards do dashboard, sem badge "Em breve".

### 7. Sequência de implementação

1. Migration Supabase: tabela `professionals` + RLS + trigger `updated_at`.
2. Tipos derivados em `src/types/database.ts` (após regeneração de `types.ts`).
3. Schema Zod em `src/lib/validation.ts`.
4. Service `professionals.service.ts`.
5. Componentes: `ProfessionalFormDialog`, `DeleteProfessionalDialog`, `ProfessionalCard`, `EmptyProfessionals`.
6. Rota `/_auth/profissionais.tsx` com TanStack Query (`useQuery` + `useMutation`), busca local, toasts via Sonner.
7. Ajuste do card no dashboard (remover "Em breve", tornar clicável → `/profissionais`).
8. Atualização do `README.md` registrando a nova tabela.
9. Verificação manual dos 7 critérios de aceite + RNFs transversais.

### 8. RNFs transversais — como serão atendidos

- **RNF-04** PT-BR: todos rótulos, mensagens e toasts em português.
- **RNF-05** Responsivo: grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, Dialog full-width em mobile.
- **RNF-06** Feedback: spinners em loading, toasts de sucesso/erro, estados disabled durante mutations.
- **RNF-07** AppShell envolvendo a rota.
- **RNF-09** RLS `auth.uid() = user_id`.
- **RNF-12** `onError` das mutations exibe toast amigável; o Dialog mantém os dados do formulário (não fecha em caso de erro).
- **RNF-13** Apenas o service importa o cliente Supabase.

### 9. Decisões em aberto — preciso confirmação

1. **Telefone**: o RF fala em "informação de contato"; vocês especificaram apenas e-mail no critério 1 e mencionaram uso futuro em OTP (C7). **Proposta:** manter apenas `email` neste ciclo; adicionar `phone` apenas se solicitado. Coloque ambos, deixe o telefone opicional.
2. **Especialidade — texto livre vs. enum**: especialidades de TEA são variadas (fonoaudiólogo, TO, psicólogo, ABA, neuropediatra, etc.). **Proposta:** campo de texto livre neste ciclo; pode evoluir para enum/sugestões depois. Faça uma lista com especialidades ligadas ao TEA, e deixa uma opção de outros, permitindo digitar.
3. **Unicidade de e-mail por responsável**: impedir que o mesmo pai cadastre dois profissionais com o mesmo e-mail? **Proposta:** sim, `UNIQUE (user_id, email)` — evita duplicatas e simplifica o OTP do C7. Sim.
4. **Card no dashboard**: o ícone atual `Users` permanece. Sem badge "Em breve", sem contador de profissionais (mantém dashboard limpo, conforme diretriz). Confirmar? Confirmo

Aguardo aprovação (e respostas às 4 decisões em aberto) antes de implementar.