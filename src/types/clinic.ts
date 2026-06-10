// ─── Tipos do Módulo de Clínicas ─────────────────────────────────────────────

export type ClinicMemberRole = "coordinator" | "receptionist" | "therapist";

export type ClinicMemberRoleLabel = {
  readonly [K in ClinicMemberRole]: string;
};

export const CLINIC_MEMBER_ROLE_LABELS: ClinicMemberRoleLabel = {
  coordinator:  "Coordenador(a)",
  receptionist: "Recepcionista",
  therapist:    "Terapeuta",
};

export interface Clinic {
  id:         string;
  name:       string;
  cnpj:       string | null;
  address:    ClinicAddress;
  services:   string[];
  owner_id:   string;
  created_at: string;
  updated_at: string;
}

export interface ClinicAddress {
  street?:       string;
  number?:       string;
  complement?:   string;
  neighborhood?: string;
  city?:         string;
  state?:        string;
  zip?:          string;
}

export interface ClinicMember {
  id:         string;
  clinic_id:  string;
  user_id:    string;
  role:       ClinicMemberRole;
  invited_at: string;
  joined_at:  string | null;
  // Joined from profiles
  profile?: {
    full_name: string | null;
    email:     string;
  };
}

export interface ClinicInvite {
  id:         string;
  clinic_id:  string;
  token:      string;
  role:       ClinicMemberRole;
  email:      string;
  expires_at: string;
  used_at:    string | null;
  created_by: string;
  created_at: string;
}

// Onboarding wizard state
export interface ClinicOnboardingData {
  // Step 1
  name:    string;
  cnpj:    string;
  address: ClinicAddress;
  // Step 2 — informacional (terapeutas são adicionados via convite)
  // Step 3
  services: string[];
}

export const CLINIC_SERVICES = [
  "Avaliação inicial",
  "ABA individual",
  "ABA em grupo",
  "Orientação de pais",
  "Supervisão clínica",
] as const;

export type ClinicService = (typeof CLINIC_SERVICES)[number];

// Dashboard metric card shape
export interface ClinicDashboardMetrics {
  queueTotal:           number;
  queueByPriority:      { alta: number; moderada: number; rotina: number };
  evaluationsInProgress: number;
  sessionsToday:        { done: number; missed: number; pending: number };
  expiringAuthorizations: number;
  expiringContracts:    number;
}
