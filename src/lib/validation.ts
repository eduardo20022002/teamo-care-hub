import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .regex(/[a-zA-Z]/, "A senha deve conter ao menos uma letra.")
  .regex(/[0-9]/, "A senha deve conter ao menos um número.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .email("E-mail inválido.")
  .max(255);

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Informe como gostaria de ser chamado(a).")
  .max(60, "Nome muito longo.");

export const signUpSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
});

export const childSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome da criança.")
    .max(80, "Nome muito longo."),
  birth_date: z
    .string()
    .min(1, "Informe a data de nascimento.")
    .refine((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d <= new Date();
    }, "Data de nascimento inválida."),
});

export type ChildInput = z.infer<typeof childSchema>;

export const TEA_SPECIALTIES = [
  "Neuropediatra",
  "Psiquiatra infantil",
  "Psicólogo(a)",
  "Psicólogo(a) ABA",
  "Fonoaudiólogo(a)",
  "Terapeuta ocupacional",
  "Fisioterapeuta",
  "Nutricionista",
  "Pedagogo(a)",
  "Psicopedagogo(a)",
  "Musicoterapeuta",
  "Educador(a) físico(a)",
  "Professor(a) de apoio",
  "Outro",
] as const;

const phoneRegex = /^[\d\s()+\-]{8,20}$/;

export const professionalSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120, "Nome muito longo."),
  specialty: z
    .string()
    .trim()
    .min(1, "Informe a especialidade.")
    .max(120, "Especialidade muito longa."),
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .max(20, "Telefone muito longo.")
    .refine((v) => v === "" || phoneRegex.test(v), "Telefone inválido.")
    .optional()
    .or(z.literal("")),
});

export type ProfessionalInput = z.infer<typeof professionalSchema>;

export const ATTENDANCE_CATEGORIES = [
  "orientacao",
  "observacao_clinica",
  "conduta",
  "evolucao",
] as const;

export type AttendanceCategoryValue = (typeof ATTENDANCE_CATEGORIES)[number];

export const ATTENDANCE_CATEGORY_LABELS: Record<AttendanceCategoryValue, string> = {
  orientacao: "Orientação",
  observacao_clinica: "Observação clínica",
  conduta: "Conduta",
  evolucao: "Evolução",
};

export const attendanceRecordSchema = z.object({
  child_id: z.string().uuid("Selecione uma criança."),
  professional_id: z.string().uuid().nullable().optional(),
  professional_name: z
    .string()
    .trim()
    .min(1, "Informe o profissional emissor.")
    .max(120, "Nome muito longo."),
  category: z.enum(ATTENDANCE_CATEGORIES, {
    message: "Selecione a categoria.",
  }),
  content: z
    .string()
    .trim()
    .min(1, "Descreva o conteúdo do atendimento.")
    .max(5000, "Conteúdo muito longo (máx. 5000 caracteres)."),
  record_date: z
    .string()
    .min(1, "Informe a data do atendimento.")
    .refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return d <= today;
    }, "A data não pode ser futura."),
});

export type AttendanceRecordInput = z.infer<typeof attendanceRecordSchema>;

// ===== Diário de registros do cuidador (RF-05) =====

export const RECORD_TYPES = [
  "comportamento",
  "conquista",
  "sono",
  "saude",
  "alimentacao",
  "sensorial",
  "livre",
] as const;

export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_SHIFTS = ["manha", "tarde", "noite", "madrugada"] as const;
export type RecordShift = (typeof RECORD_SHIFTS)[number];

export const SHIFT_LABELS: Record<RecordShift, string> = {
  manha: "manhã",
  tarde: "tarde",
  noite: "noite",
  madrugada: "madrugada",
};

export interface RecordTypeConfig {
  label: string;
  color: string;   // primary color
  tint: string;    // pastel background
  description: string;
}

export const RECORD_TYPE_CONFIG: Record<RecordType, RecordTypeConfig> = {
  comportamento: {
    label: "Comportamento",
    color: "#D97706",
    tint: "#FEF3C7",
    description: "Crises, agitação, autorregulação",
  },
  conquista: {
    label: "Conquista",
    color: "#EC4899",
    tint: "#FDF2F8",
    description: "Avanços, primeiras vezes",
  },
  sono: {
    label: "Sono",
    color: "#4F46E5",
    tint: "#EEF1FF",
    description: "Horários, qualidade",
  },
  saude: {
    label: "Saúde",
    color: "#E11D48",
    tint: "#FFE4E6",
    description: "Sintomas, medicações",
  },
  alimentacao: {
    label: "Alimentação",
    color: "#16A34A",
    tint: "#DCFCE7",
    description: "Refeições, recusas",
  },
  sensorial: {
    label: "Sensorial",
    color: "#7C3AED",
    tint: "#F3E8FF",
    description: "Gatilhos e reações",
  },
  livre: {
    label: "Anotação livre",
    color: "#6B7280",
    tint: "#F4F5FA",
    description: "Qualquer outra observação",
  },
};

export const diaryRecordSchema = z.object({
  child_id: z.string().uuid("Selecione uma criança."),
  record_type: z.enum(RECORD_TYPES, { message: "Selecione o tipo de registro." }),
  shift: z.enum(RECORD_SHIFTS).nullable().optional(),
  record_date: z
    .string()
    .min(1, "Informe a data.")
    .refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return d <= today;
    }, "A data não pode ser futura."),
  title: z.string().trim().max(200).nullable().optional(),
  content: z.string().trim().max(5000).nullable().optional(),
  type_data: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type DiaryRecordInput = z.infer<typeof diaryRecordSchema>;

// ─── TypeData interfaces por tipo de registro ─────────────────────────────────

/** Dados estruturados de um registro de Comportamento */
export interface TypeDataComportamento {
  intensity?: 1 | 2 | 3 | 4 | 5;
  duration?: "menos5" | "5a15" | "15a30" | "mais30";
  triggers?: string[];
  helped?: string;
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Dados estruturados de um registro de Conquista */
export interface TypeDataConquista {
  area?: string;
  location?: string;
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Dados estruturados de um registro de Sono */
export interface TypeDataSono {
  date_start?: string;
  sleep_time?: string;
  wake_time?: string;
  quality?: 1 | 2 | 3 | 4 | 5;
  woke_up?: boolean;
  wake_count?: number;
  wake_content?: string;
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Dados estruturados de um registro de Saúde */
export interface TypeDataSaude {
  symptoms?: string[];
  intensity?: 1 | 2 | 3 | 4 | 5;
  gave_meds?: boolean;
  meds_description?: string;
  observations?: string;
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Dados estruturados de um registro de Alimentação */
export interface TypeDataAlimentacao {
  meal?: "cafe" | "almoco" | "lanche" | "jantar" | "madrugada";
  refused?: boolean;
  refused_what?: string;
  refused_reason?: string;
  restrictions?: string[];
  observations?: string;
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Dados estruturados de um registro Sensorial */
export interface TypeDataSensorial {
  triggers?: string[];
  reaction?: string;
  strategy?: string;
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Dados estruturados de uma Anotação livre */
export interface TypeDataLivre {
  mention?: {
    enabled: boolean;
    professional_id?: string;
    professional_name?: string;
    note?: string;
  };
}

/** Union de todos os TypeData por tipo de registro */
export type RecordTypeData =
  | TypeDataComportamento
  | TypeDataConquista
  | TypeDataSono
  | TypeDataSaude
  | TypeDataAlimentacao
  | TypeDataSensorial
  | TypeDataLivre;

// ===== Anexos (RF-03) =====
export const ALLOWED_ATTACHMENT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export type AttachmentValidation =
  | { ok: true }
  | { ok: false; error: string };

// Magic byte signatures for allowed file types.
// file.type is set by the browser and trivially spoofable — reading the actual
// file header ensures a PDF isn't a disguised HTML/executable.
const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },        // %PDF
  { mime: "image/jpeg",      bytes: [0xff, 0xd8, 0xff] },               // JFIF/Exif SOI
  { mime: "image/png",       bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
];

async function checkMagicBytes(file: File): Promise<boolean> {
  const maxHeaderBytes = 8;
  const buf = await file.slice(0, maxHeaderBytes).arrayBuffer();
  const header = new Uint8Array(buf);
  return MAGIC_SIGNATURES.some(({ bytes, offset = 0 }) =>
    bytes.every((b, i) => header[offset + i] === b),
  );
}

export function validateAttachmentFile(file: File): AttachmentValidation {
  if (!ALLOWED_ATTACHMENT_MIME.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME)[number])) {
    return { ok: false, error: "Formato não suportado. Aceitos: PDF, JPG, PNG." };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, error: "Arquivo acima do limite de 10 MB." };
  }
  return { ok: true };
}

// Async version that also validates magic bytes — use before upload.
export async function validateAttachmentFileAsync(file: File): Promise<AttachmentValidation> {
  const basic = validateAttachmentFile(file);
  if (!basic.ok) return basic;
  const validHeader = await checkMagicBytes(file);
  if (!validHeader) {
    return { ok: false, error: "Conteúdo do arquivo não corresponde ao formato declarado." };
  }
  return { ok: true };
}

export interface PasswordChecks {
  length: boolean;
  letter: boolean;
  number: boolean;
  special: boolean;
}

// ===== Cuidado Compartilhado =====

export const CARE_RELATIONS = [
  'mae',
  'pai',
  'avo_materno',
  'avo_paterno',
  'tio',
  'cuidador',
  'outro',
] as const;

export type CareRelation = typeof CARE_RELATIONS[number];

export const CARE_RELATION_LABELS: Record<CareRelation, string> = {
  mae: 'Mãe',
  pai: 'Pai',
  avo_materno: 'Avó/Avô materno',
  avo_paterno: 'Avó/Avô paterno',
  tio: 'Tio/Tia',
  cuidador: 'Cuidador(a)',
  outro: 'Outro',
};

export const CARE_ROLES = ['admin', 'viewer'] as const;
export type CareRole = typeof CARE_ROLES[number];

export const CARE_ROLE_LABELS: Record<CareRole, string> = {
  admin: 'Administrador',
  viewer: 'Visualizador',
};

export const careInviteSchema = z.object({
  childId: z.string().uuid('Selecione uma criança.'),
  inviteeEmail: z.string().email('E-mail inválido.').max(255),
  alias: z.string().min(1, 'Informe como chamar essa pessoa.').max(80),
  relation: z.enum(CARE_RELATIONS, { message: 'Selecione a relação.' }),
  role: z.enum(CARE_ROLES).default('viewer'),
});

export type CareInviteInput = z.infer<typeof careInviteSchema>;

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

// ===== Terapeuta / Profissional de saúde =====

export const USER_TYPES = ['parent', 'therapist'] as const;
export type UserType = typeof USER_TYPES[number];

export const THERAPIST_SPECIALTIES = [
  'Psicólogo(a)',
  'Fonoaudiólogo(a)',
  'Terapeuta Ocupacional',
  'Fisioterapeuta',
  'Psicopedagogo(a)',
  'Neuropsicólogo(a)',
  'ABA Terapeuta',
  'Musicoterapeuta',
  'Neuropediatra',
  'Outro',
] as const;
export type TherapistSpecialty = typeof THERAPIST_SPECIALTIES[number];

export const COUNCIL_TYPES = [
  'CRP', 'CREFONO', 'CREFITO', 'CRM', 'CFFa', 'CFP', 'CREFITO', 'Outro',
] as const;
export type CouncilType = typeof COUNCIL_TYPES[number];

export const BR_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;
export type BRState = typeof BR_STATES[number];

export const therapistProfileSchema = z.object({
  specialty:     z.string().min(1, 'Selecione a especialidade.').max(80),
  councilType:   z.string().min(1, 'Selecione o conselho.').max(20),
  councilNumber: z.string().min(1, 'Informe o número do registro.').max(30),
  councilState:  z.string().length(2, 'Selecione o estado.'),
  bio:           z.string().max(500).optional(),
});
export type TherapistProfileInput = z.infer<typeof therapistProfileSchema>;

export const THERAPIST_INVITE_RELATIONS = [
  'mae', 'pai', 'avo_materno', 'avo_paterno', 'outro_responsavel',
] as const;
export type TherapistInviteRelation = typeof THERAPIST_INVITE_RELATIONS[number];

export const THERAPIST_INVITE_RELATION_LABELS: Record<TherapistInviteRelation, string> = {
  mae:               'Mãe',
  pai:               'Pai',
  avo_materno:       'Avó / Avô materno(a)',
  avo_paterno:       'Avó / Avô paterno(a)',
  outro_responsavel: 'Outro responsável',
};

export const therapistInviteSchema = z.object({
  childId:      z.string().uuid('Selecione um paciente.'),
  inviteeEmail: z.string().email('E-mail inválido.').max(255),
  alias:        z.string().min(1, 'Informe o nome do responsável.').max(80),
  relation:     z.enum(THERAPIST_INVITE_RELATIONS, { message: 'Selecione a relação.' }),
});
export type TherapistInviteInput = z.infer<typeof therapistInviteSchema>;

export const therapistPatientSchema = z.object({
  name:      z.string().trim().min(1, 'Informe o nome do paciente.').max(100),
  birthDate: z.string().min(1, 'Informe a data de nascimento.').refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.getTime()) && d <= new Date();
  }, 'Data inválida.'),
  diagnosis: z.string().max(200).optional(),
});
export type TherapistPatientInput = z.infer<typeof therapistPatientSchema>;

// ─── Onboarding — perguntas de perfil (chips) ─────────────────────────────────

export const ATTENDANCE_SETTINGS = ['particular', 'clinica', 'ambos'] as const;
export const ATTENDANCE_MODALITIES = ['presencial', 'online', 'ambos'] as const;
export const PATIENT_COUNT_RANGES = ['1-5', '6-10', '11-20', '20+'] as const;
export const WEEKLY_HOURS_RANGES = ['<10h', '10-20h', '20-30h', '30h+'] as const;

export const ATTENDANCE_SETTING_LABELS: Record<typeof ATTENDANCE_SETTINGS[number], string> = {
  particular: 'Consultório particular',
  clinica: 'Clínica ou instituição',
  ambos: 'Ambos',
};
export const ATTENDANCE_MODALITY_LABELS: Record<typeof ATTENDANCE_MODALITIES[number], string> = {
  presencial: 'Presencial',
  online: 'Online',
  ambos: 'Ambos',
};
export const PATIENT_COUNT_RANGE_LABELS: Record<typeof PATIENT_COUNT_RANGES[number], string> = {
  '1-5': '1 a 5',
  '6-10': '6 a 10',
  '11-20': '11 a 20',
  '20+': 'Mais de 20',
};
export const WEEKLY_HOURS_RANGE_LABELS: Record<typeof WEEKLY_HOURS_RANGES[number], string> = {
  '<10h': 'Menos de 10h',
  '10-20h': '10h a 20h',
  '20-30h': '20h a 30h',
  '30h+': 'Mais de 30h',
};

export const therapistProfileQuestionsSchema = z.object({
  attendanceSetting:  z.enum(ATTENDANCE_SETTINGS).optional(),
  attendanceModality: z.enum(ATTENDANCE_MODALITIES).optional(),
  patientCountRange:  z.enum(PATIENT_COUNT_RANGES).optional(),
  weeklyHoursRange:   z.enum(WEEKLY_HOURS_RANGES).optional(),
});
export type TherapistProfileQuestionsInput = z.infer<typeof therapistProfileQuestionsSchema>;

// ─── Onboarding — paciente com responsáveis ───────────────────────────────────

export const guardianSchema = z.object({
  name:  z.string().trim().min(1, 'Informe o nome do responsável.').max(80),
  email: z.string().trim().email('E-mail inválido.').optional().or(z.literal('')),
});
export type GuardianInput = z.infer<typeof guardianSchema>;

export const therapistPatientWithGuardiansSchema = z.object({
  name: z.string().trim().min(1, 'Informe o primeiro nome do paciente.').max(60),
  guardians: z
    .array(guardianSchema)
    .min(1, 'Informe ao menos um responsável.')
    .max(4, 'Máximo de 4 responsáveis.'),
});
export type TherapistPatientWithGuardiansInput = z.infer<typeof therapistPatientWithGuardiansSchema>;

// ─── Sessão — plano pré-sessão ────────────────────────────────────────────────

export const sessionPlanSchema = z.object({
  eventId:          z.string().uuid(),
  objectives:       z.string().max(1000).optional(),
  activities:       z.array(z.string().trim().max(200)).optional(),
  materials:        z.string().max(500).optional(),
  visibleToParents: z.boolean().default(true),
});
export type SessionPlanInput = z.infer<typeof sessionPlanSchema>;

// ─── Sessão — confirmação de comparecimento ───────────────────────────────────

export const SESSION_ATTENDANCES = ['happened', 'missed_justified', 'missed_no_show'] as const;
export type SessionAttendance = typeof SESSION_ATTENDANCES[number];

export const sessionConfirmSchema = z.object({
  eventId:               z.string().uuid(),
  attendance:            z.enum(SESSION_ATTENDANCES),
  actualDurationMinutes: z.number().int().min(1).max(480).optional(),
  actualStartAt:         z.string().optional(),
  absenceReason:         z.string().max(500).optional(),
  notifyFamily:          z.boolean().optional(),
});
export type SessionConfirmInput = z.infer<typeof sessionConfirmSchema>;

// ─── Sessão — registro pós-sessão (4 blocos) ──────────────────────────────────

export const ENGAGEMENT_LEVELS = ['baixo', 'medio', 'alto'] as const;
export type EngagementLevel = typeof ENGAGEMENT_LEVELS[number];

export const ENGAGEMENT_LEVEL_LABELS: Record<EngagementLevel, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
};

export const NOTABLE_BEHAVIOR_TYPES = [
  'conquista', 'dificuldade', 'regulacao', 'comunicacao', 'interacao_social', 'outro',
] as const;
export type NotableBehaviorType = typeof NOTABLE_BEHAVIOR_TYPES[number];

export const NOTABLE_BEHAVIOR_TYPE_LABELS: Record<NotableBehaviorType, string> = {
  conquista: 'Conquista',
  dificuldade: 'Dificuldade',
  regulacao: 'Regulação',
  comunicacao: 'Comunicação',
  interacao_social: 'Interação social',
  outro: 'Outro',
};

export const goalAchievedSchema = z.object({
  goal:     z.string().max(200),
  achieved: z.boolean(),
});

export const notableBehaviorSchema = z.object({
  description: z.string().trim().max(300),
  type:        z.enum(NOTABLE_BEHAVIOR_TYPES),
});

export const sessionRecordSchema = z.object({
  eventId: z.string().uuid(),
  // Bloco 1
  goalsAchieved:       z.array(goalAchievedSchema).optional(),
  whatWasDone:         z.string().max(2000).optional(),
  engagementLevel:     z.enum(ENGAGEMENT_LEVELS).optional(),
  // Bloco 2
  clinicalObservations: z.string().max(3000).optional(),
  notableBehaviors:    z.array(notableBehaviorSchema).optional(),
  isPrivate:           z.boolean().default(false),
  // Bloco 3
  familyInstruction:   z.string().max(2000).optional(),
  frequencySuggestion: z.string().max(200).optional(),
  // Bloco 4
  pointsToContinue:    z.string().max(1000).optional(),
  approachAdjustment:  z.string().max(1000).optional(),
  // Controle
  isDraft:             z.boolean().default(true),
});
export type SessionRecordInput = z.infer<typeof sessionRecordSchema>;
