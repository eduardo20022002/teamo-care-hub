import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .regex(/[A-Za-z]/, "A senha deve conter ao menos uma letra.")
  .regex(/[0-9]/, "A senha deve conter ao menos um número.")
  .regex(/[^A-Za-z0-9]/, "A senha deve conter ao menos um caractere especial.");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .email("E-mail inválido.")
  .max(255);

export const signUpSchema = z
  .object({
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

export function validateAttachmentFile(file: File): AttachmentValidation {
  if (!ALLOWED_ATTACHMENT_MIME.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME)[number])) {
    return {
      ok: false,
      error: "Formato não suportado. Aceitos: PDF, JPG, PNG.",
    };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      ok: false,
      error: "Arquivo acima do limite de 10 MB.",
    };
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
    letter: /[A-Za-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}
