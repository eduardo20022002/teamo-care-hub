// Copy de upsell por contexto (espelha premium-terapeuta.md).
// Usado pelo UpgradeModal e pelo PremiumPreview.
import type { PremiumFeature } from "@/lib/plan-limits";

export interface UpsellCopy {
  title: string;
  body: string;
  /** Bullets do que o Premium desbloqueia (resumo). */
  bullets: string[];
}

export const UPSELL: Record<PremiumFeature, UpsellCopy> = {
  patients: {
    title: "Você atingiu o limite de 2 pacientes do plano gratuito",
    body: "No plano gratuito você acompanha até 2 pacientes. Com o TEAmo Premium, sua prática cresce sem limite de pacientes.",
    bullets: [
      "Pacientes ilimitados",
      "Convidar pais e responsáveis",
      "Recados, marcos e dashboard para a família",
    ],
  },
  invites: {
    title: "Conecte a família ao cuidado",
    body: "Convidar pais e responsáveis é o coração do TEAmo — transforma a agenda clínica em cuidado coordenado. Disponível no Premium.",
    bullets: [
      "Convidar responsáveis por e-mail",
      "Gerenciar vínculos (ativo, pendente, revogar)",
      "Compartilhar marcos, recados e evolução",
    ],
  },
  recados: {
    title: "Fale com a família entre as sessões",
    body: "Envie recados direcionados que aparecem em destaque no portal dos pais. Canal de comunicação assíncrona — disponível no Premium.",
    bullets: [
      "Recados por paciente",
      "Visíveis no portal do responsável",
      "Mais engajamento terapêutico",
    ],
  },
  privacy: {
    title: "Controle o que a família vê",
    body: "No Premium você decide, item a item, o que compartilha com os pais. No plano gratuito todo registro é privado por padrão.",
    bullets: [
      "Toggle visível/oculto por registro",
      "Compartilhamento seletivo com a família",
      "Vínculo ativo com os responsáveis",
    ],
  },
  milestones: {
    title: "Compartilhe conquistas com os pais",
    body: "Os marcos são o coração emocional do produto para as famílias. No Premium você escolhe quais aparecem no portal dos pais, com celebração.",
    bullets: [
      "Marcar marcos visíveis aos pais",
      "Overlay de celebração no portal",
      "Imagem do marco para a família salvar",
    ],
  },
  "goal-link": {
    title: "Vincule objetivos às metas terapêuticas",
    body: "No Premium, cada objetivo do plano da sessão se conecta a uma meta cadastrada — e as tentativas alimentam o histórico da meta automaticamente.",
    bullets: [
      "Vínculo objetivo ↔ meta no pré-sessão",
      "Chip da meta no registro pós-sessão",
      "Histórico de tentativas por meta",
    ],
  },
  continue: {
    title: "Dê continuidade entre as sessões",
    body: "No Premium você marca pontos para retomar e os vincula a uma sessão futura — um lembrete aparece no detalhe da próxima sessão.",
    bullets: [
      "Vincular pontos a uma sessão futura",
      "Lembrete no detalhe da próxima sessão",
      "Continuidade do plano terapêutico",
    ],
  },
  recurring: {
    title: "Crie sessões recorrentes",
    body: "Defina o padrão semanal de atendimento e o TEAmo gera as sessões automaticamente. Essencial para a rotina clínica — disponível no Premium.",
    bullets: [
      "Recorrência semanal automática",
      "Geração das sessões em lote",
      "Menos trabalho manual na agenda",
    ],
  },

  // ── Responsável (free-vs-premium-responsavel.md) ──
  registros: {
    title: "Você usou seus 10 registros gratuitos",
    body: "O plano gratuito inclui até 10 registros do diário. Com o TEAmo Premium, você registra sem limite — comportamentos, conquistas, sono, alimentação e muito mais.",
    bullets: [
      "Registros ilimitados no diário",
      "Documentos ilimitados",
      "Compartilhar com segurança e convidar co-cuidadores",
    ],
  },
  documentos: {
    title: "Limite de documentos atingido",
    body: "O plano gratuito inclui 1 documento. Com o Premium, você guarda todos os laudos, relatórios e anexos em um só lugar — organizado por categoria e sempre à mão.",
    bullets: [
      "Documentos ilimitados",
      "Organização por categoria",
      "Tudo sempre à mão",
    ],
  },
  compartilhamentos: {
    title: "Compartilhe registros com segurança",
    body: "Gere um link com código de acesso e envie para o médico, psicólogo ou escola. O acesso expira automaticamente — sem deixar dados expostos.",
    bullets: [
      "Acesso seguro por código (OTP)",
      "Expira automaticamente",
      "Escolha exatamente o que compartilhar",
    ],
  },
  "cuidado-compartilhado": {
    title: "O cuidado é de todos",
    body: "Convide a avó, a babá ou outro responsável para acompanhar a criança junto com você. Cada co-cuidador tem seu próprio acesso, com o nível de permissão que você define.",
    bullets: [
      "Convidar co-cuidadores",
      "Papéis: admin (edita) ou viewer (só vê)",
      "Cuidado em equipe",
    ],
  },

  // ── Clínica (premium-clinica.md) ──
  "clinica-casos": {
    title: "Você atingiu o limite de 1 caso do plano gratuito",
    body: "No plano gratuito a clínica gerencia 1 caso por vez. Com o TEAmo Clínica Premium, a fila de espera é ilimitada — sem travar o crescimento.",
    bullets: ["Fila de espera ilimitada", "Equipe, agenda e grupos ABA", "Financeiro e comunicação sem limite"],
  },
  "clinica-avaliacoes": {
    title: "Limite de avaliações atingido",
    body: "O plano gratuito inclui 1 avaliação VB-MAPP. Com o Premium, avaliações ilimitadas e o painel completo (em sessão / aguardando relatório / concluídas).",
    bullets: ["Avaliações VB-MAPP ilimitadas", "Painel com 3 abas", "Exportação e metas por área"],
  },
  "clinica-salas": {
    title: "Limite de salas atingido",
    body: "O plano gratuito inclui 1 sala. Com o Premium, configure múltiplas salas, disponibilidade dos terapeutas e a agenda completa.",
    bullets: ["Múltiplas salas", "Disponibilidade por terapeuta", "Agenda completa"],
  },
  "clinica-sessoes": {
    title: "Sessões recorrentes são Premium",
    body: "No plano gratuito a agenda é avulsa. Com o Premium, defina padrões recorrentes, gere sessões em lote, gerencie ausências e reposições.",
    bullets: ["Sessões recorrentes", "Gestão de ausências", "Reposições rastreadas"],
  },
  "clinica-autorizacoes": {
    title: "Limite de autorizações atingido",
    body: "O plano gratuito inclui 1 autorização de convênio. Com o Premium, autorizações ilimitadas, alertas de vencimento e fluxo de renovação.",
    bullets: ["Autorizações ilimitadas", "Alertas de prazo ≤ 30 dias", "Renovação e histórico imutável (LGPD)"],
  },
  "clinica-comunicacoes": {
    title: "Limite de comunicações atingido",
    body: "O plano gratuito inclui 1 envio. Com o Premium, Form 2 e Form 3 ilimitados e todos os tipos de comunicação com as famílias.",
    bullets: ["Form 2 e Form 3 ilimitados", "Cancelamento, reposição, lembretes", "Rastreamento de confirmação (LGPD)"],
  },
  "clinica-equipe": {
    title: "Monte sua equipe",
    body: "No plano gratuito só o coordenador tem acesso. Com o Premium, convide terapeutas e recepcionistas com papéis definidos.",
    bullets: ["Convidar terapeutas e recepcionistas", "Controle de acesso por papel", "Gestão de convites e remoção"],
  },
  "clinica-grupos": {
    title: "Grupos ABA com matching",
    body: "Exclusivo do Premium: crie grupos com critérios de compatibilidade (nível VB-MAPP, idade) e candidatos ordenados por score.",
    bullets: ["Criação de grupos ABA", "Matching por compatibilidade", "Aba 'Por grupo' na agenda"],
  },
};
