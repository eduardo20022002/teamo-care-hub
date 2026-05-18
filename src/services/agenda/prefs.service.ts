import { supabase } from "@/integrations/supabase/client";
import type { AgendaNotificationPrefs } from "@/types/agenda";

const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

// Em DEV bypass mantemos as prefs em memória para o ciclo da página.
let mockPrefs: AgendaNotificationPrefs | null = DEV_BYPASS
  ? {
      user_id: MOCK_USER_ID,
      one_day_before: true,
      one_hour_before: true,
      pending_observations: true,
      post_event_register: false,
      onboarding_completed: false,
      updated_at: new Date().toISOString(),
    }
  : null;

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function getNotificationPrefs(
  userId: string,
): Promise<AgendaNotificationPrefs | null> {
  if (DEV_BYPASS) return mockPrefs;
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{
              data: AgendaNotificationPrefs | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("agenda_notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(mapError(error.message));
  return data;
}

export interface NotificationPrefsInput {
  one_day_before: boolean;
  one_hour_before: boolean;
  pending_observations: boolean;
  post_event_register: boolean;
  onboarding_completed?: boolean;
}

export async function upsertNotificationPrefs(
  userId: string,
  input: NotificationPrefsInput,
): Promise<AgendaNotificationPrefs> {
  if (DEV_BYPASS) {
    mockPrefs = {
      user_id: userId,
      ...input,
      onboarding_completed: input.onboarding_completed ?? mockPrefs?.onboarding_completed ?? false,
      updated_at: new Date().toISOString(),
    };
    return mockPrefs;
  }
  const payload = { user_id: userId, ...input };
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        upsert: (p: typeof payload, opts: { onConflict: string }) => {
          select: () => {
            single: () => Promise<{
              data: AgendaNotificationPrefs | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("agenda_notification_prefs")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data as AgendaNotificationPrefs;
}
