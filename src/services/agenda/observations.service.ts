import { supabase } from "@/integrations/supabase/client";
import type {
  AgendaObservation,
  AgendaObservationInsert,
} from "@/types/agenda";
import type { AgendaObservationInput } from "@/lib/agenda/validation";

const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

function mockHoursAgo(h: number): string {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}
function mockDaysAgo(days: number, hour = 14, minute = 50): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

// Mocks só para preview do detalhe — observações ancoradas ao evento "ev-2"
// (Terapia ABA de hoje) com obs antigas pra mostrar relative dates.
const MOCK_OBSERVATIONS_BY_EVENT: Record<string, AgendaObservation[]> = DEV_BYPASS
  ? {
      "ev-2": [
        {
          id: "obs-1",
          user_id: MOCK_USER_ID,
          event_id: "ev-2",
          text: "Lucas respondeu sozinho às perguntas pela primeira vez. Ficou bem confortável com a Dra. Mariana.",
          reminder_enabled: true,
          reminder_target_professional_id: "prof-carla",
          reminder_target_event_id: "ev-3",
          reminder_fire_at: mockHoursAgo(-2),
          reminder_dismissed: false,
          promoted_to_record_id: null,
          created_at: mockHoursAgo(2),
          updated_at: mockHoursAgo(2),
        },
        {
          id: "obs-2",
          user_id: MOCK_USER_ID,
          event_id: "ev-2",
          text: "Perguntar se podemos aumentar a frequência para 2x por semana.",
          reminder_enabled: false,
          reminder_target_professional_id: null,
          reminder_target_event_id: null,
          reminder_fire_at: null,
          reminder_dismissed: false,
          promoted_to_record_id: null,
          created_at: mockDaysAgo(7, 14, 50),
          updated_at: mockDaysAgo(7, 14, 50),
        },
        {
          id: "obs-3",
          user_id: MOCK_USER_ID,
          event_id: "ev-2",
          text: "Trouxe carrinho favorito para ajudar na transição da sala de espera. Funcionou muito bem.",
          reminder_enabled: false,
          reminder_target_professional_id: null,
          reminder_target_event_id: null,
          reminder_fire_at: null,
          reminder_dismissed: false,
          promoted_to_record_id: null,
          created_at: mockDaysAgo(14, 14, 30),
          updated_at: mockDaysAgo(14, 14, 30),
        },
      ],
      "ev-3": [],
    }
  : {};

// Pendentes apontando para "Dra. Carla" (Retorno neuropediatra = ev-3).
const MOCK_PENDING_FOR_EVENT_3: AgendaObservation[] = DEV_BYPASS
  ? [
      {
        id: "obs-1",
        user_id: MOCK_USER_ID,
        event_id: "ev-2",
        text: "Lucas respondeu sozinho às perguntas pela primeira vez. Ficou bem confortável com a Dra. Mariana.",
        reminder_enabled: true,
        reminder_target_professional_id: "prof-carla",
        reminder_target_event_id: "ev-3",
        reminder_fire_at: mockHoursAgo(-2),
        reminder_dismissed: false,
        promoted_to_record_id: null,
        created_at: mockHoursAgo(2),
        updated_at: mockHoursAgo(2),
      },
      {
        id: "obs-fono",
        user_id: MOCK_USER_ID,
        event_id: "ev-fono-prev",
        text: "Dr. Felipe sugeriu testar acompanhamento conjunto. Confirmar viabilidade.",
        reminder_enabled: true,
        reminder_target_professional_id: "prof-carla",
        reminder_target_event_id: "ev-3",
        reminder_fire_at: mockHoursAgo(-2),
        reminder_dismissed: false,
        promoted_to_record_id: null,
        created_at: mockDaysAgo(5, 10, 0),
        updated_at: mockDaysAgo(5, 10, 0),
      },
      {
        id: "obs-aee",
        user_id: MOCK_USER_ID,
        event_id: "ev-aee-prev",
        text: "Prof. Ana Beatriz relatou episódio de auto-regulação durante recreio. Vale comentar.",
        reminder_enabled: true,
        reminder_target_professional_id: "prof-carla",
        reminder_target_event_id: "ev-3",
        reminder_fire_at: mockHoursAgo(-2),
        reminder_dismissed: false,
        promoted_to_record_id: null,
        created_at: mockDaysAgo(9, 8, 30),
        updated_at: mockDaysAgo(9, 8, 30),
      },
    ]
  : [];

// Origem dos eventos referenciados pelos mocks pendentes (pra mostrar "Terapia ABA · 17/05" etc.)
export const MOCK_EVENT_ORIGIN: Record<string, { title: string; type: string; dateLabel: string }> = DEV_BYPASS
  ? {
      "ev-2": { title: "Terapia ABA", type: "terapia", dateLabel: "Hoje" },
      "ev-fono-prev": { title: "Fonoaudiologia", type: "terapia", dateLabel: "Há 5 dias" },
      "ev-aee-prev": { title: "Reunião AEE", type: "escola", dateLabel: "Há 9 dias" },
    }
  : {};

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function listObservationsByEvent(
  eventId: string,
): Promise<AgendaObservation[]> {
  if (DEV_BYPASS) return MOCK_OBSERVATIONS_BY_EVENT[eventId] ?? [];
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => Promise<{
              data: AgendaObservation[] | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("agenda_observations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return data ?? [];
}

/**
 * Observações ainda pendentes (reminder ativo, não dispensadas, não viradas
 * em registro) que apontam pra um evento específico.
 * Usado pela Tela 12 (variante pré-consulta).
 */
export async function listPendingObservationsByEvent(
  targetEventId: string,
): Promise<AgendaObservation[]> {
  if (DEV_BYPASS) {
    return targetEventId === "ev-3" ? MOCK_PENDING_FOR_EVENT_3 : [];
  }
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: boolean) => {
              eq: (c: string, v: boolean) => {
                is: (c: string, v: null) => {
                  order: (c: string, o: { ascending: boolean }) => Promise<{
                    data: AgendaObservation[] | null;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        };
      };
    }
  )
    .from("agenda_observations")
    .select("*")
    .eq("reminder_target_event_id", targetEventId)
    .eq("reminder_enabled", true)
    .eq("reminder_dismissed", false)
    .is("promoted_to_record_id", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(mapError(error.message));
  return data ?? [];
}

export async function createObservation(
  userId: string,
  input: AgendaObservationInput,
): Promise<AgendaObservation> {
  if (DEV_BYPASS) {
    throw new Error(
      "Modo preview: não é possível criar observações sem sessão real.",
    );
  }
  const payload: AgendaObservationInsert = {
    user_id: userId,
    event_id: input.event_id,
    text: input.text.trim(),
    reminder_enabled: input.reminder_enabled,
    reminder_target_professional_id: input.reminder_target_professional_id ?? null,
    reminder_fire_at: input.reminder_fire_at ?? null,
  };
  const { data, error } = await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (p: AgendaObservationInsert) => {
          select: () => {
            single: () => Promise<{
              data: AgendaObservation | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    }
  )
    .from("agenda_observations")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data as AgendaObservation;
}

export async function dismissObservation(observationId: string): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await (
    supabase as unknown as {
      from: (t: string) => {
        update: (p: { reminder_dismissed: boolean }) => {
          eq: (
            c: string,
            v: string,
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .from("agenda_observations")
    .update({ reminder_dismissed: true })
    .eq("id", observationId);
  if (error) throw new Error(mapError(error.message));
}
