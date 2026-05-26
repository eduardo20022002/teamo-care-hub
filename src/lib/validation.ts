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

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}
