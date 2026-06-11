// Tipos da Fase 4 — Avaliações + Formulários da Família

export type EvaluationStatus = "rascunho" | "finalizado";
export type PatientProfileStatus = "pendente" | "aprovado" | "rejeitado";
export type PaymentType = "convenio" | "particular" | "misto";

export interface VbmappDomains {
  imitacao?: number;
  vocal?: number;
  ouvinte?: number;
  visual?: number;
  jogo?: number;
  social?: number;
  lrffc?: number;
  intraverbal?: number;
  leitura?: number;
  escrita?: number;
  mat?: number;
  motor?: number;
  [key: string]: number | undefined;
}

export interface VbmappBarrier {
  barrier: string;
  description: string;
}

export interface BehaviorChallenge {
  descricao: string;
  funcao: string;
  estrategias: string;
}

export interface EvaluationGoalData {
  domain: string;
  objective: string;
  mastery_criterion: string;
}

export interface EvaluationReport {
  id: string;
  clinic_id: string;
  queue_entry_id: string;
  therapist_user_id: string;
  evaluation_dates: string[];
  instruments: string[];
  sessions_count: number;
  vbmapp_level: number | null;
  vbmapp_domains: VbmappDomains;
  vbmapp_barriers: VbmappBarrier[];
  functional_profile: Record<string, unknown>;
  behavior_challenges: BehaviorChallenge[];
  fba_conducted: boolean;
  recommended_modality: string[];
  recommended_hours_per_week: number | null;
  clinical_justification: string | null;
  sessions_per_week: number | null;
  session_duration_minutes: number;
  initial_goals: EvaluationGoalData[];
  status: EvaluationStatus;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationGoal {
  id: string;
  report_id: string;
  domain: string;
  objective: string;
  mastery_criterion: string;
  priority: number;
  created_at: string;
}

export interface Guardian {
  nome: string;
  cpf?: string;
  parentesco: string;
  email?: string;
  telefone?: string;
  is_primary?: boolean;
}

export interface EmergencyContact {
  nome: string;
  parentesco: string;
  telefone: string;
}

export interface AddressData {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export interface InsuranceData {
  plano?: string;
  numero_beneficiario?: string;
  titular?: string;
  cpf_titular?: string;
  autorizacao?: string;
}

export interface PatientProfile {
  id: string;
  clinic_id: string;
  queue_entry_id: string;
  evaluation_report_id: string | null;
  child_full_name: string;
  child_cpf: string | null;
  child_birthdate: string;
  guardians: Guardian[];
  address: AddressData;
  emergency_contacts: EmergencyContact[];
  payment_type: PaymentType | null;
  insurance_data: InsuranceData;
  diagnosis_family_report: string | null;
  comorbidities: string[];
  current_professionals: unknown[];
  school_info: Record<string, unknown>;
  other_professionals: unknown[];
  family_routine: string | null;
  expectations: string | null;
  consent_given: boolean;
  consent_date: string | null;
  status: PatientProfileStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicFormToken {
  id: string;
  clinic_id: string;
  token: string;
  form_type: "form2_horario" | "form3_cadastro";
  queue_entry_id: string;
  payload: Record<string, unknown>;
  expires_at: string;
  used_at: string | null;
  created_by: string;
  created_at: string;
}

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  rascunho: "Rascunho",
  finalizado: "Finalizado",
};

export const PATIENT_PROFILE_STATUS_LABELS: Record<PatientProfileStatus, string> = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  convenio: "Convênio",
  particular: "Particular",
  misto: "Misto",
};

export const EVALUATION_INSTRUMENTS = [
  { value: "vbmapp", label: "VB-MAPP" },
  { value: "ablls_r", label: "ABLLS-R" },
  { value: "fba", label: "FBA — Avaliação Funcional" },
  { value: "afls", label: "AFLS" },
];

export const VBMAPP_DOMAINS_LABELS: Record<string, string> = {
  imitacao: "Imitação",
  vocal: "Vocal",
  ouvinte: "Ouvinte",
  visual: "Visual",
  jogo: "Jogo",
  social: "Social",
  lrffc: "LRFFC",
  intraverbal: "Intraverbal",
  leitura: "Leitura",
  escrita: "Escrita",
  mat: "Mat.",
  motor: "Motor",
};

export const VBMAPP_DOMAIN_MAX: Record<string, number> = {
  imitacao: 10,
  vocal: 10,
  ouvinte: 12,
  visual: 10,
  jogo: 10,
  social: 10,
  lrffc: 10,
  intraverbal: 14,
  leitura: 3,
  escrita: 3,
  mat: 4,
  motor: 5,
};

export const BEHAVIOR_FUNCTIONS = [
  "Atenção",
  "Fuga/Esquiva",
  "Acesso a tangível",
  "Automático/Sensorial",
  "Múltiplas funções",
];

export const RECOMMENDED_MODALITIES = [
  { value: "aba_individual", label: "ABA Individual" },
  { value: "aba_grupo", label: "ABA em Grupo" },
  { value: "orientacao_pais", label: "Orientação de Pais" },
];
