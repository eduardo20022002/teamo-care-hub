import { supabase } from "@/integrations/supabase/client";
import type { AuthEventType } from "@/types/database";

/**
 * Registra evento de autenticação. Nunca persiste senhas.
 * Falhas de log não bloqueiam o fluxo do usuário.
 */
export async function logAuthEvent(
  userId: string | null,
  eventType: AuthEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const safeMetadata = { ...metadata };
    delete (safeMetadata as Record<string, unknown>).password;
    await supabase.from("audit_logs").insert({
      user_id: userId,
      event_type: eventType,
      metadata: safeMetadata as never,
    });
  } catch {
    // intencionalmente silencioso — auditoria não deve quebrar a UX
  }
}
