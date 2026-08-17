// Helpers server-only de autorização/isolamento de tenant do módulo de Clínicas.
// Centraliza a checagem de vínculo do usuário com a clínica (clinic_members),
// que estava copiada literalmente em ~30 pontos (issue #7 / ADR-003).
//
// Este arquivo NUNCA é importado por código cliente — apenas por *.functions.ts.
//
// Uso:
//   const member = await getClinicMembership(clinicId, userId); // não lança
//   if (!member) return { ok: false, error: "..." };            // caller decide
//   // ou, quando o contrato do handler é lançar 403:
//   await assertClinicMember(clinicId, userId);
//   await assertClinicCoordinator(clinicId, userId);
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ClinicMembership {
  role: string;
}

/**
 * Vínculo ATIVO do usuário com a clínica (joined_at não-nulo), ou null.
 * É a query única que decide isolamento de tenant — mantê-la num só lugar evita
 * que uma cópia divirja e vaze dado entre clínicas (ADR-003, LGPD art. 11).
 */
export async function getClinicMembership(
  clinicId: string,
  userId: string,
): Promise<ClinicMembership | null> {
  const { data } = await supabaseAdmin
    .from("clinic_members")
    .select("role")
    .eq("clinic_id", clinicId)
    .eq("user_id", userId)
    .not("joined_at", "is", null)
    .maybeSingle();
  return data ? { role: (data as { role: string }).role } : null;
}

/** Exige vínculo ativo com a clínica; lança Response 403 se não houver. */
export async function assertClinicMember(
  clinicId: string,
  userId: string,
): Promise<ClinicMembership> {
  const member = await getClinicMembership(clinicId, userId);
  if (!member) throw new Response("Sem acesso.", { status: 403 });
  return member;
}

/** Exige papel de coordinator na clínica; lança Response 403 caso contrário. */
export async function assertClinicCoordinator(
  clinicId: string,
  userId: string,
): Promise<ClinicMembership> {
  const member = await getClinicMembership(clinicId, userId);
  if (member?.role !== "coordinator") {
    throw new Response("Sem acesso.", { status: 403 });
  }
  return member;
}
