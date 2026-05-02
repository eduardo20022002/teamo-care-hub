## Objetivo

Aprimorar a experiência de busca e filtragem em todo o sistema, tornando os filtros visíveis, contextuais e a busca livre reativa. A tela `/busca` passa a exibir todo o histórico ordenado cronologicamente já na entrada, e cada seção (registros, documentos, profissionais) ganha filtros adequados ao seu domínio.

---

## 1. Tela de busca (`/busca`) — busca passiva + filtros completos

### Comportamento

- Ao abrir a tela, **carregar e exibir automaticamente todos os resultados** (registros + documentos + profissionais) em **ordem cronológica decrescente** unificada (não mais agrupada por tipo na visualização padrão), sem precisar digitar.
- Campo de busca livre filtra **em tempo real** (debounce 200ms) sobre os resultados já carregados — não dispara nova requisição.
- Filtros visíveis **acima dos resultados**, em uma faixa sempre presente (não em modal/drawer).

### Filtros da tela de busca

1. **Período**: dois inputs `type="date"` (data início / data fim), opcionais e independentes.
2. **Tipo de conteúdo**: Select com opções "Todos", "Registros", "Documentos", "Profissionais".
3. **Categoria de atendimento**: Select com "Todas", "Orientação", "Observação clínica", "Conduta", "Evolução". Aplica-se apenas a registros (quando "Tipo = Profissionais" ou "Tipo = Documentos" estiver selecionado, o filtro fica desabilitado/oculto).
4. **Criança** (mantido): quando há mais de uma criança cadastrada.
5. Botão "Limpar filtros" quando algum filtro estiver ativo.

### Visualização dos resultados

- Lista única ordenada por data desc (registros usam `record_date`; documentos usam `created_at`; profissionais sem data ficam no fim, ordenados por nome).
- Cada item mantém o componente `SearchResultItem` (já existente), com badge indicando o tipo.
- Quando o usuário digita no campo de busca, a lista é filtrada localmente sobre o conjunto já carregado.

### Mudanças técnicas

- `src/services/search.service.ts`:
  - `searchAll` deixa de exigir `query.length >= 2`. Quando `query` estiver vazia, retorna todos os itens das fontes (sem filtro de texto).
  - Adicionar suporte a opções `dateFrom`, `dateTo`, `category` em `SearchSourceOpts`.
  - Cada source aplica os filtros que fazem sentido para seu domínio (categoria só se aplica em `recordsSource`).
  - Nova função utilitária `flattenAndSortByDate(results)` que devolve um array ordenado.
- `src/components/search/SearchFilters.tsx`: refatorar para incluir período (2 inputs date), categoria, tipo, criança e botão limpar. Layout grid responsivo.
- `src/routes/_auth/busca.tsx`:
  - Carregar resultados sempre que o user estiver logado (sem `enabled: isReady`).
  - Aplicar filtro de texto client-side via `useMemo`.
  - Trocar o agrupamento por tipo pela lista cronológica unificada (novo componente `SearchResultsList`).
  - `EmptySearch` passa a ter um terceiro estado: "no-data" (quando não há nada cadastrado ainda).

---

## 2. Tela de registros (`/registros`) — filtros contextuais

Hoje só há filtro por criança. Adicionar:

- **Profissional** (Select com lista de profissionais cadastrados + opção "Sem profissional vinculado").
- **Categoria** (Select com as 4 categorias).
- **Período** (data início / data fim, inputs `type="date"`).
- Manter filtro por criança.
- Botão "Limpar filtros".

Reaproveitar o componente `PanelFilters.tsx` que já existe no painel consolidado. Renomeá-lo para `RecordFilters.tsx` em `src/components/attendance/` e usar nas duas telas (`/registros` e `/painel`), mantendo retrocompatibilidade.

A lógica de filtragem em `/registros` é estendida no `useMemo` existente para considerar todos os critérios.

---

## 3. Tela de documentos (`/documentos`) — ajuste pequeno

Já possui filtros por criança, origem, tipo (PDF/imagem) e período. Conforme o requisito, manter:

- **Criança**
- **Tipo de arquivo** (já existe: PDF, imagem, todos)

Manter também origem e período (são úteis e o requisito não pede para remover). Sem mudança estrutural — só uma revisão visual para garantir que a faixa de filtros esteja sempre visível (já está).

---

## 4. Tela de profissionais (`/profissionais`) — adicionar filtro de especialidade

Hoje só tem campo de busca livre. Adicionar:

- **Filtro por especialidade**: Select com lista única de especialidades extraída dos profissionais cadastrados + opção "Todas".
- Manter o campo de busca livre por nome/especialidade.

Mudança em `src/routes/_auth/profissionais.tsx`:
- `useMemo` para derivar lista única de especialidades.
- Novo Select acima do grid, alinhado com o input de busca.
- Filtragem combina busca textual + especialidade.

---

## Arquivos afetados

**Modificados**
- `src/services/search.service.ts` — opções `dateFrom`, `dateTo`, `category`; busca sem termo retorna tudo; helper de flatten/sort.
- `src/components/search/SearchFilters.tsx` — período, categoria, botão limpar.
- `src/routes/_auth/busca.tsx` — carregamento automático, filtro de texto client-side, lista cronológica.
- `src/routes/_auth/registros.tsx` — usar RecordFilters compartilhado.
- `src/routes/_auth/painel.tsx` — usar RecordFilters compartilhado (substitui PanelFilters).
- `src/routes/_auth/profissionais.tsx` — Select de especialidade.

**Criados**
- `src/components/attendance/RecordFilters.tsx` — componente compartilhado entre `/registros` e `/painel`.
- `src/components/search/SearchResultsList.tsx` — lista cronológica unificada.

**Removidos**
- `src/components/panel/PanelFilters.tsx` — substituído por `RecordFilters.tsx`.

---

## Decisões e suposições

- **Ordenação no painel de busca**: cronológica desc unificada por todos os tipos. Profissionais não têm data e ficam ao final. (Se preferir manter o agrupamento por tipo da forma atual, posso ajustar.)
- **Categoria na busca global**: só faz sentido para registros; quando o filtro "Tipo" exclui registros, o Select fica desabilitado.
- **Sem mudanças no banco** — apenas frontend e service layer.
- **Sem mudanças em business logic** — filtragem é feita em memória sobre os dados já carregados, mantendo o padrão já adotado em `/painel` e `/documentos`.
