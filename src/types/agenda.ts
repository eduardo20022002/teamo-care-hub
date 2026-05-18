/**
 * Types do módulo Agenda — espelham o schema em
 * supabase/migrations/20260517000000_agenda_module.sql.
 *
 * Mantidos manualmente porque `supabase gen types` ainda não rodou neste branch.
 * Quando rodar, podemos substituir por `Tables<"agenda_events">` etc.
 */

export type AgendaEventType =
  | "terapia"
  | "medica"
  | "escola"
  | "medicacao"
  | "outro";

export type AgendaEventStatus =
  | "upcoming"
  | "happened"
  | "rescheduled"
  | "missed";

export type RecurrenceFreq =
  | "none"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "daily"
  | "custom";

export interface RecurrenceConfig {
  freq: RecurrenceFreq;
  daysOfWeek?: number[]; // 0=Domingo..6=Sábado
  interval?: number;
  endsAt?: string; // ISO date (YYYY-MM-DD)
}

export interface RemindersConfig {
  oneDayBefore: boolean;
  oneHourBefore: boolean;
  customMinutes?: number[];
}

export interface AgendaEvent {
  id: string;
  user_id: string;
  child_id: string;
  type: AgendaEventType;
  title: string;
  professional_id: string | null;
  professional_name_raw: string | null;
  start_at: string; // ISO timestamp
  end_at: string | null;
  locale: string | null;
  recurrence: RecurrenceConfig;
  reminders: RemindersConfig;
  status: AgendaEventStatus;
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
