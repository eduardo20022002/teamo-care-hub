# Plano C6 — RF-04 + RF-09 + Busca Global

## 1. Estratégia geral

Três entregas independentes mas conectadas pelo dashboard:

- **A. Painel consolidado (RF-04)**: nova rota `/painel` com filtros completos (criança, profissional, categoria, período). O card "Registros" no dashboard passa a apontar para `/painel`. A rota `/registros` continua existindo (não vamos tocar) — `/painel` é a visão consolidada com filtros, enquanto `/registros` é a visão agrupada por criança/data já entregue no C3.
- **B. Verificação RF-09**: análise + checklist documentado no relatório. Criar utilitário visual no `AttendanceFormDialog` apenas se identificarmos cópia condicionante (não é o caso pelo que vi). A verificação é majoritariamente documental, com roteiro de teste manual reproduzível.
- **C. Busca global**: novo card destacado acima dos acessos rápidos no dashboard → leva a `/busca`. Tela com input + filtros rápidos + resultados agrupados por tipo, alimentados por `search.service.ts` modular.

## 2. Componentes a criar

| Caminho | Responsabilidade |
|---|---|
| `src/routes/_auth/painel.tsx` | Painel consolidado de registros com filtros |
| `src/routes/_auth/busca.tsx` | Tela de busca global |
| `src/components/panel/PanelFilters.tsx` | Bloco de filtros (criança, profissional, categoria, período personalizado com data inicial/final) + botão "Limpar filtros" |
| `src/components/search/GlobalSearchCard.tsx` | Card destacado no dashboard (fundo `bg-primary-soft/50`, borda primary/30, ícone lupa em destaque) |
| `src/components/search/SearchInput.tsx` | Input grande com ícone de lupa, placeholder, botão limpar |
| `src/components/search/SearchFilters.tsx` | Filtros rápidos: criança e tipo de conteúdo (registros / profissionais / documentos / todos) |
| `src/components/search/SearchResultsGroup.tsx` | Cabeçalho de seção + lista de itens de um tipo |
| `src/components/search/SearchResultItem.tsx` | Linha de resultado genérica (ícone por tipo + título + metadados + chevron) |
| `src/components/search/EmptySearch.tsx` | Estado inicial (sem busca) e estado sem resultados |
| `src/components/attendance/RecordDetailsDialog.tsx` | Dialog de visualização completa de um registro (reutilizado por `/busca` e `/painel`) — mostra cabeçalho + conteúdo + `RecordAttachmentsSection` |

## 3. Funções de service

### `src/services/search.service.ts` (novo)

Arquitetura modular por "fontes" para receber novas adições nos C7–C10 sem refatoração:

```ts
export type SearchKind = "record" | "professional" | "document";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;        // texto principal
  subtitle?: string;    // metadado (criança, especialidade, categoria...)
  date?: string;        // ISO para ordenação
  // payload tipado por kind para navegação
  payload:
    | { kind: "record"; record: AttendanceRecordWithRelations }
    | { kind: "professional"; professional: Professional }
    | { kind: "document"; doc: UnifiedDocument };
}

export interface SearchSource {
  kind: SearchKind;
  search(query: string, opts: { childId?: string }): Promise<SearchHit[]>;
}

export const SEARCH_SOURCES: SearchSource[] = [
  recordsSource,
  professionalsSource,
  documentsSource,
];

export async function searchAll(
  query: string,
  opts: { childId?: string; kinds?: SearchKind[] }
): Promise<Record<SearchKind, SearchHit[]>>;
```

Implementação interna usa as services existentes (`listAttendanceRecords`, `listProfessionals`, `listAllDocuments`) + `normalizeForSearch` (já existe em `documents.service.ts` — moveremos para `src/lib/formatters.ts` ou reexport via search.service para evitar importar documents em search). RLS já garante que só vêm dados do usuário autenticado.

Justificativa de não fazer query SQL `ilike` direto: as listas do usuário são pequenas (escopo MVP, RLS por user), filtragem em memória é suficiente, mantém o service puro e desacoplado, e facilita adição de novas fontes.

### Sem alterações em outras services
`attendance.service.ts`, `professionals.service.ts`, `attachments.service.ts`, `documents.service.ts` ficam intactos.

## 4. Estrutura da busca global

**Fontes neste ciclo (3):**

1. **Registros** (`attendance_records` via `listAttendanceRecords` — já traz join com child e professional):
   - Campos buscados: `content`, `category` (label PT-BR via `ATTENDANCE_CATEGORY_LABELS`), `professional_name`
   - Hit: title = trecho de `content` (primeiras ~80 chars), subtitle = `[categoria] · [criança] · [profissional]`, date = `record_date`

2. **Profissionais** (`professionals` via `listProfessionals`):
   - Campos buscados: `name`, `specialty`
   - Hit: title = `name`, subtitle = `specialty`

3. **Documentos** (unificados via `listAllDocuments`):
   - Campos buscados: `file_name`
   - Hit: title = `file_name`, subtitle = `[criança] · [origem: criança/registro]`, date = `created_at`

**Agrupamento na UI:** seções "Registros (N)", "Profissionais (N)", "Documentos (N)" — só renderiza seção com hits > 0. Ordem fixa: Registros → Profissionais → Documentos.

**Filtros rápidos na tela `/busca`:** criança (Select) + tipo de conteúdo (Tabs: Tudo / Registros / Profissionais / Documentos).

## 5. Comportamento de navegação ao clicar em resultado

| Tipo | Ação |
|---|---|
| **Registro** | Abre `RecordDetailsDialog` na mesma tela `/busca` com o registro completo (incluindo anexos via `RecordAttachmentsSection`). Botão "Ver no painel" navega para `/painel?registro={id}` (não implementado o highlight, apenas navegação) — alternativa: deixar só o dialog. **Decisão em aberto: confirmar.** |
| **Profissional** | Navega para `/profissionais?destacar={id}`. Em `profissionais.tsx` (já existente) leremos search param e aplicaremos `scrollIntoView` + classe `ring-2 ring-primary` por 2s no card. → Esta é uma modificação mínima permitida em `profissionais.tsx`? **O escopo declarado diz "Não deve tocar: páginas de profissionais"**. **Decisão em aberto: ver §7.** |
| **Documento** | Gera signed URL via `getAttachmentSignedUrl` e abre em nova aba (mesmo padrão do `DocumentCard`). |

## 6. Painel consolidado (`/painel`)

- Header: título "Painel de registros" + link voltar para dashboard.
- `PanelFilters` em card sticky no topo (em mobile vira accordion compacto):
  - Criança (Select)
  - Profissional (Select com "Todos" + lista de profissionais cadastrados + opção "Não cadastrado" para registros sem `professional_id`)
  - Categoria (Select com `ATTENDANCE_CATEGORY_LABELS`)
  - Período: dois `Input type="date"` (de / até)
  - Botão "Limpar filtros" visível quando qualquer filtro está ativo
- Resultados: lista plana (não agrupada por criança como `/registros`), ordenados por `record_date` desc, usando `AttendanceCard` com `showChild` e `onEdit`/`onDelete` ligados às mesmas mutations que `/registros` usa (replicadas neste arquivo — não é "alterar", é "reusar lógica" análoga).
- Estado vazio com filtros: card com texto "Nenhum registro encontrado para os filtros aplicados. [Limpar filtros]".
- Estado vazio absoluto: usa `EmptyAttendance`.

## 7. Verificação do RF-09 — método

**Análise estática (já fiz):**
- `AttendanceFormDialog` aceita `professional_name` (texto livre) com `professional_id` opcional ✅
- `attendance.service.ts` insere com `professional_id ?? null` ✅
- `AttendanceCard` mostra "(não cadastrado)" quando sem `professional_id` ✅
- `listProfessionals` retorna `[]` sem erro quando vazio ✅
- Onboarding não exige profissional ✅
- Documentos / anexos não dependem de profissional ✅

**Roteiro de teste manual documentado no relatório:**
1. Criar conta nova → cadastrar criança no onboarding (sem cadastrar profissional)
2. Dashboard carrega normalmente
3. Acessar `/registros` → criar registro com profissional digitado livremente → salva ✅
4. Anexar documento ao registro → salva ✅
5. Acessar `/documentos` → adicionar documento avulso → salva ✅
6. Acessar `/busca` → busca por nome do profissional digitado → encontra no grupo "Registros" ✅
7. Acessar `/painel` → filtros funcionam (filtro de profissional mostra "Não cadastrado") ✅

Nenhum bloqueio, alerta ou tooltip que condicione uso a profissional cadastrado. (Compartilhamento C7 ainda não existe — exigência será apresentada lá.)

## 8. Sequência de implementação

1. Criar `src/services/search.service.ts` com fontes modulares
2. Criar componentes em `src/components/search/`
3. Criar `RecordDetailsDialog`
4. Criar `src/routes/_auth/busca.tsx`
5. Criar `src/components/panel/PanelFilters.tsx`
6. Criar `src/routes/_auth/painel.tsx`
7. Modificar `dashboard.tsx`: adicionar `GlobalSearchCard` acima da seção de acessos rápidos; trocar destino do card "Registros" de `/registros` para `/painel`
8. Atualizar `README.md` com seção sobre `search.service.ts` e como ciclos futuros adicionam fontes
9. Validação manual end-to-end (RF-04 + RF-09 + busca)
10. Relatório técnico

## 9. Decisões em aberto que precisam de confirmação

1. **Card "Registros" do dashboard**: o requisito diz "Painel consolidado [...] Acessado pelo card Registros nos acessos rápidos do dashboard". Proposta: o card vai apontar para `/painel` (novo). A rota `/registros` continua acessível (não removo nada), mas deixa de ter entrada no dashboard. **Confirma?** Alternativa: manter `/registros` no dashboard e adicionar segundo card "Painel".

2. **Highlight em `/profissionais` ao clicar em resultado de busca**: a regra de escopo diz "Não deve tocar: páginas de profissionais". Opções:
   - **(a)** Navegar para `/profissionais` sem destaque (apenas leva à lista) — respeita o escopo literalmente.
   - **(b)** Adicionar pequena leitura de search param + scroll/destaque em `profissionais.tsx` (modificação cirúrgica).
   - **Proposta padrão: (a)** — fica simples e dentro do escopo. Pode ser melhorado em ciclo futuro.

3. **Resultado "Registro" abre Dialog ou navega?** Proposta: abre `RecordDetailsDialog` na própria `/busca` (mantém contexto da busca, padrão usado em apps de saúde para evitar perder filtros). Alternativa: navegar para `/painel` filtrado por aquele registro. **Confirma Dialog?**

4. **Filtro de período no painel**: dois inputs `type="date"` (de/até) ou Select com presets ("7d", "30d", "Este ano", "Personalizado")? Proposta: **dois inputs date** — mais flexível, atende critério 2 ("intervalo de datas") literalmente. **Confirma?**

5. **Busca: mínimo de caracteres**: proposta de iniciar busca a partir de 2 caracteres (debounce 200ms). Estado inicial (`query.length < 2`) mostra `EmptySearch` com dica do que pode ser encontrado. **Confirma?**

Aguardo aprovação para implementar.
