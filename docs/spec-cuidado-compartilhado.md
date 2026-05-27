# Spec — Módulo de Cuidado Compartilhado

**Versão:** 1.0  
**Data:** 2026-05-25  
**Status:** Proposta / Em revisão

---

## 1. Visão geral

O módulo de Cuidado Compartilhado permite que o responsável principal (owner) de uma criança cadastrada no TEAmo convide outro adulto — geralmente o outro pai, mãe ou tutor legal — para ter acesso completo de visualização e edição ao perfil dessa criança.

O acesso é persistente (não expira por tempo), por criança (cada filho pode ter co-cuidadores diferentes), e somente o owner pode conceder ou revogar esse acesso. O co-cuidador não pode adicionar outros co-cuidadores nem revogar acesso de ninguém.

O fluxo de convite foi desenhado com uma camada dupla de segurança: o link de convite trafega por um canal (email do co-cuidador) e a aprovação final trafega por outro canal separado (notificação ao owner). Os dois precisam convergir para que o acesso seja liberado, evitando que um link interceptado seja suficiente para expor dados da criança.

---

## 2. Papéis e permissões

### Owner
- Único papel com acesso à tela de gerenciamento de co-cuidadores
- Pode convidar, cancelar convites pendentes, reenviar convites e revogar acesso de co-cuidadores ativos
- Pode confirmar ou negar a aprovação final quando um co-cuidador aceitar o convite
- Pode editar e deletar o perfil da criança
- Ao deletar a conta, todos os dados da criança e vínculos de co-cuidadores são excluídos permanentemente

### Co-cuidador
- Acesso completo de leitura e edição a todos os módulos da criança: Registros, Documentos, Agenda, Profissionais e Compartilhamento OTP
- Não acessa a tela de gerenciamento de co-cuidadores
- Não pode convidar novos co-cuidadores
- Não pode revogar o acesso de ninguém
- Não pode deletar o perfil da criança
- Pode criar links OTP de compartilhamento com profissionais externos

---

## 3. Modelo de dados

### Tabela `child_caregivers`

```sql
child_caregivers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  role            text NOT NULL DEFAULT 'co-caregiver'
                  CHECK (role IN ('owner', 'co-caregiver')),
  invited_by      uuid NOT NULL REFERENCES profiles(id),
  invite_token    text UNIQUE,         -- hash SHA-256 do token, nunca o token raw
  invite_email    text NOT NULL,       -- email para o qual o convite foi enviado
  invite_name     text NOT NULL,       -- nome informado pelo owner no convite
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN (
                    'pending',              -- convite enviado, aguardando aceite
                    'awaiting_approval',    -- co-cuidador aceitou, aguardando owner confirmar
                    'active',               -- owner confirmou, acesso liberado
                    'revoked',              -- owner revogou após ativo
                    'denied',               -- owner negou na etapa de aprovação
                    'cancelled',            -- owner cancelou convite pendente
                    'expired'               -- convite não foi aceito dentro de 48h
                  )),
  invite_message  text,                -- mensagem pessoal opcional do owner
  accepted_at     timestamptz,         -- quando o co-cuidador clicou em aceitar
  approved_at     timestamptz,         -- quando o owner confirmou
  invite_expires_at timestamptz,       -- data de expiração do link (now() + 48h)
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (child_id, invite_email)
)
```

### RLS — padrão atualizado

Todas as tabelas filhas de `children` (attendance_records, record_attachments, child_attachments, professionals, shares, agenda_events) precisam ter suas políticas RLS atualizadas para checar também a tabela `child_caregivers`:

```sql
-- Exemplo para attendance_records
CREATE POLICY "cuidadores ativos podem acessar registros"
ON attendance_records
FOR ALL TO authenticated
USING (
  -- owner direto da criança
  EXISTS (
    SELECT 1 FROM children
    WHERE children.id = attendance_records.child_id
      AND children.user_id = auth.uid()
  )
  OR
  -- co-cuidador ativo
  EXISTS (
    SELECT 1 FROM child_caregivers
    WHERE child_caregivers.child_id = attendance_records.child_id
      AND child_caregivers.user_id = auth.uid()
      AND child_caregivers.status = 'active'
  )
);
```

Este padrão deve ser replicado para todas as tabelas dependentes de child_id.

---

## 4. Telas — Jornada do Owner

---

### TELA 1 — Dashboard (modificação existente)

**Rota:** `/dashboard`  
**Tipo:** Modificação de componente existente (card da criança)

Dentro de cada card de criança no dashboard, adicionar um atalho "Cuidado compartilhado" no mesmo nível dos atalhos já existentes (Registros, Documentos, Agenda).

**Comportamento do atalho:**
- Se não houver co-cuidadores: ícone de pessoas + label "Cuidado compartilhado"
- Se houver co-cuidadores ativos: exibir badge numérico com o total (ex: "2"). O badge conta apenas vínculos com `status = 'active'`, não pendentes.

**Ação ao clicar:** Navegar para `/crianca/[id]/co-cuidadores`

---

### TELA 2 — Gerenciar Co-cuidadores

**Rota:** `/crianca/[id]/co-cuidadores`  
**Acesso:** Exclusivo do owner. Co-cuidadores que tentarem acessar esta rota recebem redirecionamento para o dashboard.  
**Tipo:** Tela completa nova

#### Layout

Header com breadcrumb: `Dashboard > [Nome da criança] > Cuidado compartilhado`

Título: "Cuidado compartilhado — [Nome da criança]"  
Subtítulo: "Gerencie quem pode visualizar e editar as informações de [Nome]."

Botão primário no topo direito: "Convidar co-cuidador"

#### Seção: Lista de vínculos

Exibe todos os vínculos com status diferente de `cancelled` e `expired`, agrupados em duas sublistas:

**Sublista 1 — Ativos**
Cada item exibe:
- Avatar com inicial do nome (ou foto do perfil se disponível)
- Nome completo
- E-mail
- Label de status: "Ativo" (verde)
- Data desde quando tem acesso: "Co-cuidador desde [data]"
- Botão de ação: "Revogar acesso" (vermelho, destrutivo)

**Sublista 2 — Aguardando**
Inclui status `pending` e `awaiting_approval`.

Para `pending`:
- Ícone de relógio
- Nome e e-mail informados no convite
- Label: "Aguardando aceite"
- Data de expiração: "Expira em [data] às [hora]"
- Ações: "Reenviar convite" | "Cancelar convite"

Para `awaiting_approval`:
- Ícone de escudo / verificação
- Nome e e-mail da pessoa que aceitou
- Label: "Aguardando sua aprovação" (amarelo/laranja, destacado)
- Texto: "Esta pessoa aceitou seu convite. Confirme os dados e aprove o acesso."
- Botão primário: "Revisar e aprovar"
- Botão secundário: "Negar acesso"

**Estado vazio (nenhum vínculo):**
Ilustração simples, texto: "Ninguém ainda compartilha o cuidado de [Nome]. Convide alguém de confiança para ajudar a acompanhar o desenvolvimento." Botão: "Convidar co-cuidador"

---

### TELA 3 — Drawer de Convite

**Componente:** Drawer lateral (slide da direita)  
**Acionado por:** Botão "Convidar co-cuidador" na Tela 2  
**Tipo:** Componente novo

#### Cabeçalho do drawer
Título: "Convidar co-cuidador"  
Subtítulo: "O convite será enviado por e-mail e ficará válido por 48 horas."

#### Campos

**Campo 1 — E-mail**
- Label: "E-mail do co-cuidador"
- Tipo: input email
- Obrigatório: sim
- Placeholder: "email@exemplo.com"
- Validações em tempo real:
  - Formato de e-mail inválido → "Digite um e-mail válido"
  - E-mail igual ao do próprio owner → "Você não pode se convidar"
  - E-mail já tem vínculo ativo nessa criança → "Este e-mail já tem acesso a [Nome da criança]"
  - E-mail já tem convite pendente nessa criança → "Já existe um convite pendente para este e-mail. Deseja cancelar o anterior e enviar um novo?" com botões [Cancelar] e [Sim, substituir]

**Campo 2 — Nome**
- Label: "Nome do co-cuidador"
- Tipo: input text
- Obrigatório: sim
- Placeholder: "Como você chama essa pessoa?"
- Uso: aparece no email de convite e na lista de vínculos antes de o usuário aceitar (quando ainda não há conta vinculada)
- Validação: mínimo 2 caracteres

**Campo 3 — Mensagem pessoal**
- Label: "Mensagem (opcional)"
- Tipo: textarea
- Obrigatório: não
- Placeholder: "Escreva algo para personalizar o convite..."
- Máximo: 200 caracteres
- Contador de caracteres visível abaixo do campo

**Bloco informativo (não editável)**
- Label: "Acesso concedido a"
- Valor: card com foto e nome da criança
- Texto explicativo: "Ao aceitar, [nome digitado] poderá ver e editar todos os registros, documentos, agenda e profissionais de [Nome da criança]."

**Aviso de segurança (destaque visual, não bloqueante)**
"Apenas você poderá aprovar ou revogar este acesso. O convite só será ativado após sua confirmação."

#### Rodapé do drawer

Botão primário: "Enviar convite" — desabilitado até e-mail e nome serem válidos  
Botão secundário: "Cancelar" — fecha o drawer sem ação

#### Estados do botão enviar
- Idle: "Enviar convite"
- Loading: "Enviando..." com spinner
- Sucesso: drawer fecha, toast na tela de fundo
- Erro: mensagem inline abaixo do botão "Não foi possível enviar o convite. Tente novamente."

---

### TELA 4 — Confirmação de Revogação (inline)

**Componente:** Expansão inline na linha do co-cuidador ativo na Tela 2  
**Acionado por:** Botão "Revogar acesso"  
**Tipo:** Componente inline, sem modal

Ao clicar em "Revogar acesso", a linha do co-cuidador expande para baixo exibindo:

Texto: "Tem certeza? **[Nome]** perderá acesso imediatamente a todos os dados de **[Criança]**. Você pode convidá-lo novamente no futuro se necessário."

Botões na linha:
- "Cancelar" — recolhe o painel, sem ação
- "Sim, revogar acesso" — vermelho, executa a revogação

**Após confirmar:**
- A linha some da lista com animação de fade
- Toast: "Acesso de [Nome] revogado com sucesso."
- O efeito é imediato via RLS — próxima requisição do co-cuidador já será bloqueada

---

### TELA 5 — Revisão de Aprovação

**Rota:** `/crianca/[id]/co-cuidadores/aprovar/[vinculo-id]`  
**Acesso:** Exclusivo do owner  
**Acionada por:** Botão "Revisar e aprovar" na Tela 2, ou link na notificação enviada ao owner  
**Tipo:** Tela completa nova (ou modal fullscreen no mobile)

Esta é a tela de maior importância de segurança no fluxo. O owner visualiza os dados reais com que a pessoa se cadastrou ou logou — nome e e-mail da conta TEAmo — para confirmar se é quem ele esperava.

#### Conteúdo

Título: "Confirmar acesso ao perfil de [Nome da criança]"

**Bloco: Dados de quem aceitou o convite**
- Avatar / inicial
- Nome completo da conta TEAmo
- E-mail da conta TEAmo
- Data e hora em que clicou em aceitar

**Bloco: Dados do convite original**
- E-mail para o qual o convite foi enviado
- Nome informado pelo owner no momento do convite
- Data em que o convite foi enviado
- Mensagem pessoal (se houver)

**Checagem de consistência visual:**
Se o e-mail da conta bate com o e-mail do convite → indicador verde "E-mail confere"  
Se não bate (pessoa usou outro e-mail para criar conta) → alerta amarelo "Atenção: o e-mail usado no cadastro é diferente do e-mail para o qual você enviou o convite. Verifique se é a pessoa certa antes de aprovar."

**Aviso:**
"Ao aprovar, [Nome da conta] terá acesso completo a todos os dados de [Criança]. Você pode revogar este acesso a qualquer momento."

#### Ações

Botão primário: "Aprovar acesso"  
Botão secundário destrutivo: "Negar acesso"

**Ao aprovar:**
- Status muda para `active`
- Co-cuidador recebe notificação/email: "Seu acesso ao perfil de [Criança] foi aprovado."
- Owner é redirecionado de volta para a Tela 2 com toast "Acesso aprovado. [Nome] agora pode acessar o perfil de [Criança]."

**Ao negar:**
- Status muda para `denied`
- Co-cuidador não recebe notificação (não expõe o motivo)
- Owner é redirecionado de volta para a Tela 2 com toast "Acesso negado. [Nome] não terá acesso ao perfil de [Criança]."

---

### NOTIFICAÇÃO AO OWNER — Aprovação pendente

**Canal:** In-app (sino de notificações) + e-mail separado  
**Disparada quando:** Co-cuidador completa o passo 4 do fluxo (aceite autenticado)

**In-app:**
Título: "Nova solicitação de acesso"  
Corpo: "[Nome da conta] aceitou seu convite para acessar o perfil de [Criança]. Revise os dados e confirme."  
Ação ao clicar: Navega para Tela 5

**E-mail ao owner (separado do email de convite):**
Assunto: "Alguém aceitou seu convite no TEAmo — confirmação necessária"  
Corpo: Nome e e-mail de quem aceitou, nome da criança, botão "Revisar e aprovar", texto explicativo de que o acesso só é liberado após a confirmação, link alternativo para acessar pelo app.

---

## 5. Telas — Jornada do Co-cuidador

---

### TELA 6 — E-mail de Convite

**Canal:** E-mail transacional enviado para `invite_email`  
**Assunto:** "[Nome do owner] convidou você para cuidar de [Nome da criança] no TEAmo"

**Corpo do e-mail:**
- Saudação: "Olá, [invite_name]!"
- Parágrafo de contexto: "[Nome do owner] quer compartilhar com você o cuidado de [Nome da criança] no TEAmo."
- Mensagem pessoal do owner (se preenchida), em destaque visual, entre aspas
- Descrição de 1 frase do TEAmo: "O TEAmo é um app para coordenar o cuidado de crianças com TEA — registros, documentos, agenda e profissionais em um único lugar."
- Botão CTA: "Aceitar convite"
- Aviso abaixo do botão: "Este link expira em 48 horas. Após aceitar, o responsável ainda precisará confirmar seu acesso."
- Rodapé: "Se você não esperava este convite, pode ignorar este e-mail com segurança."

**O e-mail NÃO contém:** nenhum código de verificação, nenhuma senha, nenhuma instrução além do link. O link é o único canal desta etapa.

---

### TELA 7 — Página de Contexto do Convite (pré-login)

**Rota:** `/aceitar-convite?token=[token]`  
**Acesso:** Pública (sem autenticação)  
**Tipo:** Tela nova, layout minimal, sem o shell da aplicação

Esta tela existe para que o co-cuidador entenda o convite antes de criar conta ou logar. É a primeira impressão do TEAmo para quem ainda não tem conta.

#### Conteúdo

Logo do TEAmo centralizado no topo.

**Bloco do convite:**
- Avatar e nome do owner
- Texto: "[Owner] quer compartilhar o cuidado de:"
- Card da criança: foto (se houver), nome, data de nascimento
- Lista simples do que o acesso envolve: "Você poderá ver e editar registros de atendimento, documentos clínicos, agenda de compromissos e rede de profissionais."

**Aviso de segurança em destaque:**
"Após aceitar, o responsável ainda precisará confirmar seu acesso antes de você visualizar qualquer dado."

**Informação de expiração:**
"Este convite expira em [data e hora]."

#### Estados de erro desta tela

**Token expirado:**
Ícone de relógio. Título: "Este convite expirou." Texto: "O link ficou válido por 48 horas a partir do envio. Peça ao responsável que envie um novo convite." Sem botão de ação (a iniciativa é do owner).

**Token inválido ou adulterado:**
Ícone de escudo. Título: "Link inválido." Texto: "Este link de convite não é válido. Verifique se você copiou o link corretamente ou peça um novo convite." Sem botão de ação.

**Token já usado (acesso ativo):**
Ícone de check. Título: "Convite já utilizado." Texto: "Este convite já foi aceito. Se você já tem acesso, faça login normalmente." Botão: "Ir para o login"

**Token já usado (acesso negado ou revogado):**
Ícone neutro. Título: "Este convite não está mais disponível." Texto: "Entre em contato com o responsável para mais informações." (Não expõe se foi negado ou revogado.)

#### Ações (quando token válido)

Dois botões bem distintos:

Botão primário: "Já tenho conta — fazer login"  
Botão secundário: "Criar conta no TEAmo"

Ambos preservam o token na navegação.

---

### TELA 8 — Login com contexto de convite

**Rota:** `/login?invite_token=[token]`  
**Tipo:** Modificação da tela de login existente

A tela de login existente recebe um banner contextual no topo quando há um `invite_token` na URL:

**Banner:**
Fundo azul claro, ícone de pessoas.  
Texto: "Você está aceitando um convite para compartilhar um cuidado no TEAmo. Faça login para continuar."

O restante do formulário de login permanece idêntico ao atual.

**Após login bem-sucedido:**
Redireciona para Tela 10 (Confirmação de aceite autenticada), não para o dashboard.

**Se o token expirar enquanto o usuário estava na tela de login:**
Após login, ao tentar acessar a Tela 10, exibe o estado de erro de token expirado.

---

### TELA 9 — Cadastro simplificado com contexto de convite

**Rota:** `/cadastro?invite_token=[token]`  
**Tipo:** Modificação do fluxo de cadastro existente

A tela de cadastro existente recebe o mesmo banner contextual da Tela 8.

**Diferenças em relação ao cadastro normal:**

O campo de e-mail é pré-preenchido com o `invite_email` e fica somente leitura com uma nota: "Este é o e-mail para o qual o convite foi enviado." Se o usuário quiser usar outro e-mail, há um link "Usar um e-mail diferente" que remove a restrição (mas isso ficará visível para o owner na Tela 5).

**Campos do cadastro:**
- Nome completo (obrigatório)
- E-mail (pré-preenchido, editável conforme descrito)
- Senha (obrigatório, regras padrão do sistema)
- Confirmar senha (obrigatório)

**O que é removido do fluxo normal:**
- Após a verificação de e-mail, o redirecionamento vai para a Tela 10 (confirmação de aceite), não para o onboarding de criança. O sistema identifica que há um `invite_token` pendente e pula o onboarding.

**Verificação de e-mail:**
Fluxo normal. Após confirmar o e-mail, o token do convite é associado à sessão e o usuário vai para a Tela 10.

---

### TELA 10 — Confirmação de Aceite (autenticado)

**Rota:** `/aceitar-convite/confirmar?token=[token]`  
**Acesso:** Requer autenticação  
**Tipo:** Tela nova

Esta é a tela onde o co-cuidador, agora autenticado, faz a confirmação formal do aceite. É a última ação do co-cuidador no fluxo — após isso, ele entra em espera.

#### Conteúdo

Título: "Você está prestes a acessar o perfil de [Nome da criança]"

**Bloco de detalhes do convite:**
- Foto/avatar e nome do owner
- Nome e foto da criança
- Lista do que estará acessível (igual à Tela 7)

**Bloco de consentimento LGPD:**
Checkbox obrigatório: "Entendo que terei acesso a dados de saúde de uma criança, que este acesso pode ser revogado a qualquer momento pelo responsável, e que devo tratar estas informações com sigilo."

O botão principal fica desabilitado até o checkbox ser marcado.

#### Ações

Botão primário: "Aceitar e aguardar aprovação" — desabilitado sem checkbox marcado  
Botão secundário: "Recusar convite"

**Ao clicar em "Aceitar e aguardar aprovação":**
- Status do vínculo muda para `awaiting_approval`
- Owner recebe notificação (in-app + e-mail, conforme seção de notificações)
- Co-cuidador é redirecionado para a Tela 11

**Ao clicar em "Recusar convite":**
Expansão inline de confirmação: "Tem certeza que deseja recusar? O convite será cancelado e você precisará de um novo para acessar." Botões: "Voltar" e "Sim, recusar". Se confirmar, status muda para `denied` (ou estado equivalente), usuário é redirecionado para o dashboard vazio (se não tiver filhos próprios) ou para o dashboard normal.

---

### TELA 11 — Aguardando Aprovação

**Rota:** `/aguardando-aprovacao`  
**Acesso:** Requer autenticação  
**Tipo:** Tela nova, estado transitório

Exibida imediatamente após o co-cuidador aceitar, enquanto aguarda a confirmação do owner.

#### Conteúdo

Ícone animado de espera (relógio ou loading sutil).

Título: "Quase lá!"

Texto: "Seu aceite foi registrado. Agora **[Nome do owner]** precisa confirmar seu acesso. Você receberá um e-mail assim que for aprovado."

Informação adicional: "Isso normalmente acontece em poucas horas. Você pode fechar este app e aguardar."

**Botão:** "Ir para o início" — leva ao dashboard, onde a criança ainda não aparece (acesso não ativo)

#### Se o owner aprovar enquanto o co-cuidador está nesta tela

Atualização em tempo real (via Supabase Realtime): a tela muda automaticamente para uma tela de sucesso com confetes ou animação positiva e mensagem "Seu acesso foi aprovado! Bem-vindo ao cuidado de [Nome da criança]." Botão "Acessar agora".

#### Se o owner negar enquanto o co-cuidador está nesta tela

Atualização silenciosa: a tela muda para estado neutro: "Não foi possível concluir o acesso. Entre em contato com [Owner] para mais informações." Sem exposição da negação explícita.

---

### TELA 12 — Dashboard (modificação existente para co-cuidador)

**Rota:** `/dashboard`  
**Tipo:** Modificação do componente de listagem de crianças

Quando o co-cuidador tem acesso ativo a uma criança compartilhada, ela aparece no dashboard junto com as crianças próprias (se houver), com os seguintes diferenciais visuais:

- Badge: "Cuidado compartilhado" no card
- Ícone de dois avatares no canto do card
- Ao abrir o perfil da criança: header com "Responsável principal: [Nome do owner]"

**O que o co-cuidador NÃO vê:**
- A aba/atalho "Cuidado compartilhado" no card (essa entrada fica visível apenas para o owner)
- Qualquer informação sobre outros co-cuidadores

---

### TELA 13 — Estado de Acesso Revogado (experiência em tempo real)

**Tipo:** Estado de erro contextual, não uma tela dedicada

**Cenário A — Co-cuidador está ativo na tela da criança no momento da revogação:**
Na próxima ação que fizer (clique, navegação, submit de formulário), a requisição retorna 403. A UI exibe um banner de aviso não bloqueante: "Você não tem mais acesso a este perfil. O responsável encerrou o compartilhamento. Em caso de dúvida, entre em contato diretamente com [Nome do owner]." Botão: "Voltar ao início". Não há redirecionamento automático — o usuário escolhe quando sair.

**Cenário B — Co-cuidador faz login após ter sido revogado:**
A criança simplesmente não aparece no dashboard. Nenhuma mensagem de erro ou explicação. Se o co-cuidador não tiver filhos próprios, vê o estado vazio do dashboard com a CTA de cadastrar uma criança. Não há referência ao acesso anterior.

---

## 6. Notificações do sistema

### Para o owner

| Evento | Canal | Conteúdo |
|---|---|---|
| Co-cuidador aceita o convite | In-app + e-mail | Nome e e-mail de quem aceitou, nome da criança, botão "Revisar e aprovar" |
| Convite expirou sem aceite | In-app | "[Nome/email] não aceitou o convite para [Criança] a tempo. Você pode reenviar se quiser." |

### Para o co-cuidador

| Evento | Canal | Conteúdo |
|---|---|---|
| Owner aprova o acesso | E-mail + in-app (se logado) | "Seu acesso ao perfil de [Criança] foi aprovado. Acesse agora." |
| (Sem notificação de negação) | — | Silêncio intencional para proteger o co-cuidador |

---

## 7. Sequência completa do fluxo

```
[OWNER]
  1. Acessa /crianca/[id]/co-cuidadores
  2. Clica em "Convidar co-cuidador"
  3. Preenche e-mail, nome, mensagem opcional
  4. Clica em "Enviar convite"
     → Sistema cria vínculo status=pending, gera token, envia e-mail

[CO-CUIDADOR]
  5. Recebe e-mail com link
  6. Clica no link → /aceitar-convite?token=xxx
  7. Vê Tela 7 (contexto do convite, pré-login)
  8a. Se tem conta → vai para /login?invite_token=xxx → faz login → Tela 10
  8b. Se não tem conta → vai para /cadastro?invite_token=xxx → cria conta
      → verifica e-mail → Tela 10
  9. Na Tela 10: marca checkbox LGPD, clica em "Aceitar e aguardar aprovação"
     → Sistema muda status para awaiting_approval
     → Co-cuidador vai para Tela 11 (aguardando)
     → Sistema envia notificação ao owner (in-app + e-mail separado)

[OWNER]
  10. Recebe notificação "Nova solicitação de acesso"
  11. Acessa Tela 5 (/crianca/[id]/co-cuidadores/aprovar/[id])
  12. Revisa nome e e-mail de quem aceitou
  13a. Clica "Aprovar acesso" → status=active → co-cuidador recebe notificação
  13b. Clica "Negar acesso" → status=denied → co-cuidador não recebe notificação

[CO-CUIDADOR — se aprovado]
  14. Recebe e-mail/notificação de aprovação
  15. Acessa /dashboard → vê criança com badge "Cuidado compartilhado"
  16. Acessa todos os módulos normalmente
```

---

## 8. Considerações técnicas para implementação

**Flag no cadastro via convite:** O fluxo de cadastro existente assume que todo usuário novo passa pelo onboarding de criança. Quando `invite_token` está presente na URL, o sistema deve setar uma flag na sessão para pular esse passo. Sugestão: verificar `invite_token` no `_auth.tsx` (guard) e redirecionar para a Tela 10 em vez do onboarding.

**Realtime na Tela 11:** O estado de "aguardando aprovação" precisa de uma subscription Supabase Realtime no canal da tabela `child_caregivers`, filtrando pelo `id` do vínculo, para detectar mudança de status e atualizar a UI sem necessidade de polling ou refresh manual.

**Token de convite:** Nunca armazenar o token raw no banco. Salvar apenas o hash SHA-256. O token raw vai no link do e-mail. Na validação, hashar o token recebido e comparar com o banco.

**Expiração de convites:** Um job agendado (ou trigger via Supabase Edge Function) deve atualizar vínculos com `status=pending` e `invite_expires_at < now()` para `status=expired` periodicamente. Alternativamente, checar a expiração na query de validação do token e retornar o erro correspondente.

**Propagação de RLS:** Este é o ponto de maior risco de regressão. Antes de implementar, fazer um inventário de todas as políticas RLS existentes que filtram por `user_id` nas tabelas filhas de `children`. Cada uma precisa ser atualizada ou complementada com a checagem em `child_caregivers`. Recomenda-se criar uma função Postgres reutilizável:

```sql
CREATE OR REPLACE FUNCTION is_child_caregiver(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM child_caregivers
    WHERE child_id = p_child_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;
```

E usar `is_child_caregiver(child_id)` nas políticas para simplificar e centralizar a lógica.

---

## 9. Rotas novas e modificadas

| Rota | Tipo | Descrição |
|---|---|---|
| `/crianca/[id]/co-cuidadores` | Nova | Tela 2 — gerenciamento (owner) |
| `/crianca/[id]/co-cuidadores/aprovar/[vinculo-id]` | Nova | Tela 5 — revisão de aprovação (owner) |
| `/aceitar-convite` | Nova | Tela 7 — contexto pré-login (pública) |
| `/aceitar-convite/confirmar` | Nova | Tela 10 — confirmação autenticada |
| `/aguardando-aprovacao` | Nova | Tela 11 — estado de espera |
| `/login` | Modificação | Banner contextual quando invite_token presente |
| `/cadastro` | Modificação | Banner + e-mail pré-preenchido + pular onboarding |
| `/dashboard` | Modificação | Badge no atalho + diferencial visual na criança compartilhada |

---

## 10. Resumo de componentes novos

- `CoCaregiversPage` — Tela 2
- `InviteDrawer` — Drawer de convite (Tela 3)
- `RevokeConfirmInline` — Confirmação inline de revogação
- `ApprovalReviewPage` — Tela 5
- `AcceptInviteLandingPage` — Tela 7 (pública)
- `AcceptInviteConfirmPage` — Tela 10
- `AwaitingApprovalPage` — Tela 11
- `SharedChildBadge` — Badge no card do dashboard
- `InviteContextBanner` — Banner nos formulários de login e cadastro
