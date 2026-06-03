# Spec — Marcos de Desenvolvimento, Metas de Sessão e Relatório de Evolução

**Versão:** 1.0
**Status:** Pronto para implementação e design

---

## Visão geral

O módulo de evolução é composto por três camadas interligadas:

**Marcos de desenvolvimento** — grandes conquistas de longo prazo definidas pelo terapeuta, sem prazo, celebradas quando atingidas.

**Metas de sessão** — objetivos operacionais trabalhados semana a semana, vinculados a um ou mais marcos. Cada sessão registra o resultado de cada meta trabalhada.

**Relatório de evolução** — documento gerado automaticamente consolidando marcos atingidos, progresso por área de desenvolvimento e atividades do período. Duas versões: uma visual e narrativa para os pais, uma analítica para o terapeuta.

A relação entre as três camadas é o que torna o sistema valioso: as metas de sessão constroem o caminho, os marcos registram as chegadas, e o relatório conta a história completa.

---

## Parte 1 — Marcos de Desenvolvimento

### Conceito

Um marco é uma conquista significativa no desenvolvimento da criança — ampla, representativa, sem prazo. Exemplos reais:

- "Inicia interação espontânea com outras crianças"
- "Comunica necessidades básicas verbalmente"
- "Tolera mudanças de rotina sem crise"
- "Permanece em ambiente com ruído moderado por 20 minutos"

Marcos não têm prazo porque cada criança evolui no seu tempo. A ausência de prazo é intencional — elimina cobrança e ansiedade, e mantém o foco na celebração quando a conquista chega.

### Áreas de desenvolvimento

Todo marco pertence a uma área. As áreas organizam a visão de progresso e alimentam o relatório.

| Área | Descrição |
|---|---|
| Comunicação | Linguagem verbal e não-verbal, compreensão, expressão |
| Socialização | Interação com pares, leitura social, vínculo |
| Autonomia | Cuidados pessoais, independência nas rotinas |
| Comportamento | Regulação emocional, adaptação a mudanças |
| Cognição | Aprendizagem, memória, resolução de problemas |
| Motricidade | Coordenação motora fina e grossa |

### Estados do marco

| Estado | Descrição |
|---|---|
| `em_progresso` | Marco definido, sendo trabalhado ativamente |
| `atingido` | Terapeuta marcou como conquistado — data é registrada e congelada |
| `pausado` | Marco existe mas não está sendo trabalhado no momento |

Transições permitidas:
- `em_progresso` → `atingido` (principal fluxo)
- `em_progresso` → `pausado`
- `pausado` → `em_progresso`
- `atingido` → nunca volta para outro estado (conquista é permanente)

### Campos do marco

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Título | Texto curto | Sim | Máximo 120 caracteres. Ex: "Inicia contato visual espontâneo" |
| Área de desenvolvimento | Seleção única | Sim | Uma das 6 áreas |
| Descrição | Textarea | Não | Detalhamento do que significa esse marco para aquela criança específica. Máximo 500 caracteres |
| Visível para a família | Toggle | Sim | Padrão: ligado. Se ligado, pais veem o marco e seu status |
| Data de início do trabalho | Date | Não | Quando o terapeuta começou a trabalhar esse marco. Preenchimento automático com a data de criação, editável |

**Ao marcar como atingido:**
- Pergunta de confirmação: "Confirmar que [título] foi atingido? Esta ação não pode ser desfeita."
- Se confirmado: `status = atingido`, `achieved_at = now()` — permanente
- Notificação especial disparada para os pais (se visível para família)
- Marco aparece na linha do tempo como conquista celebrada

### Notificação de marco atingido para os pais

Não é uma notificação comum. É um momento de celebração. A notificação push e in-app deve ter:

- Ícone de estrela ou troféu
- Título: "🎉 [Nome da criança] conquistou um novo marco!"
- Corpo: "[Título do marco]"
- Ação ao clicar: abre a tela de conquista com animação

A tela de conquista é uma tela especial — não apenas o detalhe do marco. Tem animação de celebração, o título do marco em destaque, a data de conquista e um texto encorajador. Os pais podem compartilhar essa conquista (imagem gerada pelo app) se quiserem.

---

## Parte 2 — Metas de Sessão

### Conceito

Metas de sessão são os objetivos operacionais que o terapeuta define para um conjunto de sessões — não apenas para uma sessão isolada. Elas ficam ativas enquanto estão sendo trabalhadas e podem ser referenciadas no plano de várias sessões.

Exemplos:
- "Manter contato visual por 3 segundos em 3 tentativas consecutivas"
- "Nomear 5 objetos do cotidiano com apoio de figura"
- "Aguardar a vez em atividade de 2 turnos"

### Vinculação com marcos

Cada meta de sessão pode ser vinculada a um ou mais marcos. Essa relação é a que permite o relatório mostrar como as atividades semanais constroem o caminho para as grandes conquistas.

Exemplo: a meta "Nomear 5 objetos" está vinculada ao marco "Comunica necessidades básicas verbalmente". Quando essa meta é trabalhada e atingida repetidamente, o terapeuta tem evidência para marcar o marco como conquistado.

### Campos da meta de sessão

| Campo | Tipo | Obrigatório | Detalhes |
|---|---|---|---|
| Descrição | Texto | Sim | O que se pretende atingir. Máximo 200 caracteres |
| Marcos vinculados | Multi-seleção | Não | Quais marcos essa meta ajuda a construir |
| Área de desenvolvimento | Herdada do marco | Automático | Se vinculada a um marco, herda a área. Se não vinculada, selecionar manualmente |
| Status | Chips | Sim | Ativa / Atingida / Pausada |

### Registro de tentativas por sessão

Quando o terapeuta usa uma meta no plano ou no registro de uma sessão, ele registra o resultado naquela sessão:

| Resultado | Significado |
|---|---|
| `atingido` | A criança atingiu o critério naquela sessão |
| `parcial` | Houve progresso mas não atingiu completamente |
| `nao_atingido` | Não foi possível trabalhar ou não houve progresso |

Esse histórico de tentativas, sessão a sessão, forma a linha de progresso da meta ao longo do tempo. Uma meta com 10 sessões de histórico conta uma história muito mais rica do que um simples status.

---

## Parte 3 — Relatório de Evolução

### Conceito

O relatório é gerado pelo terapeuta para um paciente, em um período selecionado. Existe em duas versões com propósitos distintos mas geradas a partir dos mesmos dados.

**Versão família:** visual, narrativa, acessível. Pensada para pais leigos, médicos que não acompanharam o processo e escola. Sem jargão clínico. Foco nas conquistas e no que foi trabalhado de forma compreensível.

**Versão terapeuta:** analítica, detalhada, técnica. Pensada para o próprio terapeuta, para laudo, para supervisão clínica ou para apresentar a outro profissional da equipe.

### Seleção de período

Ao gerar o relatório, o terapeuta seleciona:
- **Período:** 1 mês / 3 meses / 6 meses / Personalizado (data início + data fim)
- **Versão:** Para a família / Para uso técnico / Ambas
- **Incluir:** Marcos atingidos / Progresso de metas / Frequência de sessões / Instruções para família — checkboxes individuais para personalizar o conteúdo

---

### Estrutura do relatório — Versão Família

**Capa**
- Logo do TEAmo
- Nome da criança e foto (se houver)
- Nome e especialidade do terapeuta
- Período do relatório
- Data de geração
- Frase de abertura contextual: "Este relatório acompanha o desenvolvimento de [nome] entre [mês] e [mês]."

**Seção 1 — A jornada do período**
Parágrafo narrativo gerado automaticamente a partir dos dados do período. Descreve em linguagem acessível quantas sessões aconteceram, qual foi a frequência, e qual o tom geral do período.

Exemplo gerado: "Entre março e maio de 2026, [Nome] participou de 18 sessões de terapia, com presença em 16 delas. Foi um período de avanços significativos, especialmente nas áreas de Comunicação e Socialização."

**Seção 2 — Conquistas do período** (destaque visual principal)
Lista dos marcos atingidos no período, cada um em um card visual:
- Ícone da área de desenvolvimento
- Título do marco
- Data em que foi atingido
- Descrição do marco (se preenchida)

Se não houve marcos atingidos no período, exibe marcos em progresso com indicador visual de "a caminho".

**Seção 3 — Progresso por área**
Seis blocos — um por área de desenvolvimento. Cada bloco mostra:
- Nome da área com ícone
- Indicador visual de progresso: Muito ativo / Ativo / Em início / Não trabalhado no período
- Número de metas trabalhadas na área
- Marcos ativos na área (com status)

O indicador de progresso não é uma porcentagem numérica — é qualitativo e visual, para não criar comparações numéricas que possam gerar ansiedade.

**Seção 4 — O que praticamos em casa**
Consolidação de todas as instruções para família registradas nas sessões do período. Aparece como lista de orientações, agrupadas por tema quando possível. Útil para os pais revisitarem e para médicos entenderem o que foi orientado.

**Seção 5 — Olhando para frente**
Marcos ativos que continuam sendo trabalhados. Metas de sessão em andamento. Texto: "Continuamos trabalhando em direção a estas conquistas." Tom encorajador, sem prazo.

**Rodapé**
Nome e especialidade do terapeuta, número de registro profissional, data de geração, nota: "Relatório gerado pelo TEAmo — plataforma de coordenação do cuidado."

---

### Estrutura do relatório — Versão Técnica (Terapeuta)

**Capa** — mesma da versão família, com indicação "Relatório Técnico"

**Seção 1 — Dados do período**
- Total de sessões agendadas
- Total de sessões realizadas
- Taxa de comparecimento (%)
- Sessões com falta justificada vs. sem aviso
- Duração média real das sessões

**Seção 2 — Marcos e metas**
Tabela de marcos ativos com status, data de início e data de conclusão (se atingido). Para cada meta de sessão trabalhada no período: descrição, marcos vinculados, número de sessões trabalhadas, resultado por sessão (linha de histórico compacta: ✓ parcial ✗ ✓ ✓).

**Seção 3 — Registros clínicos do período**
Comportamentos mais frequentemente registrados no período, categorizados por tipo (conquista, dificuldade, regulação, comunicação, interação social). Quantidade de ocorrências por categoria. Tendência: aumentou / diminuiu / estável em relação ao período anterior (se houver relatório anterior).

**Seção 4 — Evolução de engajamento**
Gráfico simples de engajamento da criança por sessão ao longo do período (Baixo / Médio / Alto por data). Identifica padrões — se há dias da semana com mais engajamento, se houve queda em determinado período.

**Seção 5 — Planejamento atual**
Metas ativas no momento da geração. Marcos em progresso. Ajustes de abordagem registrados.

---

### Design do PDF

O PDF deve ser bonito, legível e profissional. Diretrizes:

**Tipografia:** Fonte sem serifa, legível, hierarquia clara entre títulos, subtítulos e corpo. Tamanho mínimo de corpo: 11pt.

**Paleta de cores:** Cores das seis áreas de desenvolvimento — cada área tem uma cor própria consistente com o app. Fundo branco, uso de cor apenas em elementos de destaque.

**Cards de conquista:** Visualmente destacados, com fundo colorido suave, ícone da área e texto em destaque. São o elemento emocional central do documento — devem chamar atenção positivamente.

**Gráficos:** Simples, sem excesso de informação. Preferência por representações visuais qualitativas (barras, ícones, cores) em vez de números isolados na versão família.

**Espaçamento:** Generoso. O documento não deve parecer denso ou difícil de ler. Margens largas, linhas respirando.

**Rodapé de página:** Número de página, nome da criança, período. Sutil, não intrusivo.

---

## Banco de dados

### Tabela `therapeutic_milestones` (marcos)

```sql
CREATE TABLE therapeutic_milestones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title           text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description     text CHECK (length(description) <= 500),
  area            text NOT NULL CHECK (area IN (
                    'comunicacao','socializacao','autonomia',
                    'comportamento','cognicao','motricidade'
                  )),
  status          text NOT NULL DEFAULT 'em_progresso'
                  CHECK (status IN ('em_progresso','atingido','pausado')),
  is_shared_with_parents boolean NOT NULL DEFAULT true,
  started_at      timestamptz NOT NULL DEFAULT now(),
  achieved_at     timestamptz,   -- preenchido automaticamente ao marcar como atingido
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Garante que achieved_at só é preenchido quando status = 'atingido'
ALTER TABLE therapeutic_milestones
  ADD CONSTRAINT chk_achieved_at
  CHECK (
    (status = 'atingido' AND achieved_at IS NOT NULL) OR
    (status != 'atingido' AND achieved_at IS NULL)
  );

CREATE INDEX idx_milestones_child ON therapeutic_milestones(child_id);
CREATE INDEX idx_milestones_therapist ON therapeutic_milestones(therapist_id);
CREATE INDEX idx_milestones_area ON therapeutic_milestones(child_id, area);
```

### Tabela `session_goals` (metas de sessão)

```sql
CREATE TABLE session_goals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  description     text NOT NULL CHECK (length(description) BETWEEN 5 AND 200),
  area            text CHECK (area IN (
                    'comunicacao','socializacao','autonomia',
                    'comportamento','cognicao','motricidade'
                  )),
  status          text NOT NULL DEFAULT 'ativa'
                  CHECK (status IN ('ativa','atingida','pausada')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Vinculação de metas a marcos (many-to-many)
CREATE TABLE session_goal_milestones (
  goal_id         uuid NOT NULL REFERENCES session_goals(id) ON DELETE CASCADE,
  milestone_id    uuid NOT NULL REFERENCES therapeutic_milestones(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, milestone_id)
);
```

### Tabela `session_goal_attempts` (histórico de tentativas por sessão)

```sql
CREATE TABLE session_goal_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id         uuid NOT NULL REFERENCES session_goals(id) ON DELETE CASCADE,
  session_record_id uuid NOT NULL REFERENCES session_records(id) ON DELETE CASCADE,
  therapist_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result          text NOT NULL CHECK (result IN ('atingido','parcial','nao_atingido')),
  notes           text CHECK (length(notes) <= 300),  -- observação rápida sobre aquela tentativa
  attempted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_attempts_goal ON session_goal_attempts(goal_id);
CREATE INDEX idx_attempts_session ON session_goal_attempts(session_record_id);
```

### Tabela `evolution_reports` (relatórios gerados)

```sql
CREATE TABLE evolution_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  report_type     text NOT NULL CHECK (report_type IN ('family','technical','both')),
  storage_path_family    text,   -- caminho do PDF versão família no Supabase Storage
  storage_path_technical text,   -- caminho do PDF versão técnica
  metadata        jsonb NOT NULL DEFAULT '{}',  -- snapshot dos dados usados na geração
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_child ON evolution_reports(child_id);
CREATE INDEX idx_reports_therapist ON evolution_reports(therapist_id);
```

### RLS

```sql
-- Marcos: terapeuta lê/escreve os próprios; pais leem os visíveis
ALTER TABLE therapeutic_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_own_milestones" ON therapeutic_milestones
  FOR ALL TO authenticated USING (therapist_id = auth.uid());

CREATE POLICY "parents_read_shared_milestones" ON therapeutic_milestones
  FOR SELECT TO authenticated
  USING (
    is_shared_with_parents = true
    AND EXISTS (
      SELECT 1 FROM children
      WHERE children.id = therapeutic_milestones.child_id
        AND children.user_id = auth.uid()
    )
  );

-- Metas e tentativas: apenas o terapeuta
ALTER TABLE session_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "therapist_own_goals" ON session_goals
  FOR ALL TO authenticated USING (therapist_id = auth.uid());

ALTER TABLE session_goal_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "therapist_own_attempts" ON session_goal_attempts
  FOR ALL TO authenticated USING (therapist_id = auth.uid());

-- Relatórios: terapeuta lê os próprios; pais leem relatórios tipo family
ALTER TABLE evolution_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "therapist_own_reports" ON evolution_reports
  FOR ALL TO authenticated USING (therapist_id = auth.uid());

CREATE POLICY "parents_read_family_reports" ON evolution_reports
  FOR SELECT TO authenticated
  USING (
    report_type IN ('family','both')
    AND EXISTS (
      SELECT 1 FROM children
      WHERE children.id = evolution_reports.child_id
        AND children.user_id = auth.uid()
    )
  );
```

---

## Geração do PDF

O PDF é gerado server-side via Edge Function do Supabase ou ServerFn do TanStack, usando `@react-pdf/renderer` (compatível com Node 20+). A geração acontece em background — o terapeuta clica em "Gerar relatório", o sistema processa e notifica quando está pronto. O arquivo é salvo no Supabase Storage e o link fica disponível no app.

**Fluxo de geração:**
1. Terapeuta seleciona período, versão e seções a incluir
2. Sistema coleta os dados: marcos, metas, tentativas, registros, instruções para família
3. Compila o `metadata` jsonb com o snapshot dos dados (para auditoria)
4. Renderiza o PDF com `@react-pdf/renderer`
5. Salva no Storage em `/reports/{therapist_id}/{child_id}/{uuid}.pdf`
6. Cria o registro em `evolution_reports`
7. Notifica o terapeuta que o relatório está pronto

**Compartilhamento do relatório:**
- Versão família: o terapeuta pode enviar diretamente para os pais pelo app (eles acessam na seção de documentos da criança) ou gerar um link OTP para download externo (médico, escola)
- Versão técnica: fica disponível apenas para o terapeuta no app

---

## Rotas novas

| Rota | Tipo | Descrição |
|---|---|---|
| `/paciente/:id/marcos` | Nova | Lista de marcos por área, com status |
| `/paciente/:id/marcos/novo` | Nova | Formulário de criação de marco |
| `/paciente/:id/marcos/:marcoId` | Nova | Detalhe do marco com histórico de metas vinculadas |
| `/paciente/:id/metas` | Nova | Lista de metas de sessão ativas |
| `/paciente/:id/evolucao` | Nova | Visão de evolução do paciente (terapeuta) |
| `/paciente/:id/relatorio` | Nova | Configuração e geração de relatório |
| `/crianca/:id/evolucao` | Nova | Visão de evolução (pais) |
| `/conquista/:marcoId` | Nova | Tela de celebração de marco atingido |

---

## Checklist de implementação

- [ ] Migration: `therapeutic_milestones` + RLS
- [ ] Migration: `session_goals` + `session_goal_milestones` + RLS
- [ ] Migration: `session_goal_attempts` + RLS
- [ ] Migration: `evolution_reports` + RLS
- [ ] ServerFn: criar/editar/marcar marco como atingido
- [ ] ServerFn: criar/editar metas de sessão
- [ ] ServerFn: registrar tentativa por sessão
- [ ] ServerFn: gerar relatório (coleta de dados + disparo de geração)
- [ ] Edge Function ou ServerFn: renderizar PDF com @react-pdf/renderer
- [ ] Notificação push/in-app de marco atingido para os pais
- [ ] Tela de celebração de conquista
- [ ] Tela de lista de marcos por área (terapeuta)
- [ ] Tela de detalhe do marco com histórico
- [ ] Tela de metas de sessão
- [ ] Visão de evolução do paciente (terapeuta)
- [ ] Visão de evolução da criança (pais)
- [ ] Tela de configuração e geração de relatório
- [ ] Integração de metas no plano pré-sessão e registro pós-sessão
- [ ] Compartilhamento do relatório família pelos pais via OTP
