# Spec — Onboarding e Agenda do Terapeuta

**Versão:** 1.0
**Status:** Pronto para implementação e design

---

## Contexto

O terapeuta é um usuário primário do TEAmo com necessidades distintas dos pais. Seu onboarding coleta dados de perfil profissional e inicia o cadastro de pacientes. Sua agenda é centrada em múltiplos pacientes, com três momentos distintos por sessão: planejamento pré-sessão, confirmação durante/após, e registro pós-sessão com visibilidade controlada para os pais.

---

## Parte 1 — Onboarding do Terapeuta

### Fluxo geral

```
Cadastro (email + senha + user_type = therapist)
→ Verificação de email
→ Etapa 1: Perguntas de perfil
→ Etapa 2: Cadastro de pacientes (opcional)
→ Etapa 3: Tela de conclusão
→ Dashboard do terapeuta
```

O onboarding do terapeuta é completamente separado do onboarding dos pais. A bifurcação acontece logo após a verificação de email, baseada no `user_type` do perfil.

---

### Etapa 1 — Perguntas de perfil

**Rota:** `/onboarding/terapeuta/perfil`

Tela única com quatro perguntas em chips selecionáveis. Sem campos de texto livre. Todas opcionais — botão "Pular" visível no rodapé.

Os dados coletados aqui alimentam a tabela `therapist_profiles` e a tabela `analytics_events` para inteligência de produto. Nunca são exibidos publicamente.

#### Pergunta 1 — Onde você atende?
Chips de seleção única:
- Consultório particular
- Clínica ou instituição
- Ambos

#### Pergunta 2 — Modalidade de atendimento
Chips de seleção única:
- Presencial
- Online
- Ambos

#### Pergunta 3 — Quantos pacientes você atende atualmente?
Chips de seleção única:
- 1 a 5
- 6 a 10
- 11 a 20
- Mais de 20

#### Pergunta 4 — Quantas horas de sessão você realiza por semana?
Chips de seleção única:
- Menos de 10h
- 10h a 20h
- 20h a 30h
- Mais de 30h

**Comportamento:** Ao selecionar um chip, ele fica destacado. O terapeuta pode mudar a seleção antes de avançar. Botão principal "Continuar" habilitado sempre (as respostas são opcionais). Botão secundário "Pular esta etapa" no rodapé.

**Ao avançar:** Salva as respostas selecionadas em `therapist_profiles` (colunas: `attendance_setting`, `attendance_modality`, `patient_count_range`, `weekly_hours_range`). Navega para Etapa 2.

---

### Etapa 2 — Cadastro de pacientes

**Rota:** `/onboarding/terapeuta/pacientes`

Tela com orientação clara no topo e formulário de cadastro de paciente. O terapeuta pode adicionar quantos pacientes quiser em sequência, ou pular completamente.

**Texto de orientação (topo da tela):**
> "Adicione seus pacientes para começar a usar o TEAmo. Esta é a primeira etapa para organizar os atendimentos e conectar as famílias. Você pode adicionar mais pacientes a qualquer momento."

#### Formulário de cadastro de paciente

**Campo 1 — Nome da criança**
- Label: "Primeiro nome da criança"
- Tipo: input text
- Obrigatório: sim
- Placeholder: "Como você chama seu paciente?"
- Máximo: 60 caracteres
- Nota: apenas o primeiro nome, não o nome completo

**Campo 2 — Responsável(eis)**
- Label: "Nome do responsável"
- Tipo: input text repetível
- Obrigatório: sim (pelo menos um)
- Botão "+ Adicionar outro responsável" abaixo do campo
- Pode ter múltiplos responsáveis (pai e mãe, avó, tutor)
- Máximo por nome: 80 caracteres

**Campo 3 — Email do responsável**
- Label: "Email para convite (opcional)"
- Tipo: input email
- Obrigatório: não
- Placeholder: "email@exemplo.com"
- Nota abaixo do campo: "Se preenchido, o convite será enviado automaticamente ao concluir o onboarding."
- Validação: formato de email válido se preenchido

**Ação ao clicar em "Adicionar paciente":**
- Valida nome da criança e pelo menos um responsável
- O paciente aparece listado acima do formulário como card pequeno: "[Nome da criança] · [Nome do responsável]"
- Formulário é limpo para adicionar o próximo
- Botão "Adicionar outro paciente" aparece abaixo da lista

**Lista de pacientes adicionados:**
Exibida acima do formulário. Cada item mostra nome da criança, nome do responsável e um ícone de remover (X) para desfazer se necessário.

**Rodapé da tela:**
- Botão principal: "Concluir" — conclui o onboarding com os pacientes adicionados
- Botão secundário: "Adicionar depois" — pula o cadastro de pacientes e vai direto para a conclusão

---

### Etapa 3 — Tela de conclusão

**Rota:** `/onboarding/terapeuta/conclusao`

Tela de boas-vindas contextual. O conteúdo varia conforme o que foi feito nas etapas anteriores.

**Se adicionou pacientes com email:**
- Ícone de check animado
- Título: "Tudo pronto, [nome]!"
- Texto: "Seus pacientes foram cadastrados e os convites foram enviados. Assim que os responsáveis aceitarem, você poderá registrar sessões e acompanhar a evolução."
- Botão: "Ir para o painel"

**Se adicionou pacientes sem email:**
- Título: "Pacientes cadastrados!"
- Texto: "Lembre-se de convidar os responsáveis para ativar o acesso completo. Você encontra essa opção no perfil de cada paciente."
- Botão: "Ir para o painel"

**Se pulou o cadastro:**
- Título: "Bem-vindo ao TEAmo!"
- Texto: "Quando estiver pronto, adicione seus pacientes pelo painel para começar a organizar os atendimentos."
- Botão: "Adicionar meu primeiro paciente" (vai para o formulário de cadastro)
- Link: "Explorar o painel primeiro"

**Ao clicar em "Ir para o painel":** Navega para `/dashboard` na visão do terapeuta (lista de pacientes).

---

## Parte 2 — Agenda do Terapeuta

### Visão geral

A agenda do terapeuta é centrada em múltiplos pacientes. Na visão de semana, cada paciente tem uma cor distinta — o terapeuta identifica visualmente a distribuição da semana sem precisar ler cada evento. Na visão de mês, cada dia com sessão exibe um indicador de status (com registro / pendente de registro / falta).

A agenda tem três momentos distintos por sessão, acessíveis de forma progressiva:

```
Agendamento fixo → Pré-sessão (planejamento) → Confirmação → Pós-sessão (registro)
```

---

### 2.1 — Agendamento de sessão recorrente

**Acionado por:** Botão "+" na agenda do terapeuta

**Campos:**

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Paciente | Seleção da lista | Sim | Lista de pacientes vinculados ao terapeuta |
| Tipo de sessão | Chips | Sim | Individual / Em grupo / Familiar |
| Data de início | Date picker | Sim | — |
| Hora de início | Time picker | Sim | — |
| Duração | Chips + input | Sim | 30min / 45min / 60min / 90min / Personalizado |
| Recorrência | Seleção | Sim | Não repete / Semanal / Quinzenal / Mensal |
| Dias da semana | Multi-seleção | Se semanal | Dom/Seg/Ter/Qua/Qui/Sex/Sáb |
| Local | Texto | Não | Presencial (nome/endereço) ou Online (plataforma) |
| Lembrete para mim | Toggle + chips | Não | 1 dia antes / 1 hora antes (ambos por padrão) |
| Notificar família | Toggle | Não | Envia lembrete aos pais antes da sessão |

**Ao salvar:** Cria o(s) evento(s) em `agenda_events` com `therapist_id` preenchido. Se recorrente, gera os eventos futuros conforme a regra de recorrência. O evento fica com `status = 'upcoming'`.

---

### 2.2 — Plano pré-sessão

**Acionado por:** Clicar num evento futuro na agenda → botão "Planejar sessão"

Disponível a partir da criação do evento até o horário de início. Após o início, a tela muda para a confirmação.

**Campos:**

**Bloco — Objetivos**

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Objetivos da sessão | Textarea | Não | O que se pretende trabalhar. Ex: "Trabalhar imitação motora e contato visual" |
| Metas terapêuticas vinculadas | Multi-seleção | Não | Lista das metas cadastradas para aquele paciente. Múltipla seleção |
| Atividades planejadas | Lista repetível | Não | Campo de texto por atividade. Botão "+ Adicionar atividade" |
| Materiais necessários | Textarea | Não | Ex: "Bolas sensoriais, cartões PECS" |

**Bloco — Visibilidade**

| Campo | Tipo | Padrão | Detalhes |
|---|---|---|---|
| Visível para a família | Toggle | Ligado | Se ligado, os pais veem o plano antes da sessão acontecer |

**Ao salvar:** Armazenado como `session_plan` (jsonb) no `agenda_event`. Se visível para família, os pais já podem ver o plano no perfil da criança antes da sessão.

---

### 2.3 — Confirmação da sessão

**Acionado por:** Clicar num evento no horário ou após → botão "Registrar sessão"

Tela rápida de confirmação antes de abrir o registro completo.

**Campos:**

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Comparecimento | Chips | Sim | Aconteceu / Falta justificada / Falta sem aviso |
| Duração real | Input numérico | Se aconteceu | Pré-preenchido com duração padrão, editável |
| Horário de início real | Time picker | Não | Pré-preenchido, editável se houve atraso |

**Se a sessão não aconteceu:** Registro encerra aqui. Campo opcional "Motivo da falta" (texto livre). Toggle "Notificar família sobre a falta". Status do evento muda para `missed`.

**Se a sessão aconteceu:** Avança para o registro pós-sessão com status `happened`.

---

### 2.4 — Registro pós-sessão

**Acionado por:** Após a confirmação de comparecimento, ou reabrindo um evento com status `happened`

Organizado em quatro blocos. O terapeuta pode salvar a qualquer momento e continuar depois — o registro fica como rascunho.

---

#### Bloco 1 — O que foi trabalhado

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Objetivos atingidos | Checklist | Não | Gerado automaticamente a partir dos objetivos do plano pré-sessão. Terapeuta marca quais foram trabalhados |
| O que foi efetivamente feito | Textarea | Não | Descrição livre da sessão real. Pode diferir do planejado |
| Nível de engajamento | Chips | Não | Baixo / Médio / Alto |

---

#### Bloco 2 — Observações clínicas

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Observações gerais | Textarea | Não | Campo principal do registro clínico |
| Comportamentos notáveis | Lista repetível | Não | Adiciona itens individualmente. Por item: descrição (texto) + tipo (chips abaixo) |
| Tipo do comportamento | Chips (por item) | Não | Conquista / Dificuldade / Regulação / Comunicação / Interação social / Outro |
| Anexos | Upload múltiplo | Não | Fotos, vídeos curtos, áudios, PDFs. Já suportado pela estrutura existente |
| Visibilidade | Toggle | Padrão: Compartilhado | "Compartilhado com a família" ou "Somente eu (privado)" |

Se marcado como privado, nenhum campo deste bloco é visível para os pais.

---

#### Bloco 3 — Instrução para família

Sempre visível para os pais. Não tem toggle de privacidade — é o canal direto de orientação para casa.

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| O que praticar em casa | Textarea | Não | Orientações diretas para os pais |
| Frequência sugerida | Texto curto | Não | Ex: "2x ao dia por 5 minutos" |
| Material de apoio | Upload | Não | PDF, imagem ou vídeo de referência para os pais |

---

#### Bloco 4 — Próxima sessão

Os campos deste bloco alimentam automaticamente o pré-sessão da próxima sessão agendada com o mesmo paciente.

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Pontos a continuar | Textarea | Não | O que ficou pendente ou deve ser retomado |
| Ajuste de abordagem | Textarea | Não | Mudanças de estratégia para as próximas sessões. Campo privado — nunca visível para pais |

**Ao salvar:** O conteúdo de "Pontos a continuar" aparece como rascunho automático no campo "Objetivos da sessão" do próximo evento agendado com aquele paciente.

---

### 2.5 — O que os pais veem

Na visão dos pais, cada sessão aparece como um card na timeline da criança com:

- Data, duração e status de comparecimento
- Plano da sessão (se o terapeuta marcou como visível)
- Observações clínicas compartilhadas
- Instrução para casa (sempre visível)
- Anexos compartilhados

**O que nunca aparece para os pais:**
- Observações marcadas como privadas
- Bloco de ajuste de abordagem clínica
- Nível de engajamento (dado interno do terapeuta)

---

### 2.6 — Indicadores visuais na agenda

**Visão de semana:** Cada paciente tem uma cor distinta. O terapeuta identifica a distribuição da semana por cor sem precisar ler os títulos.

**Visão de mês:** Cada dia com sessão exibe um ponto colorido:
- Verde: sessão com registro completo
- Amarelo: sessão aconteceu, registro pendente
- Vermelho: falta registrada
- Cinza: sessão futura (sem registro ainda)

**Preview "o que os pais verão":** No momento de salvar o registro, botão "Ver como os pais verão" exibe uma prévia de como o card aparecerá na visão da família — antes de publicar.

---

## Banco de dados — adições necessárias

### Tabela `therapist_profiles` (nova)

```sql
CREATE TABLE therapist_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty             text NOT NULL,
  council_type          text NOT NULL,       -- CRP, CREFONO, CRM, etc.
  council_number        text NOT NULL,
  council_state         text NOT NULL,
  attendance_setting    text,                -- particular, clinica, ambos
  attendance_modality   text,                -- presencial, online, ambos
  patient_count_range   text,                -- 1-5, 6-10, 11-20, 20+
  weekly_hours_range    text,                -- <10h, 10-20h, 20-30h, 30h+
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

### Tabela `agenda_events` — colunas adicionais

```sql
ALTER TABLE agenda_events
  ADD COLUMN therapist_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN session_type     text CHECK (session_type IN ('individual','grupo','familiar')),
  ADD COLUMN session_plan     jsonb DEFAULT '{}'::jsonb,  -- plano pré-sessão
  ADD COLUMN plan_visible_to_parents boolean DEFAULT true,
  ADD COLUMN actual_duration_minutes integer,
  ADD COLUMN actual_start_at  timestamptz,
  ADD COLUMN attendance       text CHECK (attendance IN ('happened','missed_justified','missed_no_show'));
```

### Tabela `session_records` (nova — substitui uso de attendance_records para terapeutas)

```sql
CREATE TABLE session_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid NOT NULL REFERENCES agenda_events(id) ON DELETE CASCADE,
  therapist_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id                uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,

  -- Bloco 1: o que foi trabalhado
  goals_achieved          jsonb DEFAULT '[]'::jsonb,   -- checklist dos objetivos
  what_was_done           text,
  engagement_level        text CHECK (engagement_level IN ('baixo','medio','alto')),

  -- Bloco 2: observações clínicas
  clinical_observations   text,
  notable_behaviors       jsonb DEFAULT '[]'::jsonb,   -- [{description, type}]
  is_private              boolean NOT NULL DEFAULT false,

  -- Bloco 3: instrução para família (sempre visível)
  family_instruction      text,
  frequency_suggestion    text,

  -- Bloco 4: próxima sessão
  points_to_continue      text,
  approach_adjustment     text,  -- sempre privado

  -- Controle
  is_draft                boolean NOT NULL DEFAULT true,
  published_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
```

### RLS — `session_records`

```sql
-- Terapeuta lê e escreve seus próprios registros
CREATE POLICY "therapist_own_records" ON session_records
  FOR ALL TO authenticated
  USING (therapist_id = auth.uid());

-- Pais leem registros não-privados das crianças vinculadas
CREATE POLICY "parents_read_shared_records" ON session_records
  FOR SELECT TO authenticated
  USING (
    is_private = false
    AND is_draft = false
    AND EXISTS (
      SELECT 1 FROM children
      WHERE children.id = session_records.child_id
        AND children.user_id = auth.uid()
    )
  );
```

---

## Rotas novas

| Rota | Tipo | Descrição |
|---|---|---|
| `/onboarding/terapeuta/perfil` | Nova | Etapa 1 — perguntas de perfil |
| `/onboarding/terapeuta/pacientes` | Nova | Etapa 2 — cadastro de pacientes |
| `/onboarding/terapeuta/conclusao` | Nova | Etapa 3 — tela de conclusão |
| `/agenda` (modificação) | Modificação | Bifurca visão por `user_type` |
| `/agenda/sessao/:eventId/plano` | Nova | Plano pré-sessão |
| `/agenda/sessao/:eventId/registro` | Nova | Registro pós-sessão |

---

## Checklist de implementação

- [ ] Migration: `therapist_profiles`
- [ ] Migration: colunas adicionais em `agenda_events`
- [ ] Migration: `session_records` + RLS
- [ ] Onboarding bifurcado pós-verificação de email (baseado em `user_type`)
- [ ] Etapa 1: tela de perguntas de perfil
- [ ] Etapa 2: tela de cadastro de pacientes (múltiplos)
- [ ] Etapa 3: tela de conclusão contextual
- [ ] Agenda: visão de semana multi-paciente com cores por paciente
- [ ] Agenda: indicadores de status na visão de mês
- [ ] Formulário de agendamento recorrente
- [ ] Tela de plano pré-sessão
- [ ] Tela de confirmação de sessão
- [ ] Tela de registro pós-sessão (4 blocos)
- [ ] Preview "o que os pais verão"
- [ ] Alimentação automática do próximo pré-sessão com "pontos a continuar"
- [ ] Visão dos pais: card de sessão na timeline da criança

---

## Prompt de Design

> ⚠️ O prompt de design está no arquivo `prompt-design-terapeuta.md` na mesma pasta.
