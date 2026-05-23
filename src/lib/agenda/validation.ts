import { z } from "zod";

export const AGENDA_EVENT_TYPES = [
  "medicacao",
  "terapia",
  "consulta",
  "escola",
  "outro",
] as const;
export type AgendaEventTypeValue = (typeof AGENDA_EVENT_TYPES)[number];

export const AGENDA_EVENT_TYPE_LABELS: Record<AgendaEventTypeValue, string> = {
  medicacao: "Medicação",
  terapia: "Terapia",
  consulta: "Consulta",
  escola: "Escola",
  outro: "Outro",
};

// ---------------------------------------------------------------------------
// Recurrence — discriminated union persistida em JSONB
// ---------------------------------------------------------------------------

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM).");
const isoDate = z.string().min(1, "Informe a data.");

const endsConfigSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("indeterminate") }),
  z.object({ kind: z.literal("on"), date: isoDate }),
  z.object({ kind: z.literal("after"), count: z.number().int().min(1).max(999) }),
]);

export const recurrenceSchema = z.discriminatedUnion("freq", [
  z.object({ freq: z.literal("none") }),
  z.object({ freq: z.literal("once") }),
  z.object({ freq: z.literal("daily"), endsOn: isoDate.optional() }),
  z.object({
    freq: z.literal("weekly"),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    endsOn: isoDate.optional(),
  }),
  z.object({
    freq: z.literal("biweekly"),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    endsOn: isoDate.optional(),
  }),
  z.object({ freq: z.literal("monthly"), endsOn: isoDate.optional() }),
  z.object({
    freq: z.literal("custom"),
    interval: z.number().int().min(1).max(365).optional(),
    endsOn: isoDate.optional(),
  }),
  z.object({
    freq: z.literal("every_n_days"),
    interval: z.number().int().min(1).max(365),
    endsOn: isoDate.optional(),
  }),
  z.object({
    freq: z.literal("weekly_same_time"),
    dayOfWeek: z.number().int().min(0).max(6),
    time: hhmm,
    ends: endsConfigSchema,
    pauses: z
      .array(z.object({ from: isoDate, to: isoDate }))
      .optional(),
  }),
  z.object({
    freq: z.literal("weekly_varies"),
    schedule: z
      .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), time: hhmm }))
      .min(1, "Selecione pelo menos um dia."),
    ends: endsConfigSchema,
  }),
  z.object({
    freq: z.literal("intensive"),
    perWeek: z.number().int().min(1).max(7),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
    time: hhmm,
    startsOn: isoDate,
    endsOn: isoDate,
  }),
  z.object({
    freq: z.literal("every_n_months"),
    interval: z.number().int().min(1).max(60),
  }),
  z.object({ freq: z.literal("yearly") }),
]);

export type RecurrenceInput = z.infer<typeof recurrenceSchema>;

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export const remindersSchema = z.object({
  oneDayBefore: z.boolean(),
  oneHourBefore: z.boolean(),
  customMinutes: z.array(z.number().int().min(0)).optional(),
});

// ---------------------------------------------------------------------------
// type_data — discriminated por `kind` (espelha AgendaEventType)
// ---------------------------------------------------------------------------

const medicacaoUnits = ["mg", "ml", "comprimido", "gotas", "other"] as const;
const medicacaoRoutes = ["oral", "sublingual", "nasal", "other"] as const;
const medicacaoMoments = [
  "fasting",
  "with_food",
  "bedtime",
  "any",
  "other",
] as const;

export const medicacaoTypeDataSchema = z.object({
  kind: z.literal("medicacao"),
  medicationName: z
    .string()
    .trim()
    .min(1, "Informe o nome do medicamento.")
    .max(120),
  dose: z.object({
    value: z.number({ message: "Informe a dose." }).positive("Dose inválida."),
    unit: z.enum(medicacaoUnits),
    customUnit: z.string().trim().max(40).optional(),
  }),
  route: z.enum(medicacaoRoutes),
  routeCustom: z.string().trim().max(60).optional(),
  moment: z.enum(medicacaoMoments),
  momentCustom: z.string().trim().max(60).optional(),
  times: z
    .array(hhmm)
    .min(1, "Adicione ao menos um horário.")
    .max(8, "Máximo de 8 horários."),
  isContinuous: z.boolean(),
  endsOn: isoDate.optional(),
  prescriptionExpiresOn: isoDate.optional(),
  clinicalNotes: z.string().trim().max(2000).optional(),
});

const terapiaKinds = [
  "aba",
  "fono",
  "psicomotricidade",
  "to",
  "psicologia",
  "other",
] as const;
const terapiaDurations = ["30", "45", "60", "90", "other"] as const;

export const terapiaTypeDataSchema = z.object({
  kind: z.literal("terapia"),
  therapyType: z.enum(terapiaKinds),
  therapyTypeCustom: z.string().trim().max(60).optional(),
  duration: z.enum(terapiaDurations),
  durationCustom: z.string().trim().max(40).optional(),
  hasContract: z.boolean(),
  plannedSessions: z.number().int().min(1).max(999).optional(),
  reassessmentOn: isoDate.optional(),
});

const consultaKinds = [
  "first",
  "followup",
  "evaluation",
  "exam",
  "procedure",
  "other",
] as const;
const consultaSpecialties = [
  "neuro",
  "psicologia",
  "psiquiatria_infantil",
  "pediatria",
  "fonoaudiologia",
  "nutricao",
  "assistencia_social",
  "other",
] as const;

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string().trim().max(120),
  done: z.boolean(),
});

export const consultaTypeDataSchema = z.object({
  kind: z.literal("consulta"),
  consultType: z.enum(consultaKinds),
  consultTypeCustom: z.string().trim().max(60).optional(),
  specialty: z.enum(consultaSpecialties),
  specialtyCustom: z.string().trim().max(60).optional(),
  documentsChecklist: z.array(checklistItemSchema).max(30),
  returnScheduled: z.boolean(),
  returnDate: isoDate.optional(),
  returnTime: hhmm.optional(),
});

const escolaKinds = ["aee", "parents", "event", "council", "other"] as const;

export const escolaTypeDataSchema = z.object({
  kind: z.literal("escola"),
  eventType: z.enum(escolaKinds),
  eventTypeCustom: z.string().trim().max(60).optional(),
  documentsChecklist: z.array(checklistItemSchema).max(30),
});

export const outroTypeDataSchema = z.object({
  kind: z.literal("outro"),
  notes: z.string().trim().max(2000).optional(),
});

export const typeDataSchema = z.discriminatedUnion("kind", [
  medicacaoTypeDataSchema,
  terapiaTypeDataSchema,
  consultaTypeDataSchema,
  escolaTypeDataSchema,
  outroTypeDataSchema,
]);

export type TypeDataInput = z.infer<typeof typeDataSchema>;
export type MedicacaoTypeDataInput = z.infer<typeof medicacaoTypeDataSchema>;
export type TerapiaTypeDataInput = z.infer<typeof terapiaTypeDataSchema>;
export type ConsultaTypeDataInput = z.infer<typeof consultaTypeDataSchema>;
export type EscolaTypeDataInput = z.infer<typeof escolaTypeDataSchema>;
export type OutroTypeDataInput = z.infer<typeof outroTypeDataSchema>;

// ---------------------------------------------------------------------------
// Evento completo
// ---------------------------------------------------------------------------

const baseFields = {
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
  date: isoDate,
  start_time: hhmm,
  end_time: hhmm.optional().or(z.literal("")),
  locale: z.string().trim().max(200).optional().or(z.literal("")),
  recurrence: recurrenceSchema.default({ freq: "none" }),
  reminders: remindersSchema.default({
    oneDayBefore: true,
    oneHourBefore: true,
  }),
  type_data: typeDataSchema,
};

export const agendaEventSchema = z
  .object(baseFields)
  .superRefine((val, ctx) => {
    // type e type_data.kind precisam coincidir
    if (val.type !== val.type_data.kind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "type_data inconsistente com type.",
        path: ["type_data"],
      });
    }
  });

export type AgendaEventInput = z.infer<typeof agendaEventSchema>;

// ---------------------------------------------------------------------------
// Observação (mantido como estava)
// ---------------------------------------------------------------------------

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
