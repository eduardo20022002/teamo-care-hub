import { supabase } from "@/integrations/supabase/client";
import type { Child, ChildInsert } from "@/types/database";
import type { ChildInput as ChildFormInput } from "@/lib/validation";

const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

const MOCK_CHILDREN: Child[] = DEV_BYPASS
  ? [
      {
        id: "mock-child-1",
        user_id: "00000000-0000-0000-0000-000000000001",
        name: "Lucas",
        birth_date: "2026-05-03",
        created_at: new Date().toISOString(),
      } as Child,
    ]
  : [];

export async function listChildren(): Promise<Child[]> {
  if (DEV_BYPASS) return MOCK_CHILDREN;
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createChild(
  userId: string,
  input: ChildFormInput,
): Promise<Child> {
  const payload: ChildInsert = {
    user_id: userId,
    name: input.name.trim(),
    birth_date: input.birth_date,
    diagnoses: input.diagnoses ?? [],
    relation: input.relation ?? null,
    created_by_type: "parent",
  };
  const { data, error } = await supabase
    .from("children")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteChild(id: string): Promise<void> {
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
