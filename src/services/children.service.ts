import { supabase } from "@/integrations/supabase/client";
import type { Child, ChildInsert } from "@/types/database";
import type { ChildInput as ChildFormInput } from "@/lib/validation";

export async function listChildren(): Promise<Child[]> {
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
