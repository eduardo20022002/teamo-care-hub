// ─── Tipos do Módulo de Fila de Espera ───────────────────────────────────────

export type QueueModalidade =
  | "avaliacao"
  | "aba_individual"
  | "aba_grupo"
  | "orientacao_pais";

export type QueueTier = "alta" | "moderada" | "rotina" | "triagem";

export type QueueStatus =
  | "aguardando"
  | "em_avaliacao"
  | "agendado"
  | "inativo";

export interface QueueFactorA {
  sem_servico_atual?: boolean;
  diagnose_recente?: boolean;
  idade_critica?: boolean;
}

export interface QueueFactorB {
  comportamento_desafio?: boolean;
  gravidade?: "leve" | "moderado" | "grave";
  descricao?: string;
}

export interface QueueFactorC {
  renda_baixa?: boolean;
  responsavel_solo?: boolean;
  distancia_km?: number;
}

export interface QueueDisponibilidade {
  dias?: string[];   // ["segunda","terca","quarta","quinta","sexta","sabado"]
  turnos?: string[]; // ["manha","tarde"]
}

// ─── Form 1 (payload rico, armazenado em queue_entries.form_payload) ──────────

export type CondicaoStatus = "sim" | "nao" | "investigacao";

export interface FormResponsavel {
  nome: string;
  parentesco: string;          // valores de PARENTESCO_OPCOES
  parentesco_outro?: string;   // preenchido quando parentesco === "outro"
  telefone: string;
  email: string;
}

export interface FormCondicoes {
  tea?: CondicaoStatus;
  tdah?: CondicaoStatus;
  deficiencia_intelectual?: CondicaoStatus;
  atraso_desenvolvimento?: CondicaoStatus;
  transtorno_linguagem?: CondicaoStatus;
  transtorno_sensorial?: CondicaoStatus;
  outra?: CondicaoStatus;
  outra_qual?: string;
}

export interface FormComportamentos {
  autolesao?: boolean;
  agressividade?: boolean;
  nenhum?: boolean;
}

export interface FormHorarioEspecifico {
  dia: string;       // valor de QUEUE_DIAS
  inicio: string;    // "HH:MM"
  fim: string;       // "HH:MM"
}

export interface FormDisponibilidade {
  modo: "turno" | "horario";
  grade?: Record<string, string[]>;        // modo "turno": dia -> turnos (inclui "integral")
  horarios?: FormHorarioEspecifico[];      // modo "horario"
  restricoes?: string;
}

export interface QueueFormPayload {
  protocol?: string;
  responsaveis?: FormResponsavel[];
  condicoes?: FormCondicoes;
  comportamentos?: FormComportamentos;
  terapia_aba_atual?: boolean;
  terapia_aba_horas?: number;
  como_soube?: string;
  observacoes?: string;
  disponibilidade?: FormDisponibilidade;
}

export interface QueueEntry {
  id: string;
  clinic_id: string;
  child_name: string;
  child_birthdate: string;
  child_diagnosis: string | null;
  child_cid: string | null;
  factor_a: QueueFactorA;
  factor_b: QueueFactorB;
  factor_c: QueueFactorC;
  modalidades: QueueModalidade[];
  disponibilidade: QueueDisponibilidade;
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_telefone: string | null;
  form_payload?: QueueFormPayload;
  priority_score: number;
  priority_tier: QueueTier;
  status: QueueStatus;
  created_at: string;
  updated_at: string;
}

export interface QueuePriorityConfig {
  id: string;
  clinic_id: string;
  weight_factor_a: number;
  weight_factor_b: number;
  weight_factor_c: number;
  weight_time: number;
  tier_alta_min: number;
  tier_moderada_min: number;
}

export interface QueueHistory {
  id: string;
  entry_id: string;
  clinic_id: string;
  changed_by: string | null;
  change_type: "score_recalc" | "tier_manual" | "status_change";
  old_tier: QueueTier | null;
  new_tier: QueueTier | null;
  old_score: number | null;
  new_score: number | null;
  justificativa: string | null;
  created_at: string;
}

export const QUEUE_MODALIDADE_LABELS: Record<QueueModalidade, string> = {
  avaliacao:        "Avaliação inicial",
  aba_individual:   "ABA Individual",
  aba_grupo:        "ABA em grupo",
  orientacao_pais:  "Orientação de pais",
};

export const QUEUE_TIER_LABELS: Record<QueueTier, string> = {
  alta:     "Alta prioridade",
  moderada: "Moderada",
  rotina:   "Rotina",
  triagem:  "Triagem pendente",
};

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  aguardando:    "Aguardando",
  em_avaliacao:  "Em avaliação",
  agendado:      "Agendado",
  inativo:       "Inativo",
};

export const QUEUE_DIAS = [
  { value: "segunda",  label: "Segunda" },
  { value: "terca",    label: "Terça" },
  { value: "quarta",   label: "Quarta" },
  { value: "quinta",   label: "Quinta" },
  { value: "sexta",    label: "Sexta" },
  { value: "sabado",   label: "Sábado" },
] as const;

export const QUEUE_TURNOS = [
  { value: "manha",  label: "Manhã (até 12h)" },
  { value: "tarde",  label: "Tarde (12h–18h)" },
  { value: "noite",  label: "Noite (após 18h)" },
] as const;

// ─── Form 1 — opções de UI ───────────────────────────────────────────────────

export const PARENTESCO_OPCOES = [
  { value: "mae",               label: "Mãe" },
  { value: "pai",               label: "Pai" },
  { value: "avo_f",             label: "Avó" },
  { value: "avo_m",             label: "Avô" },
  { value: "tio_tia",           label: "Tio/Tia" },
  { value: "responsavel_legal", label: "Responsável legal" },
  { value: "outro",             label: "Outro" },
] as const;

// Turnos do Form 1 incluem "integral" (cobre todos os outros turnos do dia)
export const FORM_TURNOS = [
  { value: "manha",    label: "Manhã" },
  { value: "tarde",    label: "Tarde" },
  { value: "noite",    label: "Noite" },
  { value: "integral", label: "Integral" },
] as const;

export const FORM_CONDICOES = [
  { key: "tea",                     label: "Transtorno do Espectro Autista (TEA)" },
  { key: "tdah",                    label: "TDAH" },
  { key: "deficiencia_intelectual", label: "Deficiência Intelectual" },
  { key: "atraso_desenvolvimento",  label: "Atraso no desenvolvimento" },
  { key: "transtorno_linguagem",    label: "Transtorno de linguagem / comunicação" },
  { key: "transtorno_sensorial",    label: "Transtorno sensorial" },
  { key: "outra",                   label: "Outra condição" },
] as const;

export const CONDICAO_STATUS_OPCOES = [
  { value: "sim",          label: "Sim" },
  { value: "nao",          label: "Não" },
  { value: "investigacao", label: "Em investigação" },
] as const;
