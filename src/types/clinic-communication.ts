// Tipos do módulo de Comunicação com a Família (Fase 6)

export type CommType =
  | 'confirmacao_fila'
  | 'form2_horario'
  | 'form3_cadastro'
  | 'cancelamento_ausencia_terapeuta'
  | 'proposta_reposicao'
  | 'autorizacao_vencendo'
  | 'mudanca_terapeuta'
  | 'renovacao_contrato';

export type CommStatus = 'enviado' | 'confirmado' | 'sem_resposta' | 'prazo_expirado';

export interface ClinicCommunication {
  id: string;
  clinic_id: string;
  patient_profile_id: string | null;
  queue_entry_id: string | null;
  comm_type: CommType;
  token_id: string | null;
  status: CommStatus;
  sent_at: string;
  confirmed_at: string | null;
  confirmation_ip_hash: string | null;
  response_deadline: string | null;
  escalated_at: string | null;
  escalated_to: string | null;
  created_at: string;
}

export const COMM_TYPE_LABELS: Record<CommType, string> = {
  confirmacao_fila:                    'Confirmação de fila',
  form2_horario:                       'Proposta de horário',
  form3_cadastro:                      'Cadastro completo',
  cancelamento_ausencia_terapeuta:     'Cancelamento de sessão',
  proposta_reposicao:                  'Proposta de reposição',
  autorizacao_vencendo:                'Autorização vencendo',
  mudanca_terapeuta:                   'Mudança de terapeuta',
  renovacao_contrato:                  'Renovação de contrato',
};

export const COMM_STATUS_LABELS: Record<CommStatus, string> = {
  enviado:         'Enviado',
  confirmado:      'Confirmado',
  sem_resposta:    'Sem resposta',
  prazo_expirado:  'Prazo expirado',
};

export const COMM_STATUS_CLASSES: Record<CommStatus, string> = {
  enviado:        'bg-blue-50 text-blue-700 border-blue-200',
  confirmado:     'bg-green-50 text-green-700 border-green-200',
  sem_resposta:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  prazo_expirado: 'bg-red-50 text-red-700 border-red-200',
};

export const COMM_TYPE_CLASSES: Record<CommType, string> = {
  confirmacao_fila:                    'bg-gray-100 text-gray-700',
  form2_horario:                       'bg-indigo-100 text-indigo-700',
  form3_cadastro:                      'bg-indigo-100 text-indigo-700',
  cancelamento_ausencia_terapeuta:     'bg-red-100 text-red-700',
  proposta_reposicao:                  'bg-blue-100 text-blue-700',
  autorizacao_vencendo:                'bg-yellow-100 text-yellow-700',
  mudanca_terapeuta:                   'bg-orange-100 text-orange-700',
  renovacao_contrato:                  'bg-purple-100 text-purple-700',
};

// Payload esperado por comm_type (armazenado em clinic_form_tokens.payload)
export interface CommPayloadCancelamento {
  patient_name: string;
  session_date: string;   // 'YYYY-MM-DD'
  start_time: string;
  therapist_name?: string;
}

export interface CommPayloadReposicao {
  patient_name: string;
  proposed_date: string;
  proposed_time: string;
  therapist_name?: string;
  room_name?: string;
  replacement_id: string;
}

export interface CommPayloadAutorizacao {
  patient_name: string;
  insurance_plan: string;
  authorization_number: string;
  valid_until: string;
  days_until_expiry: number;
  authorization_id: string;
}

export interface CommPayloadRenovacao {
  patient_name: string;
  clinic_name: string;
  current_period?: string;
  proposed_period?: string;
  modality?: string;
}

export type CommPayload =
  | CommPayloadCancelamento
  | CommPayloadReposicao
  | CommPayloadAutorizacao
  | CommPayloadRenovacao
  | Record<string, unknown>;
