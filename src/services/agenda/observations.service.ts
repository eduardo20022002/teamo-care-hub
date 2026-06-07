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

export const MOCK_EVENT_ORIGIN: Record<
  string,
  { title: string; type: string; dateLabel: string }
> = DEV_BYPASS
  ? {
      "ev-2": { title: "Terapia ABA", type: "terapia", dateLabel: "Hoje" },
      "ev-fono-prev": {
        title: "Fonoaudiologia",
        type: "terapia",
        dateLabel: "Há 5 dias",
      },
      "ev-aee-prev": {
        title: "Reunião AEE",
        type: "escola",
        dateLabel: "Há 9 dias",
      },
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
  const { data, error } = await supabase
    .from("agenda_observations")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as AgendaObservation[];
}

/**
 * Observações pendentes apontando para um EVENTO específico (Tela 12).
 */
export async function listPendingObservationsByEvent(
  targetEventId: string,
): Promise<AgendaObservation[]> {
  if (DEV_BYPASS) {
    return targetEventId === "ev-3" ? MOCK_PENDING_FOR_EVENT_3 : [];
  }
  const { data, error } = await supabase
    .from("agenda_observations")
    .select("*")
    .eq("reminder_target_event_id", targetEventId)
    .eq("reminder_enabled", true)
    .eq("reminder_dismissed", false)
    .is("promoted_to_record_id", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as AgendaObservation[];
}

/**
 * Observações pendentes apontando para um PROFISSIONAL (Tela 13).
 */
export async function listPendingObservationsByProfessional(
  professionalId: string,
): Promise<AgendaObservation[]> {
  if (DEV_BYPASS) {
    return professionalId === "prof-carla" ? MOCK_PENDING_FOR_EVENT_3 : [];
  }
  const { data, error } = await supabase
    .from("agenda_observations")
    .select("*")
    .eq("reminder_target_professional_id", professionalId)
    .eq("reminder_enabled", true)
    .eq("reminder_dismissed", false)
    .is("promoted_to_record_id", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as AgendaObservation[];
}

export async function dismissAllByProfessional(
  professionalId: string,
): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_observations")
    .update({ reminder_dismissed: true })
    .eq("reminder_target_professional_id", professionalId)
    .eq("reminder_dismissed", false);
  if (error) throw new Error(mapError(error.message));
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
    reminder_target_professional_id:
      input.reminder_target_professional_id ?? null,
    reminder_fire_at: input.reminder_fire_at ?? null,
  };
  const { data, error } = await supabase
    .from("agenda_observations")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  return data as unknown as AgendaObservation;
}

export async function dismissObservation(observationId: string): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_observations")
    .update({ reminder_dismissed: true })
    .eq("id", observationId);
  if (error) throw new Error(mapError(error.message));
}

/** Edita o texto de uma observação. RLS garante que só o dono altera. */
export async function updateObservation(
  observationId: string,
  text: string,
): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_observations")
    .update({ text: text.trim(), updated_at: new Date().toISOString() })
    .eq("id", observationId);
  if (error) throw new Error(mapError(error.message));
}

/**
 * Marca uma observação como promovida a um attendance_record.
 * Mantém o vínculo bi-direcional pra evitar duplicações.
 */
export async function markObservationPromoted(
  observationId: string,
  recordId: string,
): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_observations")
    .update({ promoted_to_record_id: recordId })
    .eq("id", observationId);
  if (error) throw new Error(mapError(error.message));
}
