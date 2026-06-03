# TEAmo — Fluxos e Cenários de Uso

**Versão:** 1.0
**Status:** Referência de produto

---

## Conceitos Gerais

### A criança é o centro

Todo o TEAmo orbita em torno do perfil da criança. Não importa quem a cadastrou, não importa quem está acessando — a criança é o objeto central do sistema. Pais, terapeutas e outros profissionais são sempre vistos em relação a ela. Isso significa que uma mesma criança pode ser cadastrada por um terapeuta e posteriormente reconhecida pelos pais como a mesma criança já existente no app — e o sistema unifica tudo.

---

### Os dois perfis de usuário

**Pais / Responsáveis** são os donos dos dados. Independente de como entraram no sistema — seja por conta própria ou convidados por um terapeuta — eles têm a palavra final sobre quem faz parte da equipe de cuidado, quem pode ver o quê e quem recebe compartilhamentos. Eles são o elo entre todos os profissionais envolvidos.

**Profissionais / Terapeutas** são os gestores clínicos. Quando pagantes, têm acesso a um módulo completo de gestão de pacientes — agenda, registros estruturados, documentos, equipe de cuidado. Quando não pagantes (convidados por pais), têm acesso limitado: podem enviar observações simples e receber documentos compartilhados diretamente pelos pais.

---

### Os dois caminhos de entrada

**Caminho 1 — Entrada pelos pais:** os pais criam a conta, cadastram a criança e constroem a equipe de cuidado convidando profissionais. Os pais têm controle total desde o início.

**Caminho 2 — Entrada pelo terapeuta:** o terapeuta cria a conta, cadastra o paciente com informações básicas e convida os pais. O terapeuta não pode inserir dados clínicos até que os pais entrem e aceitem. Assim que os pais aceitam, o terapeuta desbloqueia o acesso completo ao módulo de gestão. Os pais, ao entrar, assumem a posição de donos dos dados.

Os dois caminhos convergem no mesmo perfil da criança, com as mesmas camadas de permissão. O ponto de chegada é idêntico — só o ponto de partida muda.

---

### Equipe de cuidado

A equipe de cuidado é o conjunto de pessoas com acesso ao perfil de uma criança. Ela tem uma hierarquia clara:

- **Pais / Responsáveis** — donos dos dados. Autorizam entradas, compartilhamentos e permissões.
- **Terapeuta principal** — gestor clínico com acesso completo (quando pago). Pode convidar outros profissionais, mas sujeito à aprovação dos pais.
- **Profissionais secundários** — entram por convite do terapeuta principal, mas só com autorização explícita dos pais. Têm acesso a observações e compartilhamentos diretos.
- **Co-cuidadores** — outros familiares ou responsáveis adicionados pelos pais. Têm acesso completo equivalente ao dos pais.

---

### Tipos de registro

Há três tipos de conteúdo no sistema:

**Registros compartilhados** — criados pelo terapeuta principal (pago), visíveis para os pais e para toda a equipe de cuidado autorizada. É onde o terapeuta documenta o que foi trabalhado na sessão, a evolução, as orientações para casa.

**Registros privados** — criados pelo terapeuta principal (pago), visíveis apenas para ele. Serve para anotações clínicas internas, hipóteses em aberto, raciocínio clínico que ainda não é para compartilhar com a família.

**Observações simples** — campo de texto livre disponível para pais e profissionais sem plano pago. São visíveis para o terapeuta e para os pais. Ficam numa área própria, separada dos registros clínicos, vinculadas ao perfil de quem as enviou dentro do cuidado da criança.

---

### Compartilhamento de documentos

Há duas formas de compartilhar documentos:

**Compartilhamento direto interno** — entre membros já autorizados da equipe de cuidado. Os pais podem enviar documentos diretamente para qualquer profissional da equipe, sem precisar de OTP. O profissional recebe notificação e acessa o documento pelo perfil da criança.

**Compartilhamento via OTP** — para destinatários externos não cadastrados no app (outros médicos, escola, plano de saúde). Gera um link com validade configurável. Não requer conta no TEAmo para acessar.

---

### Modelo de planos

**Gratuito** — acesso ao essencial. Pais visualizam tudo do terapeuta, enviam observações, recebem documentos diretamente. Profissionais convidados por pais enviam observações e recebem documentos diretamente.

**Premium** — acesso completo. Para pais: gestão independente da criança, agenda, registros próprios, co-cuidadores, compartilhamento OTP, convite de profissionais. Para profissionais: módulo completo de gestão de pacientes, agenda, registros estruturados compartilhados e privados, documentos, convite de outros profissionais, relatórios.

**Durante a fase atual:** tudo está liberado gratuitamente. O sistema sinaliza o que seria pago e permite o upgrade por R$0, simulando o fluxo de monetização sem cobrar nada. Isso prepara a infraestrutura de planos para quando a precificação real for ativada.

---

## Fluxos dos Pais

---

### Cenário P1 — Pai cria conta por conta própria

**Situação:** O pai ou responsável descobre o TEAmo por conta própria, sem ter sido convidado por nenhum profissional.

**Jornada:**

O pai acessa o app e se cadastra com email e senha. Confirma o email e passa pelo onboarding, onde cadastra a criança com nome, data de nascimento e informações relevantes como condições e medicações. A partir daí tem acesso completo ao app no plano gratuito.

Com o plano gratuito, o pai pode visualizar e registrar informações básicas. Para acessar funcionalidades completas como agenda própria, registros estruturados, co-cuidadores e compartilhamento OTP, ativa o premium por R$0 (atualmente).

O pai pode convidar profissionais da equipe de cuidado informando o email. O profissional convidado recebe um email de convite, cria sua conta com perfil profissional e aceita o vínculo. A partir daí, o profissional pode enviar observações simples vinculadas ao seu perfil dentro do cuidado da criança, e os pais podem enviar documentos diretamente a ele sem OTP.

**Permissões do pai neste cenário:** dono total. Controla quem entra, o que é compartilhado e todas as configurações da criança.

**Permissões do profissional convidado pelo pai (sem plano pago):** envia observações simples, recebe documentos compartilhados diretamente pelos pais, visualiza o perfil da criança e os registros compartilhados.

---

### Cenário P2 — Pai recebe convite do terapeuta e não tem conta

**Situação:** Um terapeuta já usa o TEAmo, cadastrou a criança como paciente e enviou um convite por email para os pais.

**Jornada:**

O pai recebe o email com o convite do terapeuta. O email deixa claro quem está convidando, para qual criança e o que o TEAmo é. O pai clica no link, é direcionado para a tela de contexto do convite — sem precisar logar ainda — onde vê o nome do terapeuta, a especialidade e o nome da criança.

O pai clica em "Criar conta", passa pelo cadastro simplificado (nome, email, senha) e confirma o email. O onboarding de cadastro de criança é pulado — a criança já existe, criada pelo terapeuta. O pai entra direto na tela de confirmação do aceite, onde vê as informações do terapeuta e o que o acesso envolve. Ao aceitar, assume a posição de dono dos dados da criança.

A partir daí, o pai visualiza tudo que o terapeuta compartilha — registros, documentos, agenda planejada. Pode enviar observações simples ao terapeuta. O app mostra que ele está no plano gratuito e oferece o upgrade por R$0 para acesso completo.

Se o pai ativar o premium, passa a ter acesso independente à criança — pode adicionar co-cuidadores, convidar outros profissionais por conta própria, criar registros próprios e usar o compartilhamento OTP.

**Permissões do pai ao entrar (gratuito):** visualiza tudo do terapeuta, envia observações, recebe documentos compartilhados diretamente.

**Permissões após ativar premium:** tudo acima + gestão independente completa da criança.

---

### Cenário P3 — Pai recebe convite do terapeuta e já tem conta

**Situação:** O pai já usa o TEAmo com o perfil da criança criado por ele mesmo. Um terapeuta quer ingressar na equipe de cuidado.

**Jornada:**

O terapeuta preenche o email do pai ao criar o convite. O sistema detecta que já existe uma conta com aquele email. Em vez de gerar um link de cadastro, dispara uma notificação dentro do app para o pai: "O terapeuta [nome e especialidade] quer ingressar no cuidado de [criança]. Aceitar?"

A notificação aparece no sino de notificações e, se o pai configurou, também por email. O pai revisa nome, especialidade e clica em aceitar ou recusar. Ao aceitar, o terapeuta entra na equipe de cuidado da criança já existente — não é criado um perfil paralelo. O terapeuta passa a ver o histórico já registrado pelo pai.

Se o terapeuta for pago, acessa o módulo completo a partir daquele momento. Se não for, acessa apenas observações e recebimento de documentos.

**Ponto importante:** o pai não perde nenhuma funcionalidade. O terapeuta entra como membro da equipe de cuidado, não como dono. O pai continua com controle total.

---

### Cenário P4 — Pai recebe segundo convite de outro terapeuta para a mesma criança

**Situação:** O pai já tem a criança no app — seja por conta própria ou por ter aceito o convite de um primeiro terapeuta. Chega um convite de outro profissional para a mesma criança.

**Jornada:**

O pai recebe o segundo convite (notificação in-app ou email). Ao abrir, o app identifica que o nome da criança mencionada coincide com uma criança já cadastrada no perfil do pai. Exibe: "Este convite parece ser para [nome da criança], que já está no seu perfil. É a mesma criança?"

Se o pai confirmar, o novo terapeuta é adicionado à equipe de cuidado da mesma criança. Ele passa a ver todo o histórico existente — registros, documentos, observações anteriores — e pode adicionar os próprios registros a partir dali. Os dados do primeiro terapeuta são preservados. Não há duplicação.

Se o pai indicar que é outra criança (irmão, por exemplo), o sistema segue o fluxo normal de novo perfil.

**Resultado:** uma criança, uma equipe de cuidado com múltiplos terapeutas, histórico unificado. Cada terapeuta vê o que os outros registraram no modo compartilhado, o que favorece a coordenação multidisciplinar.

---

## Fluxos dos Profissionais

---

### Cenário T1 — Terapeuta cria conta e cadastra o paciente

**Situação:** Um terapeuta adota o TEAmo como ferramenta de gestão clínica e começa do zero.

**Jornada:**

O terapeuta acessa o app e se cadastra com email e senha, escolhendo o perfil profissional. No onboarding, preenche nome completo, especialidade (fonoaudiólogo, terapeuta ocupacional, psicólogo, ABA, neuropediatra, outro) e número de registro no conselho. Isso é necessário para que os pais conheçam quem está pedindo acesso à criança.

O terapeuta é direcionado ao seu módulo de pacientes — uma lista vazia inicialmente. Cria o primeiro paciente com nome e, opcionalmente, data de nascimento. O perfil é criado, mas uma mensagem deixa claro: "Você poderá inserir registros, documentos e informações clínicas assim que os pais ou responsáveis aceitarem o convite."

O terapeuta envia o convite pelo email dos pais. O app orienta: "Certifique-se de que este é o email real do responsável pela criança. Você é responsável por garantir que o acesso correto foi concedido." O convite fica em status "Aguardando aceite". O terapeuta pode acompanhar o status pelo painel de pacientes.

Assim que os pais aceitam, o terapeuta recebe notificação e o perfil da criança é desbloqueado para input. A partir daí, o terapeuta tem acesso ao módulo completo — agenda, registros compartilhados, registros privados, documentos, gestão da equipe de cuidado.

O terapeuta pode registrar na agenda o que está previsto para a semana — os pais veem essa previsão antes mesmo da sessão acontecer. Durante ou após a sessão, registra o que foi trabalhado, evolução observada e orientações para casa. Pode marcar o registro como compartilhado (visível para os pais e equipe) ou privado (só para ele).

**Plano do terapeuta:** o módulo completo descrito acima é o plano premium. Por ora, disponível por R$0. O app sinaliza o que é premium e permite ativação imediata sem cobrança.

---

### Cenário T2 — Terapeuta recebe convite dos pais (não tem conta)

**Situação:** Os pais já usam o TEAmo e convidaram o terapeuta pelo email.

**Jornada:**

O terapeuta recebe o email de convite com o nome dos pais, o nome da criança e uma breve descrição do TEAmo. Clica no link, é direcionado para a tela de contexto do convite. Clica em "Criar conta", passa pelo cadastro com perfil profissional (nome, especialidade, registro de conselho) e confirma o email.

Após confirmar, vai para a tela de aceite onde vê os detalhes do convite. Ao aceitar, é adicionado à equipe de cuidado da criança. Passa a visualizar o perfil completo da criança, o histórico de registros compartilhados e pode enviar observações simples vinculadas ao seu perfil dentro do cuidado.

O app mostra que ele está no plano gratuito e o que o premium desbloquearia — módulo de gestão completo, agenda, registros estruturados, múltiplos pacientes. Para ativar, R$0 atualmente.

Se o terapeuta ativar o premium, passa a ter acesso ao módulo completo para aquele paciente e pode gerenciar novos pacientes independentemente.

**Observações do terapeuta no plano gratuito:** ficam numa área própria dentro do perfil da criança, identificadas com nome e especialidade do terapeuta. Visíveis para os pais e para o terapeuta. Separadas dos registros clínicos estruturados.

---

### Cenário T3 — Terapeuta convida outro profissional para a equipe de cuidado

**Situação:** O terapeuta principal quer incluir outro profissional na equipe de cuidado de um paciente específico.

**Jornada:**

Dentro do perfil do paciente, o terapeuta acessa a seção de equipe de cuidado e adiciona um novo membro pelo email. O sistema envia uma solicitação para aprovação dos pais: "O terapeuta [nome] quer adicionar [nome/especialidade] ao cuidado de [criança]. Autorizar?"

Os pais recebem a notificação (in-app e email) e decidem. Se aprovarem, o profissional recebe o convite. Se o profissional já tiver conta, é notificado diretamente. Se não tiver, recebe email para criar conta com perfil profissional.

Ao aceitar, o profissional entra na equipe com acesso de observação — pode enviar observações simples e receber documentos compartilhados pelos pais diretamente. Pode visualizar os registros compartilhados do terapeuta principal. Não pode acessar registros privados do terapeuta principal.

Se o profissional secundário ativar o plano premium, acessa o módulo completo para aquele paciente específico — pode criar seus próprios registros estruturados, compartilhados e privados, vinculados à sua especialidade.

**Ponto importante:** os pais sempre recebem notificação quando um novo membro é adicionado à equipe, independente de quem fez o convite.

---

### Cenário T4 — Terapeuta tenta convidar pai que já tem conta

**Situação:** O terapeuta criou o perfil do paciente e preencheu o email do responsável. Esse email já pertence a uma conta ativa no TEAmo.

**Jornada:**

O sistema detecta o email cadastrado e não gera um link de cadastro. Em vez disso, envia uma notificação diretamente para o pai dentro do app: "O terapeuta [nome e especialidade] criou um perfil para [nome da criança] e quer que você acesse como responsável. Aceitar?"

O pai revisa as informações — nome do terapeuta, especialidade, nome da criança no perfil criado pelo terapeuta. Pode aceitar ou recusar.

Se aceitar: o app verifica se já existe uma criança com o mesmo nome no perfil do pai. Se sim, pergunta: "Você já tem [nome da criança] cadastrado. É a mesma criança?" Se o pai confirmar, os perfis são associados — o histórico do pai é preservado, o terapeuta passa a fazer parte da equipe de cuidado da criança já existente. Se o pai indicar que são crianças diferentes, o perfil criado pelo terapeuta é tratado como uma nova criança.

Se recusar: o terapeuta é notificado que o convite foi recusado. Nenhum dado é compartilhado.

---

## O Modelo de Planos na Prática

Atualmente todos os recursos estão liberados gratuitamente. O sistema, porém, já distingue o que é gratuito e o que é premium — sinalizando visualmente na interface. Quando o usuário tenta acessar um recurso premium sem ter o plano ativado, encontra uma tela de upgrade que descreve os benefícios e oferece o botão "Ativar Premium — R$0". Ao confirmar, o plano é registrado no banco como premium sem cobrança.

Esse comportamento existe para dois fins. O primeiro é habituar os usuários ao conceito de planos e ao fluxo de upgrade antes de haver cobrança real. O segundo é preparar a infraestrutura técnica — banco de dados, verificação de plano no backend, travas de feature — para que quando a precificação real for ativada, apenas o valor e a integração com o gateway de pagamento precisem ser ajustados.

**Pais — gratuito:** visualizar registros compartilhados do terapeuta, enviar observações, receber documentos diretamente de membros da equipe.

**Pais — premium:** tudo acima + cadastro independente de criança, agenda própria, registros próprios, co-cuidadores, convite de profissionais, compartilhamento OTP.

**Profissional — gratuito (convidado por pais ou por terapeuta):** enviar observações simples, receber documentos compartilhados diretamente pelos pais, visualizar registros compartilhados.

**Profissional — premium:** tudo acima + módulo completo de gestão de pacientes, agenda, registros estruturados compartilhados e privados, documentos, convite de outros profissionais para a equipe, relatórios de evolução.
