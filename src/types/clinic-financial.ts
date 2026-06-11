// Fase 5 — Módulo Financeiro e Convênios

export type AuthorizationStatus =
  | 'ativa'
  | 'vencendo'
  | 'vencida'
  | 'renovacao_em_andamento'
  | 'encerrada';

export type PaymentStatus = 'pendente' | 'pago' | 'em_atraso';

export interface InsuranceAuthorization {
  id: string;
  clinic_id: string;
  patient_profile_id: string;
  insurance_plan: string;
  authorization_number: string;
  valid_from: string;          // date ISO
  valid_until: string;         // date ISO
  sessions_authorized: number;
  sessions_used: number;
  sessions_remaining: number;  // GENERATED column
  status: AuthorizationStatus;
  archived: boolean;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // JOIN
  patient_name?: string;
}

export interface ClinicPaymentRecord {
  id: string;
  clinic_id: string;
  patient_profile_id: string;
  payment_type: 'convenio' | 'particular' | 'misto';
  reference_month: string;    // date ISO — primeiro dia do mês
  amount_cents?: number | null;
  status: PaymentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type AuthorizationAlertLevel = 'info' | 'warning' | 'critical';

export interface AuthorizationAlert {
  authorizationId: string;
  patientProfileId: string;
  patientName: string;
  insurancePlan: string;
  authorizationNumber: string;
  daysUntilExpiry: number;
  sessionsRemaining: number;
  alertLevel: AuthorizationAlertLevel;
}

// ─── Labels e helpers ────────────────────────────────────────────────────────

export const AUTHORIZATION_STATUS_LABELS: Record<AuthorizationStatus, string> = {
  ativa:                    'Ativa',
  vencendo:                 'Vencendo',
  vencida:                  'Vencida',
  renovacao_em_andamento:   'Renovação em andamento',
  encerrada:                'Encerrada',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pendente:  'Pendente',
  pago:      'Pago',
  em_atraso: 'Em atraso',
};

/** Retorna alertLevel baseado em dias até o vencimento */
export function getAlertLevel(daysUntilExpiry: number): AuthorizationAlertLevel {
  if (daysUntilExpiry < 0) return 'critical';
  if (daysUntilExpiry <= 10) return 'critical';
  if (daysUntilExpiry <= 30) return 'warning';
  return 'info';
}

/** Classes Tailwind para badge de validade */
export const VALIDITY_BADGE_CLASSES: Record<AuthorizationAlertLevel, { bg: string; text: string; border: string }> = {
  info:     { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  warning:  { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  critical: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200'    },
};
