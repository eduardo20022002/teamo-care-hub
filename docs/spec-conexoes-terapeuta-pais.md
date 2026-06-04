# Spec de Usabilidade — Conexões entre Terapeuta e Pais

**Versão:** 1.0
**Foco:** Fluxos e usabilidade — não implementação técnica
**Status:** Pronto para design e desenvolvimento

---

## Contexto

Este documento descreve as três camadas de conexão entre o terapeuta e os pais no TEAmo:

- **Fase 0 — A conexão:** o convite, o aceite e o reconhecimento da criança
- **Conexão 1 — Agenda:** eventos do terapeuta aparecem automaticamente para os pais
- **Conexão 2 — Central de atualizações:** os pais acompanham tudo que o terapeuta registra

O princípio central de todas as conexões é: **o terapeuta alimenta, os pais recebem.** Os pais nunca precisam buscar ativamente a informação — ela chega até eles de forma organizada e progressiva.

---

## Fase 0 — Estabelecendo a conexão

### 0.1 — Do lado do terapeuta: enviando o convite

**Onde acontece:** tela do paciente, aba "Responsáveis"

O terapeuta acessa o perfil do paciente e vai até a aba de responsáveis. Lá encontra um campo simples para digitar o email do responsável e um botão "Enviar convite". Pode adicionar mais de um responsável — pai e mãe, por exemplo.

Ao enviar, o sistema dispara um email para o responsável e o status do convite muda imediatamente na tela:

**Estado "Aguardando aceite":**
- Email exibido
- Data e hora do envio
- Tempo restante para expirar (se houver limite)
- Duas ações disponíveis: "Reenviar convite" e "Cancelar convite"
- Um texto de orientação: "O convite foi enviado. Quando o responsável aceitar, você será notificado aqui."

O terapeuta pode sair da tela e voltar — o status persiste e é sempre visível.

---

### 0.2 — Do lado dos pais: recebendo o convite

**Canal:** email

O pai ou mãe recebe um email com:
- Quem está convidando (nome e especialidade do terapeuta)
- Para qual criança (pelo nome que o terapeuta cadastrou)
- O que o acesso permitirá (visualizar sessões, agenda, instruções)
- Botão de ação: "Ver convite"
- Aviso discreto: "Este convite foi enviado para [email]. Se você não esperava este convite, pode ignorá-lo."

---

### 0.3 — Tela de contexto do convite (antes do login)

**Rota:** `/convite-terapeuta/[token]` — pública, sem necessidade de login ainda

Ao clicar no link do email, o pai chega numa tela que apresenta o convite com clareza antes de pedir qualquer ação de conta:

**Conteúdo da tela:**
- Nome e especialidade do terapeuta com destaque
- Nome da criança conforme cadastrada pelo terapeuta
- Lista visual do que será acessível: "Você poderá ver sessões registradas, agenda de atendimentos e instruções para casa"
- Dois botões de ação:
  - "Já tenho conta — fazer login"
  - "Criar conta no TEAmo"

**Estados de erro desta tela:**
- Link expirado: "Este convite não está mais disponível. Peça ao terapeuta que envie um novo."
- Link inválido: "Link não reconhecido. Verifique se o link está correto ou solicite um novo convite."
- Já utilizado: "Este convite já foi aceito. Faça login para acessar normalmente."

---

### 0.4 — Login ou cadastro com contexto preservado

O token do convite é preservado durante todo o processo de login ou cadastro. O pai não perde o convite se precisar criar conta.

**Se criar conta:** fluxo de cadastro simplificado — nome, email e senha. O email é pré-preenchido com o email do convite e fica travado (com nota explicativa). O passo de cadastro de criança é pulado — a criança virá do convite.

**Se já tiver conta:** tela de login normal com um banner no topo informando o contexto do convite.

Após autenticar: o sistema redireciona automaticamente para a etapa de reconhecimento da criança.

---

### 0.5 — Etapa de reconhecimento da criança ⭐

**Esta é a etapa mais importante do fluxo de conexão.**

Após o login, o pai chega numa tela intermediária antes de confirmar o aceite. O objetivo é determinar se a criança do terapeuta é a mesma que o pai já tem cadastrada — ou se é uma criança diferente.

**O que a tela exibe:**
- Nome da criança conforme cadastrada pelo terapeuta
- Data de nascimento se disponível
- A pergunta direta: "Você reconhece esta criança?"

**Cenário A — Pai não tem nenhuma criança cadastrada:**
O sistema pula a pergunta e segue direto para o aceite. A criança do terapeuta será criada automaticamente no perfil dos pais após o aceite.

**Cenário B — Pai tem uma ou mais crianças cadastradas:**
A tela exibe a lista das crianças já cadastradas, cada uma como um card com nome, idade e foto/inicial. Abaixo, um botão "Não é nenhuma dessas — é uma nova criança".

O pai seleciona qual das suas crianças corresponde ao paciente do terapeuta — ou indica que é uma nova.

**Se confirmar que é a mesma:**
- Aparece uma tela de confirmação dupla: "Você está vinculando o acompanhamento de [terapeuta] ao perfil de [nome da criança selecionada]. Está correto?"
- Botões: "Sim, confirmar" e "Voltar"
- Ao confirmar: o terapeuta é vinculado ao perfil já existente da criança. Nenhum dado é perdido ou duplicado.

**Se for uma nova criança:**
- O aceite cria um novo perfil de criança na conta dos pais
- Esse novo perfil aparece na seção "Crianças cadastradas" do dashboard
- O terapeuta é vinculado a esse novo perfil

**Por que essa etapa é crucial:**
Sem ela, a mesma criança pode existir em dois perfis diferentes na conta dos pais — um criado pelos próprios pais e outro criado pelo terapeuta. Isso fragmenta o histórico e confunde. A confirmação manual evita esse problema mantendo os pais no controle da decisão.

---

### 0.6 — Tela de aceite final (autenticado)

Após o reconhecimento da criança, o pai vê a tela de confirmação final:

**Conteúdo:**
- Nome e especialidade do terapeuta
- Foto/avatar do terapeuta (se disponível)
- Criança vinculada (o perfil já existente ou o novo)
- Lista do que o terapeuta poderá ver: perfil da criança, histórico de registros dos pais (se autorizado), documentos compartilhados
- Lista do que os pais poderão ver: sessões registradas, agenda, planos e instruções
- Checkbox de consentimento: "Entendo que este terapeuta terá acesso a informações de saúde de [criança] e que posso revogar este acesso a qualquer momento."

**Ações:**
- Botão principal: "Aceitar acompanhamento"
- Botão secundário: "Recusar" — com confirmação inline

Ao aceitar: os pais são direcionados para o dashboard com uma mensagem de boas-vindas contextual mostrando o novo card de acompanhamento terapêutico.

---

### 0.7 — Notificação ao terapeuta quando o convite é aceito

Assim que os pais aceitam, o terapeuta recebe:

**Notificação in-app (sino):**
- Ícone de check verde
- Texto: "[Nome do responsável] aceitou o acompanhamento de [criança]"
- Ao clicar: vai direto para a aba "Responsáveis" do paciente

**Na aba Responsáveis do terapeuta:**
O card do convite muda completamente de aparência:
- Avatar com inicial do nome do responsável
- Nome completo do responsável
- Email
- Indicador verde "Conectado"
- Data em que aceitou
- A ação disponível muda para "Revogar acesso" (em vermelho, discreto)

Se os pais indicaram que a criança do terapeuta era a mesma de um perfil já existente, o terapeuta também vê um aviso informativo: "Este paciente foi vinculado ao perfil já existente de [nome]. O histórico anterior está preservado."

---

## Conexão 1 — Agenda sincronizada

### 1.1 — Como o evento aparece para os pais

Sempre que o terapeuta cria ou edita uma sessão agendada para um paciente, esse evento aparece automaticamente na agenda dos pais, na seção da criança correspondente. Os pais não fazem nada — o evento chega.

Na agenda dos pais, o evento do terapeuta é visualmente distinto dos eventos criados pelos próprios pais:

**Identidade visual do evento do terapeuta:**
- Borda ou fundo na cor teal (a cor do módulo do terapeuta)
- Ícone de estetoscópio no canto do card
- Nome e especialidade do terapeuta exibidos como subtítulo
- Título do evento (ex: "Sessão de Fonoaudiologia")
- Data, hora e duração

Os pais podem ver os eventos do terapeuta em todas as visões de agenda — semana, mês e lista. Mas não podem editar ou excluir esses eventos — apenas visualizar.

**Notificação de novo evento agendado:**
Quando o terapeuta cria uma sessão, os pais recebem uma notificação in-app: "[Terapeuta] agendou uma sessão de [especialidade] para [criança] em [data]." Ao clicar, abre o detalhe do evento.

---

### 1.2 — O detalhe do evento — conteúdo progressivo

Ao clicar num evento do terapeuta na agenda, os pais abrem uma tela de detalhe que evolui conforme o terapeuta vai preenchendo. O mesmo evento tem estados diferentes ao longo do tempo.

---

**Estado 1 — Sessão futura, sem plano:**

O evento existe mas o terapeuta ainda não preencheu o plano pré-sessão.

O que os pais veem:
- Data, hora e duração confirmadas
- Nome e especialidade do terapeuta
- Local (presencial ou online, se informado)
- Um espaço em branco com texto discreto: "O terapeuta ainda não adicionou informações sobre esta sessão."

Não há sensação de vazio negativo — é um estado esperado.

---

**Estado 2 — Sessão futura, com plano visível:**

O terapeuta preencheu o plano e marcou como visível para a família.

O que os pais veem (além das informações básicas):
- Seção "O que está planejado para esta sessão" com fundo teal suave
- Objetivos da sessão em texto legível
- Lista de atividades planejadas (se preenchida)
- Observação: "Informações preparadas por [terapeuta] para esta sessão"

Este estado cria antecipação positiva — os pais chegam à sessão sabendo o que será trabalhado.

---

**Estado 3 — Sessão confirmada, registro em andamento:**

A sessão aconteceu mas o terapeuta ainda está preenchendo o registro.

O que os pais veem:
- Status: "Sessão realizada em [data]" com check verde
- Duração real (se registrada)
- Plano da sessão (se estava visível)
- Um indicador discreto: "O terapeuta está preparando o registro desta sessão."

Não há urgência ou ansiedade — é um estado de transição natural.

---

**Estado 4 — Registro publicado:**

O terapeuta publicou o registro completo.

O que os pais veem — organizado em blocos claros:

**Bloco "O que foi trabalhado"**
Resumo do que aconteceu na sessão em linguagem acessível. Se o terapeuta preencheu observações clínicas compartilhadas, aparecem aqui.

**Bloco "Comportamentos desta sessão"** (se o terapeuta registrou)
Lista de comportamentos notáveis com ícone e descrição. Conquistas aparecem com ícone de estrela. Dificuldades aparecem de forma neutra, sem dramatização.

**Bloco "Para praticar em casa"** — destaque visual
Este é o bloco mais importante para os pais e recebe tratamento visual diferenciado — fundo colorido, tipografia maior, ícone de casa. Contém as instruções diretas do terapeuta para a família aplicar no dia a dia.

**Bloco "Anexos"** (se houver)
Fotos, vídeos ou PDFs que o terapeuta compartilhou dessa sessão.

---

**Estado 5 — Falta registrada:**

O terapeuta registrou que a sessão não aconteceu.

O que os pais veem:
- Status: "Sessão não realizada" com indicador visual neutro (não alarmante)
- Motivo se o terapeuta informou (ex: "Falta justificada")
- Nenhum bloco de registro — a sessão não aconteceu

---

### 1.3 — Lembretes para os pais

Se o terapeuta ativou a opção "Notificar família", os pais recebem lembretes automáticos antes da sessão:
- 1 dia antes: "Amanhã às [hora] — Sessão de [especialidade] do [criança]"
- 1 hora antes: "Em 1 hora — Sessão de [especialidade] do [criança]"

Os pais podem gerenciar suas preferências de lembrete nas configurações do app — sem precisar do terapeuta para isso.

---

## Conexão 2 — Central de atualizações do terapeuta

### 2.1 — Ponto de entrada no dashboard

O `TherapistAccessCard` atual é estático. Ele precisa se tornar um ponto de entrada vivo, que comunica o estado da conexão e convida à ação.

**Quando não há atualizações novas:**
O card mostra o nome e especialidade do terapeuta, a criança vinculada e a última atualização com data. Botão "Ver histórico" em texto discreto.

**Quando há atualizações não vistas:**
O card ganha vida:
- Ponto indicador teal pulsando no canto superior direito
- Texto em destaque: "X novas atualizações"
- Preview da mais recente: "Ana (Fonoaudióloga) registrou a sessão de ontem · Instrução para casa disponível"
- Botão "Ver agora" em destaque

**Quando há um marco atingido não visto:**
O card recebe tratamento especial — fundo com gradiente celebratório, ícone de estrela, texto: "🎉 Lucas atingiu um novo marco! Toque para ver."

---

### 2.2 — A tela de atualizações

**Rota:** acessada ao tocar no TherapistAccessCard

**Header:**
- Botão de voltar
- Nome da criança
- Nome e especialidade do terapeuta
- Indicador de status da conexão: "Conectado desde [data]"

**Filtros rápidos (chips horizontais com scroll):**
- Todos
- Sessões
- Instruções para casa
- Marcos

O filtro "Todos" é o padrão. Os pais podem navegar por tipo de conteúdo rapidamente.

---

### 2.3 — A timeline de atualizações

Lista vertical cronológica reversa — mais recente no topo. Cada item é um card.

**Agrupamento por data:**
- "Hoje"
- "Ontem"
- "Esta semana"
- "Mês passado"
- [mês e ano] para itens mais antigos

Itens não vistos têm uma linha teal à esquerda ou um ponto indicador. Itens já vistos não têm indicador. A marcação como "visto" acontece automaticamente quando o pai abre a tela de atualizações — não exige ação manual.

---

### 2.4 — Tipos de card na timeline

**Card de registro de sessão:**
- Ícone de prancheta
- "Registro de sessão · [data]"
- Preview das observações compartilhadas (2 linhas truncadas)
- Linha destacada em teal: "Instrução para casa: [primeiras palavras]..."
- Ao tocar: abre o detalhe completo do registro (os 4 blocos da sessão)

**Card de plano pré-sessão:**
- Ícone de calendário
- "Plano para a sessão de [data futura]"
- "O que está planejado: [primeiras palavras dos objetivos]..."
- Ao tocar: abre o plano completo

**Card de instrução para casa:**
Quando o terapeuta atualiza uma instrução fora de uma sessão específica.
- Ícone de casa
- "Nova orientação para casa"
- Texto completo da instrução (curto o suficiente para ler no card)
- Ao tocar: abre o detalhe

**Card de marco atingido:**
Visualmente diferente de todos os outros — é o momento de maior impacto emocional.
- Fundo com gradiente suave na cor da área do marco (Comunicação = azul, etc.)
- Ícone de estrela ou troféu
- "🎉 Marco conquistado!"
- Título do marco em tipografia grande
- Data da conquista
- Ao tocar: abre a tela de celebração completa com animação

---

### 2.5 — Estado vazio da timeline

Se a conexão é recente e o terapeuta ainda não publicou nada:

Ilustração simples, texto amigável:
"[Terapeuta] ainda não publicou atualizações. Quando registrar sessões ou conquistas, elas aparecerão aqui."

Sem negatividade — é um estado esperado no início da relação.

---

### 2.6 — Múltiplos terapeutas para a mesma criança

Se a criança tem mais de um terapeuta conectado, no dashboard aparecem múltiplos `TherapistAccessCards`, um por terapeuta. Cada um com seu próprio contador de não vistos e sua própria timeline.

Na agenda, eventos de diferentes terapeutas aparecem com cores distintas — cada terapeuta tem uma cor identificadora consistente em todos os eventos e cards.

---

## Resumo dos fluxos por papel

### Fluxo do terapeuta

```
Cria paciente
→ Adiciona email do responsável na aba "Responsáveis"
→ Envia convite
→ Aguarda aceite (vê status na tela)
→ Recebe notificação quando aceito (vê "Conectado" na aba)
→ Agenda sessões → aparecem automaticamente para os pais
→ Preenche plano pré-sessão (opcional, visível para pais se marcado)
→ Confirma sessão após atendimento
→ Preenche registro pós-sessão → publica → pais recebem atualização
→ Marca marcos como atingidos → pais recebem celebração
```

### Fluxo dos pais

```
Recebe email de convite
→ Clica no link → vê contexto do convite
→ Faz login ou cria conta
→ Reconhece a criança (mesma ou nova)
→ Confirma aceite
→ Chega no dashboard com TherapistAccessCard visível
→ Vê sessões do terapeuta na sua agenda automaticamente
→ Abre evento e vê conteúdo progressivo (plano → registro → instrução)
→ Recebe notificações de novas atualizações
→ Acessa a central de atualizações quando quiser ver o histórico completo
→ Recebe celebração especial quando marco é atingido
```

---

## Princípios de usabilidade que guiam este módulo

**Passividade dos pais:** os pais nunca precisam buscar a informação ativamente. Ela chega até eles. O esforço de alimentar o sistema é inteiramente do terapeuta.

**Progressividade:** um evento de agenda começa vazio e vai ganhando camadas de informação conforme o tempo passa. Os pais voltam ao mesmo item e encontram mais — isso cria o hábito de verificar.

**Separação visual clara:** conteúdo do terapeuta sempre usa teal. Conteúdo dos próprios pais usa a paleta roxa/gradiente. Nunca se confundem visualmente.

**Celebração como diferencial:** marcos atingidos recebem tratamento visual e emocional diferente de todo o resto. São os momentos que criam vínculo afetivo com o produto.

**Controle sempre dos pais:** em qualquer momento, os pais podem revogar o acesso do terapeuta. Essa opção está sempre acessível — não escondida — mas não é intrusiva. O app confia na relação mas mantém o pai como autoridade.
