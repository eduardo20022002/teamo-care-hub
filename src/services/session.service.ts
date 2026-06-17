// Wrappers de cliente para o rastreamento de sessão (painel admin de acesso).
// Fire-and-forget: nunca quebram a UX. Reusam o mesmo session_id do analytics.
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/analytics";
import {
  startSessionServer,
  heartbeatSessionServer,
  endSessionServer,
} from "@/lib/session-tracking.functions";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Cria/renova a linha de sessão (chamar no login e no mount do app autenticado). */
export async function startSession(): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return;
    await startSessionServer({ headers, data: { sessionId: getSessionId() } } as any);
  } catch {
    /* silencioso — telemetria não quebra a UX */
  }
}

/** Marca "visto por último" (chamar periodicamente enquanto o app está aberto). */
export async function heartbeatSession(): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return;
    await heartbeatSessionServer({ headers, data: { sessionId: getSessionId() } } as any);
  } catch {
    /* silencioso */
  }
}

/** Encerra a sessão no logout/idle. */
export async function endSession(reason: "logout" | "idle"): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return;
    await endSessionServer({ headers, data: { sessionId: getSessionId(), reason } } as any);
  } catch {
    /* silencioso */
  }
}
