import { z } from "zod";

export const AGENDA_EVENT_TYPES = [
  "terapia",
  "medica",
  "escola",
  "medicacao",
  "outro",
] as const;
export type AgendaEventTypeValue = (typeof AGENDA_EVENT_TYPES)[number];

export const AGENDA_EVENT_TYPE_LABELS: Record<AgendaEventTypeValue, string> = {
  terapia: "Terapia",
  medica: "Consulta médica",
  escola: "Escola",
  medicacao: "Medicação",
  outro: "Outro",
};

export const RECURRENCE_FREQS = [
  "none",
  "weekly",
  "biweekly",
  "monthly",
  "daily",
  "custom",
] as const;

const recurrenceSchema = z.object({
  freq: z.enum(RECURRENCE_FREQS),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  endsAt: z.string().optional(),
});

const remindersSchema = z.object({
  oneDayBefore: z.boolean(),
  oneHourBefore: z.boolean(),
  customMinutes: z.array(z.number().int().min(0)).optional(),
});

export const agendaEventSchema = z.object({
  child_id: z.string().uuid("Selecione uma criança."),
  type: z.enum(AGENDA_EVENT_TYPES, { message: "Selecione o tipo." }),
  title: z
    .string()
    .trim()
    .min(1, "Informe o título.")
    .max(120, "Título muito longo."),
  professional_id: z.string().uuid().nullable().optional(),
  professional_name_raw: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional(),
  // Data + hora separadas no form; combinamos no service.
  date: z.string().min(1, "Informe a data."),
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida (use HH:MM).")
    .min(1, "Informe a hora."),
  end_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida.")
    .optional()
    .or(z.literal("")),
  locale: z.string().trim().max(200).optional().or(z.literal("")),
  recurrence: recurrenceSchema.default({ freq: "none" }),
  reminders: remindersSchema.default({
    oneDayBefore: true,
    oneHourBefore: true,
  }),
});

export type AgendaEventInput = z.infer<typeof agendaEventSchema>;

export const agendaObservationSchema = z.object({
  event_id: z.string().uuid(),
  text: z
    .string()
    .trim()
    .min(1, "Anote algo do compromisso.")
    .max(5000, "Anotação muito longa."),
  reminder_enabled: z.boolean().default(false),
  reminder_target_professional_id: z.string().uuid().nullable().optional(),
  reminder_fire_at: z.string().nullable().optional(),
});

export type AgendaObservationInput = z.infer<typeof agendaObservationSchema>;
