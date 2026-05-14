import { supabase } from "@/integrations/supabase/client";
import type { AuthEventType } from "@/types/database";
import { logAuthEventServer } from "@/lib/audit.functions";

/**
 * Registra evento de autenticação.
 *
 * Eventos de sucesso passam pela server function (autoridade única).
 * Eventos de falha de login (usuário ainda não autenticado) usam o cliente
 * com RLS restrita: somente `auth.login_failure` com user_id = null é aceito.
 *
 * Falhas de log não bloqueiam o fluxo do usuário.
 */
export async function logAuthEvent(
  userId: string | null,
  eventType: AuthEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    if (eventType === "auth.login_failure") {
      // Usuário não autenticado — único caminho aceito pela RLS de anon.
      const safeMetadata = { ...metadata };
      delete (safeMetadata as Record<string, unknown>).password;
      await supabase.from("audit_logs").insert({
        user_id: null,
        event_type: eventType,
        metadata: safeMetadata as never,
      });
      return;
    }
    // Demais eventos exigem servidor (RLS bloqueia insert autenticado).
    await logAuthEventServer({ data: { userId, eventType, metadata } });
  } catch {
    // intencionalmente silencioso — auditoria não deve quebrar a UX
  }
}
