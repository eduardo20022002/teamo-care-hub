// ─── Tipos do Módulo de Agenda da Clínica (Fase 3) ───────────────────────────

export type SessionType =
  | "terapeutica"
  | "avaliacao"
  | "devolutiva"
  | "reposicao"
  | "orientacao_pais";

export type SessionStatus =
  | "agendada"
  | "realizada"
  | "falta_justificada"
  | "falta_nao_justificada"
  | "cancelada_clinica";

export type ReplacementStatus = "pendente" | "agendada" | "realizada" | "expirada";

export type AbsenceType =
  | "doenca"
  | "emergencia"
  | "falta_justificada"
  | "falta_nao_justificada"
  | "outro";

export type ReplacementEventType =
  | "falta_familia"
  | "cancelamento_clinica"
  | "ausencia_terapeuta";

export interface ClinicRoom {
  id: string;
  clinic_id: string;
  name: string;
  capacity: number;
  resources: string[];
  active: boolean;
  created_at: string;
}

export interface TherapistAvailability {
  id: string;
  clinic_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface RecurringSchedule {
  id: string;
  clinic_id: string;
  queue_entry_id: string | null;
  therapist_user_id: string;
  room_id: string;
  patient_name: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  session_type: SessionType;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
  created_at: string;
}

export interface ClinicSession {
  id: string;
  clinic_id: string;
  recurring_schedule_id: string | null;
  therapist_user_id: string;
  room_id: string;
  patient_name: string;
  session_date: string;
  start_time: string;
  duration_minutes: number;
  session_type: SessionType;
  status: SessionStatus;
  notes: string | null;
  insurance_authorization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicReplacement {
  id: string;
  clinic_id: string;
  original_session_id: string;
  therapist_user_id: string;
  patient_name: string;
  event_type: ReplacementEventType;
  status: ReplacementStatus;
  deadline_date: string;
  replacement_session_id: string | null;
  communication_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TherapistAbsence {
  id: string;
  clinic_id: string;
  therapist_user_id: string;
  absence_type: AbsenceType;
  starts_on: string;
  ends_on: string;
  partial: boolean;
  affected_times: unknown[];
  notes: string | null;
  sessions_cancelled: number;
  created_by: string;
  created_at: string;
}

// ─── Labels para UI ───────────────────────────────────────────────────────────

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  terapeutica:      "Terapêutica",
  avaliacao:        "Avaliação",
  devolutiva:       "Devolutiva",
  reposicao:        "Reposição",
  orientacao_pais:  "Orientação de pais",
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  agendada:              "Agendada",
  realizada:             "Realizada",
  falta_justificada:     "Falta justificada",
  falta_nao_justificada: "Falta não justificada",
  cancelada_clinica:     "Cancelada pela clínica",
};

export const REPLACEMENT_STATUS_LABELS: Record<ReplacementStatus, string> = {
  pendente:  "Pendente",
  agendada:  "Agendada",
  realizada: "Realizada",
  expirada:  "Expirada",
};

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  doenca:               "Doença",
  emergencia:           "Emergência",
  falta_justificada:    "Falta justificada",
  falta_nao_justificada: "Falta não justificada",
  outro:                "Outro",
};

export const REPLACEMENT_EVENT_TYPE_LABELS: Record<ReplacementEventType, string> = {
  falta_familia:         "Falta da família",
  cancelamento_clinica:  "Cancelamento da clínica",
  ausencia_terapeuta:    "Ausência do terapeuta",
};

export const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DAY_NAMES_FULL = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];
