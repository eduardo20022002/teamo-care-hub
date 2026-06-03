# Prompt — Design das Telas de Marcos, Metas e Relatório de Evolução (TEAmo)

## Contexto do produto

Você está criando telas para o **TEAmo**, app de coordenação do cuidado de crianças com TEA. O sistema visual já está estabelecido nas telas anteriores — siga rigorosamente a identidade visual existente: tipografia, espaçamentos, bordas arredondadas, cards elevados, paleta de cores, componentes shadcn/ui e estilo geral.

Este conjunto de telas cobre o módulo de evolução do terapeuta: marcos de desenvolvimento, metas de sessão e relatório automático. É o módulo de maior impacto emocional do produto — as telas devem transmitir cuidado, celebração e clareza. Nada deve parecer clínico ou frio.

### Paleta de cores por área de desenvolvimento

Cada área tem uma cor própria. Use-as consistentemente em todo o módulo:

- **Comunicação** — azul (`#3B82F6`)
- **Socialização** — verde (`#10B981`)
- **Autonomia** — laranja (`#F59E0B`)
- **Comportamento** — roxo (`#8B5CF6`)
- **Cognição** — ciano (`#06B6D4`)
- **Motricidade** — rosa (`#EC4899`)

---

## Telas a criar

### Grupo 1 — Marcos de Desenvolvimento (visão do terapeuta)

---

**Tela 1 — Lista de marcos do paciente**

Rota: `/paciente/:id/marcos`

Header com nome do paciente e botão "+" para adicionar marco.

Conteúdo principal: seis seções dobráveis, uma por área de desenvolvimento. Cada seção tem:
- Ícone e nome da área com a cor correspondente
- Número de marcos ativos e atingidos naquela área
- Lista de marcos da área

Cada marco na lista aparece como card com:
- Indicador colorido da área na borda esquerda
- Título do marco
- Chip de status: "Em progresso" (cinza), "Atingido" (verde com ícone de check e data), "Pausado" (amarelo)
- Número de metas de sessão vinculadas
- Ação rápida de toque longo ou swipe para marcar como atingido

Estado vazio (nenhum marco): ilustração simples e texto "Defina os primeiros marcos de desenvolvimento de [nome]. Eles guiarão o trabalho sessão a sessão." com botão de ação.

---

**Tela 2 — Formulário de criação/edição de marco**

Sheet deslizante a partir da lista.

Campos em ordem:
- Área de desenvolvimento: seis chips coloridos com ícone e nome (seleção obrigatória, visual primeiro)
- Título: input de texto com placeholder "Descreva a conquista a ser atingida..."
- Descrição: textarea opcional com placeholder "Contextualize o que esse marco significa para [nome]..."
- Visível para a família: toggle com explicação "Os responsáveis verão este marco e acompanharão o progresso"

Botão "Salvar marco" no rodapé.

---

**Tela 3 — Detalhe do marco**

Rota: `/paciente/:id/marcos/:marcoId`

Header com ícone e cor da área, título do marco e chip de status.

Seção "Metas vinculadas": lista das metas de sessão associadas a este marco. Cada meta mostra descrição e miniaturinha do histórico de tentativas (linha de ícones coloridos: verde=atingido, amarelo=parcial, vermelho=não atingido).

Seção "Histórico de progresso": linha do tempo reversa das tentativas relacionadas a este marco, agrupadas por sessão. Data da sessão, resultado da tentativa, nota se houver.

Se status = atingido: banner de conquista no topo com a data de conquista, fundo verde suave, ícone de troféu. Não há botão de edição de status — conquista é permanente.

Botão flutuante "Marcar como atingido" (visível apenas se status = em_progresso).

---

**Tela 4 — Confirmação de marco atingido**

Modal de confirmação antes de marcar o marco como atingido.

Design especial — não é um modal genérico. Tem:
- Ícone grande de troféu ou estrela com animação suave de entrada
- Título: "Confirmar conquista"
- Texto: "Você está prestes a marcar '[título do marco]' como atingido. Esta é uma conquista permanente e não pode ser desfeita."
- Data que será registrada: "Será registrado como conquistado em [data de hoje]"
- Dois botões: "Cancelar" (secundário) e "Confirmar conquista" (primário, verde)

---

**Tela 5 — Celebração de marco atingido**

Rota: `/conquista/:marcoId`

Tela especial de celebração — aparece após confirmar o marco como atingido e como destino ao clicar na notificação enviada aos pais.

Design deve ser visivelmente diferente de todas as outras telas. Mais emotivo, mais visual:
- Animação de confetes ou estrelas caindo ao carregar (CSS animation, não biblioteca externa)
- Fundo com gradiente suave na cor da área do marco
- Ícone grande da área no centro
- Texto principal: "🎉 [Nome da criança] conquistou!"
- Título do marco em destaque, tipografia maior
- Data da conquista: "Atingido em [dia] de [mês] de [ano]"
- Descrição do marco (se preenchida)
- Botão "Compartilhar esta conquista" — gera uma imagem estilizada para compartilhamento externo
- Botão "Ver todos os marcos" — volta para a lista

Esta tela deve fazer os pais quererem tirar print e mandar para os avós.

---

### Grupo 2 — Metas de Sessão (visão do terapeuta)

---

**Tela 6 — Lista de metas de sessão**

Rota: `/paciente/:id/metas`

Lista de metas agrupadas por status: Ativas / Atingidas / Pausadas.

Cada meta aparece como card com:
- Indicador colorido da área na borda esquerda
- Descrição da meta
- Chips dos marcos vinculados (nome truncado se necessário)
- Miniaturinha do histórico: últimas 8 tentativas como ícones coloridos em linha (verde, amarelo, vermelho)
- Status chip

Botão "+" para adicionar nova meta.

---

**Tela 7 — Registro de tentativa de meta (dentro do registro pós-sessão)**

Componente inline que aparece dentro do Bloco 1 do registro pós-sessão, para cada meta que estava no plano.

Para cada meta:
- Descrição da meta
- Três botões de resultado lado a lado: "✓ Atingido" (verde), "~ Parcial" (amarelo), "✗ Não atingido" (vermelho/cinza)
- Campo de nota opcional que expande ao selecionar qualquer resultado: "Observação rápida (opcional)"

Design compacto, pensado para preenchimento rápido durante ou logo após a sessão.

---

### Grupo 3 — Visão de Evolução

---

**Tela 8 — Evolução do paciente (visão do terapeuta)**

Rota: `/paciente/:id/evolucao`

Dashboard de evolução do paciente. Dividida em seções:

**Seção topo — Resumo geral:**
- Total de marcos: X atingidos / Y em progresso
- Total de sessões no último mês
- Taxa de comparecimento
- Último registro: [data]

**Seção — Radar de áreas:**
Visualização das seis áreas de desenvolvimento. Para cada área: ícone com cor, nome, número de marcos ativos, número de marcos atingidos. Representação visual simples — pode ser hexágono/radar ou grade de 6 cards. Não usar porcentagens numéricas.

**Seção — Marcos atingidos (linha do tempo):**
Lista cronológica reversa dos marcos já atingidos, com ícone da área, título e data. Se não há marcos atingidos ainda: "Os marcos atingidos aparecerão aqui. Continue registrando as sessões."

**Seção — Metas em andamento:**
Lista compacta das metas ativas com o histórico de tentativas recentes.

Botão fixo no rodapé: "Gerar relatório de evolução"

---

**Tela 9 — Evolução da criança (visão dos pais)**

Rota: `/crianca/:id/evolucao`

Versão da tela de evolução para os pais. Mesma estrutura mas com linguagem adaptada — sem termos técnicos, mais narrativo, mais visual.

Diferenças em relação à visão do terapeuta:
- Radar de áreas usa termos simples: "Como [nome] está se desenvolvendo"
- Não mostra taxa de comparecimento ou dados operacionais
- Marcos atingidos são os destaques visuais principais — cards maiores, mais celebratórios
- Metas de sessão aparecem apenas as ativas e com linguagem simplificada
- Banner no topo com frase de encorajamento: "Cada sessão é um passo. Veja o caminho que [nome] já percorreu."

---

### Grupo 4 — Relatório de Evolução

---

**Tela 10 — Configuração e geração de relatório**

Rota: `/paciente/:id/relatorio`

Formulário de configuração do relatório antes de gerar.

Campos:
- Período: chips rápidos (Último mês / 3 meses / 6 meses) + opção "Personalizado" que expande um date range picker
- Versão: cards de seleção com ícone e descrição — "Para a família" (ícone de coração, "Linguagem acessível, foco nas conquistas") e "Versão técnica" (ícone de documento, "Dados analíticos, para uso profissional") e "Ambas"
- Seções a incluir: checkboxes — Marcos atingidos / Progresso por área / Frequência de sessões / Instruções para família / Metas em andamento

Preview em tempo real: à medida que o terapeuta configura, um card de preview mostra quais seções serão incluídas e quantos itens de dados existem em cada uma no período selecionado. Ex: "3 marcos atingidos · 18 sessões · 12 instruções registradas"

Botão "Gerar relatório" — dispara a geração. Muda para estado de loading com mensagem "Estamos preparando o relatório de [nome]..."

---

**Tela 11 — Relatório pronto**

Aparece após a geração ou ao acessar um relatório já gerado na lista.

Mostra dois cards de acesso (se gerou ambas as versões):
- "Relatório para a família" com botões "Visualizar" e "Compartilhar com os pais"
- "Relatório técnico" com botões "Visualizar" e "Baixar PDF"

Abaixo: lista de relatórios anteriores gerados para o mesmo paciente (data, período, tipo).

---

### Grupo 5 — PDF (especificação visual)

O PDF não é uma tela do app mas deve ser especificado visualmente como um documento. Crie o layout das páginas principais:

**Página 1 — Capa**
Logo TEAmo no topo. Nome da criança em tipografia grande. Foto da criança (placeholder circular se não houver). Nome e especialidade do terapeuta. Período do relatório. Data de geração. Barra de cor da especialidade do terapeuta na lateral ou rodapé.

**Página 2 — A jornada do período (versão família)**
Parágrafo narrativo com tipografia generosa. Abaixo: três ou quatro métricas visuais em blocos horizontais — Sessões realizadas, Taxa de presença, Marcos atingidos no período, Áreas trabalhadas. Cada métrica com número grande e label simples.

**Página 3 — Conquistas do período**
Título "As conquistas de [nome]" em destaque. Cards de marcos atingidos — cada card com cor da área, ícone, título do marco e data de conquista. Layout de grade 2 colunas se houver múltiplos marcos. Se apenas um: card centralizado, maior.

**Página 4 — Progresso por área**
Seis blocos — um por área. Cada bloco: cor e ícone da área, nome, indicador qualitativo visual (barra de progresso simples ou ícones), número de metas trabalhadas, marcos ativos.

**Página 5 — O que praticamos em casa**
Lista de instruções registradas nas sessões do período. Tipografia legível, espaçamento generoso. Ícone de casa no título da seção.

**Última página — Olhando para frente**
Marcos em progresso. Frase de encerramento encorajadora. Rodapé com dados do terapeuta, registro profissional e data.

---

## Orientações gerais

- Mobile-first: 390px de largura para todas as telas do app
- A tela de celebração (Tela 5) é a exceção — pode ser mais expressiva visualmente
- Manter a linguagem do app: quente, humano, sem frieza clínica
- Estados de loading, vazio e erro devem seguir o padrão já estabelecido
- O PDF deve funcionar bem impresso em A4 — testar legibilidade em escala
- Áreas de toque mínimas de 44px em todos os elementos interativos
- Animações: suaves, propositais, nunca decorativas. A celebração justifica animação mais expressiva
