// Constantes de plano (Freemium). Compartilhado por backend (gates) e frontend (UI).
// Sem imports de servidor aqui — pode ser usado em qualquer lado.

/** Limites do plano gratuito do terapeuta. */
export const THERAPIST_LIMITS = {
  /** Pacientes ativos criados pelo próprio terapeuta (não conta acesso recebido de pais). */
  activePatients: 2,
} as const;

/** Preço e trial do Premium do terapeuta (espelha premium-terapeuta.md). */
export const THERAPIST_PRICE = {
  monthly: 49.9,
  trialDays: 7,
} as const;

/** Limites do plano gratuito do responsável (espelha free-vs-premium-responsavel.md). */
export const PARENT_LIMITS = {
  records: 10,    // registros do diário
  documents: 1,   // documentos/anexos da criança
} as const;

/** Preço e trial do Premium do responsável. */
export const PARENT_PRICE = {
  monthly: 29.9,
  trialDays: 7,
} as const;

/** Limites do plano gratuito da clínica (espelha premium-clinica.md). */
export const CLINIC_LIMITS = {
  casos: 1,
  avaliacoes: 1,
  salas: 1,
  sessoes: 1,
  autorizacoes: 1,
  comunicacoes: 1,
} as const;

/** Preço e trial do Premium da clínica. */
export const CLINIC_PRICE = {
  monthly: 149.9,
  trialDays: 14,
} as const;

/** Escopo de assinatura (preço/produto distinto por papel). */
export type PlanScope = "therapist" | "parent" | "clinic";

/** Contextos de upsell — definem copy do UpgradeModal/preview. */
export type PremiumFeature =
  // Terapeuta
  | "patients"        // limite de pacientes atingido
  | "invites"         // convidar pais/responsáveis
  | "recados"         // recados para a família
  | "privacy"         // toggle de privacidade no registro
  | "milestones"      // compartilhar marcos com pais
  | "goal-link"       // vincular objetivos do plano a metas
  | "continue"        // vincular pontos a sessão futura
  | "recurring"       // sessões recorrentes
  // Responsável
  | "registros"            // limite de registros atingido
  | "documentos"           // limite de documentos atingido
  | "compartilhamentos"    // compartilhar via OTP
  | "cuidado-compartilhado" // convidar co-cuidadores
  // Clínica
  | "clinica-casos"
  | "clinica-avaliacoes"
  | "clinica-salas"
  | "clinica-sessoes"
  | "clinica-autorizacoes"
  | "clinica-comunicacoes"
  | "clinica-equipe"
  | "clinica-grupos";

/** A qual escopo cada feature pertence (define preço e tela de planos). */
export const FEATURE_SCOPE: Record<PremiumFeature, PlanScope> = {
  patients: "therapist",
  invites: "therapist",
  recados: "therapist",
  privacy: "therapist",
  milestones: "therapist",
  "goal-link": "therapist",
  continue: "therapist",
  recurring: "therapist",
  registros: "parent",
  documentos: "parent",
  compartilhamentos: "parent",
  "cuidado-compartilhado": "parent",
  "clinica-casos": "clinic",
  "clinica-avaliacoes": "clinic",
  "clinica-salas": "clinic",
  "clinica-sessoes": "clinic",
  "clinica-autorizacoes": "clinic",
  "clinica-comunicacoes": "clinic",
  "clinica-equipe": "clinic",
  "clinica-grupos": "clinic",
};

/** Preço da feature conforme o escopo que a disparou. */
export function featurePrice(
  feature: PremiumFeature,
): typeof THERAPIST_PRICE | typeof PARENT_PRICE | typeof CLINIC_PRICE {
  const scope = FEATURE_SCOPE[feature];
  if (scope === "parent") return PARENT_PRICE;
  if (scope === "clinic") return CLINIC_PRICE;
  return THERAPIST_PRICE;
}

export type PlanTier = "free" | "premium";
