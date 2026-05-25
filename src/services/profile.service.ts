import { supabase } from "@/integrations/supabase/client";

export interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  birth_date: string | null;
  created_at: string;
  is_admin: boolean;
}

export interface ChildWithCounts {
  id: string;
  name: string;
  birth_date: string;
  relation: string | null;
  registros_count: number;
  profissionais_count: number;
}

export async function getProfile(userId: string): Promise<ProfileData> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, birth_date, created_at, is_admin")
    .eq("id", userId)
    .single();

  if (error) throw new Error(error.message);
  return data as ProfileData;
}

export async function updateProfile(
  userId: string,
  patch: { full_name?: string; phone?: string; birth_date?: string },
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

export async function updateChildRelation(
  childId: string,
  relation: string,
): Promise<void> {
  const { error } = await supabase
    .from("children")
    .update({ relation })
    .eq("id", childId);

  if (error) throw new Error(error.message);
}

export async function getChildrenWithCounts(
  userId: string,
): Promise<ChildWithCounts[]> {
  // Fetch children
  const { data: children, error: childErr } = await supabase
    .from("children")
    .select("id, name, birth_date, relation")
    .eq("user_id", userId)
    .order("created_at");

  if (childErr) throw new Error(childErr.message);
  if (!children || children.length === 0) return [];

  // Count professionals for this user (same for all children in this account)
  const { count: profCount } = await supabase
    .from("professionals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Count records per child in parallel
  const withCounts = await Promise.all(
    children.map(async (child) => {
      const { count: recCount } = await supabase
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("child_id", child.id);

      return {
        ...child,
        registros_count: recCount ?? 0,
        profissionais_count: profCount ?? 0,
      };
    }),
  );

  return withCounts;
}
