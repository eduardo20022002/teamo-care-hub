/**
 * Types do módulo Agenda — espelham o schema em
 * supabase/migrations/20260517000000_agenda_module.sql + extensões em
 * supabase/migrations/20260522120000_agenda_event_type_data.sql.
 */

export type AgendaEventType =
  | "terapia"
  | "consulta"
  | "escola"
  | "medicacao"
  | "outro";

export type AgendaEventStatus =
  | "upcoming"
  | "happened"
  | "rescheduled"
  | "missed";

// Antiga lista plana — mantida apenas para compatibilidade tipográfica;
// novos shapes estão em RecurrenceConfig (discriminated union).
export type RecurrenceFreqLegacy =
  | "none"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "daily"
  | "custom";

/**
 * Discriminated union de recorrência. Persistida em JSONB.
 * O shape varia conforme o tipo de compromisso e a escolha do usuário.
 */
export type RecurrenceConfig =
  // Genéricos (mantidos por compatibilidade com eventos antigos)
  | { freq: "none" }
  | { freq: "once" }
  | { freq: "daily"; endsOn?: string }
  | {
      freq: "weekly";
      daysOfWeek?: number[]; // 0=Domingo..6=Sábado
      endsOn?: string;
    }
  | { freq: "biweekly"; dayOfWeek?: number; endsOn?: string }
  | { freq: "monthly"; endsOn?: string }
  | { freq: "custom"; interval?: number; endsOn?: string }
  // Medicação
  | { freq: "every_n_days"; interval: number; endsOn?: string }
  // Terapia — toda semana, mesmo horário
  | {
      freq: "weekly_same_time";
      dayOfWeek: number;
      time: string; // "HH:MM"
      ends:
        | { kind: "indeterminate" }
        | { kind: "on"; date: string }
        | { kind: "after"; count: number };
      pauses?: Array<{ from: string; to: string }>;
    }
  // Terapia — toda semana, horário varia por dia
  | {
      freq: "weekly_varies";
      schedule: Array<{ dayOfWeek: number; time: string }>;
      ends:
        | { kind: "indeterminate" }
        | { kind: "on"; date: string }
        | { kind: "after"; count: number };
    }
  // Terapia — intensivo por período
  | {
      freq: "intensive";
      perWeek: number;
      daysOfWeek: number[];
      time: string;
      startsOn: string;
      endsOn: string;
    }
  // Consulta — periódica em meses ou anos
  | { freq: "every_n_months"; interval: number }
  | { freq: "yearly" };

export type RecurrenceFreq = RecurrenceConfig["freq"];

export interface RemindersConfig {
  oneDayBefore: boolean;
  oneHourBefore: boolean;
  customMinutes?: number[];
}

// ---------------------------------------------------------------------------
// type_data — discriminated union dos campos específicos por tipo
// ---------------------------------------------------------------------------

export type MedicacaoUnit = "mg" | "ml" | "comprimido" | "gotas" | "other";
export type MedicacaoRoute = "oral" | "sublingual" | "nasal" | "other";
export type MedicacaoMoment =
  | "fasting"
  | "with_food"
  | "bedtime"
  | "any"
  | "other";

/**
 * Como os horários das doses foram informados:
 * - fixed: a mãe digitou cada horário manualmente (TimeMultiPicker).
 * - interval: a mãe informou a 1ª dose + intervalo em horas, e o app calculou
 *   os horários do dia. `times[]` continua sendo a fonte da verdade.
 */
export interface DoseSchedule {
  mode: "fixed" | "interval";
  firstDose?: string; // "HH:MM" — usado no modo interval
  everyHours?: number; // 1..24 — usado no modo interval
}

export interface MedicacaoTypeData {
  medicationName: string;
  dose: { value: number; unit: MedicacaoUnit; customUnit?: string };
  route: MedicacaoRoute;
  routeCustom?: string;
  moment: MedicacaoMoment;
  momentCustom?: string;
  times: string[]; // ["08:00","20:00"]
  doseSchedule?: DoseSchedule;
  isContinuous: boolean;
  endsOn?: string;
  prescriptionExpiresOn?: string;
  clinicalNotes?: string;
}

export type TerapiaKind =
  | "aba"
  | "fono"
  | "psicomotricidade"
  | "to"
  | "psicologia"
  | "other";
export type TerapiaDuration = "30" | "45" | "60" | "90" | "other";

export interface TerapiaTypeData {
  therapyType: TerapiaKind;
  therapyTypeCustom?: string;
  duration: TerapiaDuration;
  durationCustom?: string;
  hasContract: boolean;
  plannedSessions?: number;
  reassessmentOn?: string;
}

export type ConsultaKind =
  | "first"
  | "followup"
  | "evaluation"
  | "exam"
  | "procedure"
  | "other";
export type ConsultaSpecialty =
  | "neuro"
  | "psicologia"
  | "psiquiatria_infantil"
  | "pediatria"
  | "fonoaudiologia"
  | "nutricao"
  | "assistencia_social"
  | "other";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface ConsultaTypeData {
  consultType: ConsultaKind;
  consultTypeCustom?: string;
  specialty: ConsultaSpecialty;
  specialtyCustom?: string;
  documentsChecklist: ChecklistItem[];
  returnScheduled: boolean;
}

export type EscolaKind =
  | "aee"
  | "parents"
  | "event"
  | "council"
  | "other";

export interface EscolaTypeData {
  eventType: EscolaKind;
  eventTypeCustom?: string;
  documentsChecklist: ChecklistItem[];
}

export interface OutroTypeData {
  notes?: string;
}

export type AgendaTypeData =
  | ({ kind: "medicacao" } & MedicacaoTypeData)
  | ({ kind: "terapia" } & TerapiaTypeData)
  | ({ kind: "consulta" } & ConsultaTypeData)
  | ({ kind: "escola" } & EscolaTypeData)
  | ({ kind: "outro" } & OutroTypeData);

// ---------------------------------------------------------------------------
// Linhas da tabela
// ---------------------------------------------------------------------------

export interface AgendaEvent {
  id: string;
  user_id: string;
  child_id: string;
  type: AgendaEventType;
  title: string;
  professional_id: string | null;
  professional_name_raw: string | null;
  start_at: string;
  end_at: string | null;
  locale: string | null;
  recurrence: RecurrenceConfig;
  reminders: RemindersConfig;
  status: AgendaEventStatus;
  type_data: Record<string, unknown>;
  linked_event_id: string | null;
  series_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaEventInsert {
  user_id: string;
  child_id: string;
  type: AgendaEventType;
  title: string;
  professional_id?: string | null;
  professional_name_raw?: string | null;
  start_at: string;
  end_at?: string | null;
  locale?: string | null;
  recurrence?: RecurrenceConfig;
  reminders?: RemindersConfig;
  status?: AgendaEventStatus;
  type_data?: Record<string, unknown>;
  linked_event_id?: string | null;
  series_id?: string | null;
}

export interface AgendaEventWithRelations extends AgendaEvent {
  child: { id: string; name: string } | null;
  professional: { id: string; name: string } | null;
  observation_count?: number;
  attachment_count?: number;
}

export interface AgendaObservation {
  id: string;
  user_id: string;
  event_id: string;
  text: string;
  reminder_enabled: boolean;
  reminder_target_professional_id: string | null;
  reminder_target_event_id: string | null;
  reminder_fire_at: string | null;
  reminder_dismissed: boolean;
  promoted_to_record_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaObservationInsert {
  user_id: string;
  event_id: string;
  text: string;
  reminder_enabled?: boolean;
  reminder_target_professional_id?: string | null;
  reminder_target_event_id?: string | null;
  reminder_fire_at?: string | null;
}

export interface AgendaObservationAttachment {
  id: string;
  user_id: string;
  observation_id: string;
  storage_path: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  duration_seconds: number | null;
  kind: "image" | "video" | "audio" | "pdf" | "other";
  created_at: string;
}

export interface AgendaNotificationPrefs {
  user_id: string;
  one_day_before: boolean;
  one_hour_before: boolean;
  pending_observations: boolean;
  post_event_register: boolean;
  onboarding_completed: boolean;
  updated_at: string;
}
