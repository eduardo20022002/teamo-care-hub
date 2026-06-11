// Header de autorização para chamadas de ServerFn protegidas por requireSupabaseAuth.
// O middleware do servidor exige `Authorization: Bearer <token>`; não há attacher
// global registrado, então cada call site passa `headers: await authHeaders()`.
import { supabase } from "@/integrations/supabase/client";

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
