import { supabase } from "@/integrations/supabase/client";
import type {
  Professional,
  ProfessionalInsert,
  ProfessionalUpdate,
} from "@/types/database";
import type { ProfessionalInput } from "@/lib/validation";

function normalizePhone(phone: string | undefined): string | null {
  const trimmed = (phone ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function mapError(message: string): string {
  if (/duplicate key|unique/i.test(message)) {
    return "Já existe um profissional cadastrado com este e-mail.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function listProfessionals(): Promise<Professional[]> {
  const { data, error } = await supabase
    .from("professionals")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(mapError(error.message));
  return data ?? [];
}

export async function createProfessional(
  userId: string,
  input: ProfessionalInput,
): Promise<Professional> {
  const payload: ProfessionalInsert = {
    user_id: userId,
    name: input.name.trim(),
    specialty: input.specialty.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
  };
  const { data, error } = await supabase
    .from("professionals")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data;
}

export async function updateProfessional(
  id: string,
  input: ProfessionalInput,
): Promise<Professional> {
  const payload: ProfessionalUpdate = {
    name: input.name.trim(),
    specialty: input.specialty.trim(),
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
  };
  const { data, error } = await supabase
    .from("professionals")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data;
}

export async function deleteProfessional(id: string): Promise<void> {
  const { error } = await supabase.from("professionals").delete().eq("id", id);
  if (error) throw new Error(mapError(error.message));
}
