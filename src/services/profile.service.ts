import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  birth_date: string | null;
  created_at: string;
  is_admin: boolean;
  user_type: "parent" | "therapist";
  secondary_role: "parent" | "therapist" | null;
}

export interface ChildWithCounts {
  id: string;
  name: string;
  birth_date: string;
  relation: string | null;
  registros_count: number;
  profissionais_count: number;
}

export interface ProfilePatch {
  full_name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
}

// ─── Validators ──────────────────────────────────────────────────────────────
const FULL_NAME_MAX = 120;
const PHONE_MAX = 32;

function sanitizeFullName(v: string | null | undefined): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > FULL_NAME_MAX)
    throw new Error(`Nome deve ter no máximo ${FULL_NAME_MAX} caracteres.`);
  return trimmed;
}

function sanitizePhone(v: string | null | undefined): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > PHONE_MAX)
    throw new Error(`Telefone deve ter no máximo ${PHONE_MAX} caracteres.`);
  // Permite dígitos, espaço, +, -, (), .
  if (!/^[\d\s+\-().]+$/.test(trimmed)) throw new Error("Telefone contém caracteres inválidos.");
  return trimmed;
}

function sanitizeBirthDate(v: string | null | undefined): string | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  // Formato YYYY-MM-DD esperado do <input type="date">
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new Error("Data de nascimento inválida.");
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) throw new Error("Data de nascimento inválida.");
  if (d > new Date()) throw new Error("Data de nascimento não pode ser no futuro.");
  return trimmed;
}

function sanitizeRelation(v: string): string {
  const trimmed = v.trim();
  if (!trimmed) throw new Error("Selecione uma relação.");
  if (trimmed.length > 32) throw new Error("Relação deve ter no máximo 32 caracteres.");
  return trimmed;
}

// ─── Queries ─────────────────────────────────────────────────────────────────
export async function getProfile(userId: string): Promise<ProfileData> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, birth_date, created_at, is_admin, user_type, secondary_role")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data as ProfileData;
}

/**
 * Defesa em profundidade: monta o payload explicitamente, ignorando
 * quaisquer outras chaves que possam ter sido injetadas no patch.
 * Importante porque a RLS de profiles permite update em qualquer campo —
 * sem isto, um chamador malicioso poderia tentar definir is_admin = true.
 */
export async function updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const safe: TablesUpdate<"profiles"> = {};
  if ("full_name" in patch) safe.full_name = sanitizeFullName(patch.full_name);
  if ("phone" in patch) safe.phone = sanitizePhone(patch.phone);
  if ("birth_date" in patch) safe.birth_date = sanitizeBirthDate(patch.birth_date);

  if (Object.keys(safe).length === 0) return;

  const { error } = await supabase.from("profiles").update(safe).eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function updateChildRelation(childId: string, relation: string): Promise<void> {
  const safe = sanitizeRelation(relation);
  const { error } = await supabase.from("children").update({ relation: safe }).eq("id", childId);

  if (error) throw new Error(error.message);
}

export async function getChildrenWithCounts(userId: string): Promise<ChildWithCounts[]> {
  const { data: children, error: childErr } = await supabase
    .from("children")
    .select("id, name, birth_date, relation")
    .eq("user_id", userId)
    .order("created_at");

  if (childErr) throw new Error(childErr.message);
  if (!children || children.length === 0) return [];

  // Para cada criança: contagem de registros + profissionais distintos que
  // já atenderam essa criança (via attendance_records.professional_id).
  const withCounts = await Promise.all(
    children.map(async (child) => {
      const [{ count: recCount }, { data: recsForProfs }] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("*", { count: "exact", head: true })
          .eq("child_id", child.id),
        supabase
          .from("attendance_records")
          .select("professional_id")
          .eq("child_id", child.id)
          .not("professional_id", "is", null),
      ]);

      const distinctProfs = new Set(
        (recsForProfs ?? []).map((r) => r.professional_id).filter((id): id is string => !!id),
      );

      return {
        ...child,
        registros_count: recCount ?? 0,
        profissionais_count: distinctProfs.size,
      };
    }),
  );

  return withCounts;
}
