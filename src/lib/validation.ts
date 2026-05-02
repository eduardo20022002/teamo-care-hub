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

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
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
