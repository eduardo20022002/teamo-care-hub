# Prompt — Design das Telas do Terapeuta (TEAmo)

## Contexto do produto

Você está criando telas para o **TEAmo**, um app de coordenação do cuidado de crianças com Transtorno do Espectro Autista. O design do app já existe — siga rigorosamente o sistema visual já estabelecido nas telas anteriores: tipografia, espaçamentos, bordas arredondadas, cards elevados, paleta de cores, componentes shadcn/ui e estilo geral.

O TEAmo tem dois perfis de usuário: **pais/responsáveis** (já desenhado) e **terapeutas** (novo — é o que você vai criar agora). A experiência do terapeuta deve ter a mesma qualidade visual das telas dos pais, mas adaptada para um contexto profissional e multi-paciente.

---

## O que criar

Crie as telas na ordem abaixo. Para cada tela, siga as especificações de campos, estados e comportamentos descritos. Mantenha consistência visual total com o design existente.

---

### Grupo 1 — Onboarding do Terapeuta

**Tela 1 — Perguntas de perfil**

Tela de onboarding com quatro perguntas em chips selecionáveis. Layout limpo, uma pergunta por seção com label e chips abaixo. Chips com estado padrão e estado selecionado (destaque com cor primária). Barra de progresso no topo (etapa 1 de 3). Botão "Continuar" no rodapé e link "Pular esta etapa" abaixo dele.

Perguntas e opções:
- "Onde você atende?" → Consultório particular / Clínica ou instituição / Ambos
- "Modalidade de atendimento?" → Presencial / Online / Ambos
- "Quantos pacientes você atende?" → 1 a 5 / 6 a 10 / 11 a 20 / Mais de 20
- "Quantas horas de sessão por semana?" → Menos de 10h / 10h a 20h / 20h a 30h / Mais de 30h

**Tela 2 — Cadastro de pacientes**

Barra de progresso no topo (etapa 2 de 3). Texto de orientação no topo da tela explicando a importância desta etapa. Abaixo, lista de pacientes já adicionados (cards pequenos com nome da criança e responsável, ícone de remover). Abaixo da lista, formulário com campos: primeiro nome da criança, nome do responsável (campo repetível com botão "+ Adicionar responsável"), email para convite (opcional, com nota explicativa). Botão "Adicionar paciente" ao final do formulário. No rodapé: botão principal "Concluir" e botão secundário "Adicionar depois".

**Tela 3 — Conclusão do onboarding**

Tela de sucesso com ícone animado de check, título e texto contextual (três variações descritas na spec: com email, sem email, sem pacientes). Botão principal de navegação ao painel.

---

### Grupo 2 — Dashboard do Terapeuta

**Tela 4 — Painel de pacientes**

É o equivalente do dashboard dos pais, mas para o terapeuta. Lista de cards de pacientes vinculados. Cada card mostra: nome da criança, nome do responsável principal, próxima sessão agendada (data e hora), status do último registro (com registro / pendente / sem sessão recente). No topo: saudação com nome do terapeuta e atalho para adicionar novo paciente. Barra de busca para filtrar pacientes por nome.

---

### Grupo 3 — Agenda do Terapeuta

**Tela 5 — Visão de semana da agenda**

Visão de semana com todos os pacientes. Cada paciente tem uma cor distinta — os eventos do Lucas são azuis, os da Ana são verdes, os do Pedro são laranjas, etc. Legenda de cores no topo ou lateral. Cada bloco de evento exibe: cor do paciente, nome da criança, horário e duração. Indicador visual de status: upcoming (sem preenchimento), com registro (check), pendente de registro (ponto amarelo). Botão "+" flutuante para adicionar nova sessão.

**Tela 6 — Visão de mês da agenda**

Grade mensal. Cada dia com sessão exibe um ponto colorido: verde (registro completo), amarelo (pendente de registro), vermelho (falta registrada), cinza (sessão futura). Ao tocar no dia, expande lista de eventos do dia.

**Tela 7 — Formulário de agendamento recorrente**

Sheet ou tela de formulário para criar uma nova sessão. Campos: seleção de paciente (dropdown com foto/inicial e nome), tipo de sessão (chips: Individual / Em grupo / Familiar), data de início, hora de início, duração (chips: 30min / 45min / 60min / 90min / Personalizado), recorrência (chips: Não repete / Semanal / Quinzenal / Mensal), se semanal: seletor de dias da semana (Dom/Seg/Ter/Qua/Qui/Sex/Sáb em chips), local (texto livre), lembrete para mim (toggles: 1 dia antes / 1 hora antes), notificar família (toggle). Botão "Salvar sessão".

---

### Grupo 4 — Plano Pré-sessão

**Tela 8 — Plano da sessão**

Tela acessada ao clicar em um evento futuro. Header com nome do paciente, data e horário da sessão. Dois blocos: "Objetivos" (textarea de objetivos, campo de metas terapêuticas com multi-seleção, lista repetível de atividades com botão "+ Atividade", campo de materiais necessários) e "Visibilidade" (toggle "Visível para a família" com explicação "Os pais verão este plano antes da sessão"). Botão "Salvar plano".

---

### Grupo 5 — Confirmação e Registro Pós-sessão

**Tela 9 — Confirmação da sessão**

Tela rápida após o horário da sessão. Header com nome do paciente e horário. Pergunta central "A sessão aconteceu?" com três chips grandes: "Aconteceu", "Falta justificada", "Falta sem aviso". Se "Aconteceu": campos de duração real (input numérico, pré-preenchido) e horário de início real. Se falta: campo de motivo (texto livre) e toggle "Notificar família". Botão "Continuar" (se aconteceu) ou "Registrar falta" (se falta).

**Tela 10 — Registro pós-sessão**

Tela longa em scroll com quatro blocos claramente separados por seção com título e divisor:

**Bloco 1 — O que foi trabalhado**
Checklist automático dos objetivos do plano pré-sessão (cada objetivo como item marcável). Campo textarea "O que foi efetivamente feito". Chips de engajamento: Baixo / Médio / Alto.

**Bloco 2 — Observações clínicas**
Textarea "Observações gerais". Lista repetível de comportamentos notáveis (cada item: campo de descrição + chips de tipo: Conquista / Dificuldade / Regulação / Comunicação / Interação social / Outro). Área de upload de anexos (fotos, vídeos, áudios, PDFs). Toggle de visibilidade: "Compartilhado com a família" (padrão) ou "Somente eu (privado)".

**Bloco 3 — Instrução para família**
Label de destaque indicando que este bloco é sempre visível para os pais. Textarea "O que praticar em casa". Campo curto "Frequência sugerida". Upload de material de apoio.

**Bloco 4 — Próxima sessão**
Textarea "Pontos a continuar". Textarea "Ajuste de abordagem" (label indicando que é privado). Nota: "Estes pontos serão sugeridos automaticamente no plano da próxima sessão com este paciente."

Rodapé fixo: botão secundário "Salvar rascunho" e botão primário "Publicar registro".

**Tela 11 — Preview "o que os pais verão"**

Sheet ou tela de preview que mostra exatamente como o card da sessão aparecerá na visão dos pais. Simula o card com as informações que serão compartilhadas: plano (se visível), observações compartilhadas, instrução para casa, anexos compartilhados. Deixa claro o que está sendo ocultado. Botões "Voltar e editar" e "Confirmar e publicar".

---

### Grupo 6 — Visão dos Pais (sessão do terapeuta)

**Tela 12 — Card de sessão na timeline da criança**

Na visão dos pais, como aparece uma sessão registrada pelo terapeuta na timeline da criança. Card com: nome e especialidade do terapeuta, data e duração, status de comparecimento, plano da sessão (se visível), observações compartilhadas, instrução para casa em destaque (box separado com ícone de casa), anexos. Visual diferenciado do card de registro dos próprios pais — usar uma cor ou borda que identifique "registro do terapeuta".

---

## Orientações gerais de design

- Seguir exatamente a identidade visual do TEAmo já estabelecida
- Usar os mesmos componentes já desenhados: cards, sheets, chips, toggles, inputs, botões
- Manter a mesma hierarquia tipográfica das telas existentes
- Estados de loading, vazio e erro devem seguir o padrão já estabelecido
- Mobile-first: todas as telas para viewport de 390px de largura
- Acessibilidade: labels visíveis, contraste adequado, áreas de toque mínimas de 44px
- A cor de destaque do módulo do terapeuta pode ser diferente da cor dos pais para criar distinção clara entre os dois perfis dentro do app
