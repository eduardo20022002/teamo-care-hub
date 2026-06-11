// ─── Tipos do Módulo de Grupos ABA (Fase 7) ─────────────────────────────────

import type { PatientProfile } from "./clinic-evaluation";

export type GroupStatus = "formando" | "ativo" | "encerrado";

export interface MatchingCriteria {
  vbmapp_level_min: number;
  vbmapp_level_max: number;
  age_min: number;
  age_max: number;
  allow_factor_b: boolean;
}

export interface CompatibilityAlert {
  criterion: string;
  expected: string;
  actual: string;
  severity: "warning" | "block";
}

export interface MatchingResult {
  compatible: boolean;
  alerts: CompatibilityAlert[];
  requiresJustification: boolean;
}

export interface ClinicGroup {
  id: string;
  clinic_id: string;
  name: string;
  therapist_user_id: string;
  room_id: string;
  day_of_week: number;
  start_time: string;
  duration_minutes: number;
  capacity_max: number;
  matching_criteria: MatchingCriteria;
  status: GroupStatus;
  created_at: string;
  updated_at: string;
  // Campos computados (JOINs)
  therapist_name?: string;
  room_name?: string;
  member_count?: number;
  members?: ClinicGroupMember[];
}

export interface ClinicGroupMember {
  id: string;
  clinic_group_id: string;
  patient_profile_id: string;
  joined_at: string;
  left_at: string | null;
  leave_reason: string | null;
  exception_justification: string | null;
  // Campos computados via JOIN
  patient?: PatientProfile & { vbmapp_level?: number };
}

export interface GroupCandidate {
  entry_id: string;
  patient_profile_id: string;
  child_name: string;
  child_birthdate: string;
  vbmapp_level: number | null;
  factor_b: boolean;
  score: number;
  matchingResult: MatchingResult;
}

export const GROUP_STATUS_LABELS: Record<GroupStatus, string> = {
  formando: "Formando",
  ativo: "Ativo",
  encerrado: "Encerrado",
};

export const GROUP_STATUS_COLORS: Record<GroupStatus, { bg: string; color: string; border: string }> = {
  formando: { bg: "#FEF9C3", color: "#CA8A04", border: "#FDE68A" },
  ativo:    { bg: "#DCFCE7", color: "#16A34A", border: "#86EFAC" },
  encerrado:{ bg: "#F3F4F6", color: "#6B7280", border: "#D1D5DB" },
};

export const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
