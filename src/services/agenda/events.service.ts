import { supabase } from "@/integrations/supabase/client";
import type {
  AgendaEvent,
  AgendaEventInsert,
  AgendaEventWithRelations,
} from "@/types/agenda";
import type { AgendaEventInput } from "@/lib/agenda/validation";
import { combineDateTime } from "@/lib/agenda/format";

const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

// Mock pra preview do design no localhost com bypass — datas relativas a hoje
// pra que os grupos "Hoje", "Amanhã" etc apareçam dinamicamente.
function mockToday(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function mockOffset(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const MOCK_CHILD_ID = "mock-child-1";
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000001";

const MOCK_EVENTS: AgendaEventWithRelations[] = DEV_BYPASS
  ? [
      {
        id: "ev-1",
        user_id: MOCK_USER_ID,
        child_id: MOCK_CHILD_ID,
        type: "medicacao",
        title: "Risperidona — 0,5mg",
        professional_id: null,
        professional_name_raw: "Dose recorrente",
        start_at: mockToday(8, 0),
        end_at: null,
        locale: null,
        recurrence: { freq: "daily" },
        reminders: { oneDayBefore: false, oneHourBefore: false },
        status: "upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type_data: {},
        linked_event_id: null,
        child: { id: MOCK_CHILD_ID, name: "Lucas" },
        professional: null,
      },
      {
        id: "ev-2",
        user_id: MOCK_USER_ID,
        child_id: MOCK_CHILD_ID,
        type: "terapia",
        title: "Terapia ABA",
        professional_id: null,
        professional_name_raw: "Dra. Mariana Silva",
        start_at: mockToday(14, 0),
        end_at: mockToday(15, 0),
        locale: "Clínica Acolher",
        recurrence: { freq: "weekly", daysOfWeek: [new Date().getDay()] },
        reminders: { oneDayBefore: true, oneHourBefore: true },
        status: "upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type_data: {},
        linked_event_id: null,
        child: { id: MOCK_CHILD_ID, name: "Lucas" },
        professional: null,
        observation_count: 2,
        attachment_count: 1,
      },
      {
        id: "ev-3",
        user_id: MOCK_USER_ID,
        child_id: MOCK_CHILD_ID,
        type: "consulta",
        title: "Retorno neuropediatra",
        professional_id: null,
        professional_name_raw: "Dra. Carla Mendes",
        start_at: mockToday(16, 30),
        end_at: mockToday(17, 0),
        locale: null,
        recurrence: { freq: "none" },
        reminders: { oneDayBefore: true, oneHourBefore: true },
        status: "upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type_data: {},
        linked_event_id: null,
        child: { id: MOCK_CHILD_ID, name: "Lucas" },
        professional: null,
        observation_count: 3,
      },
      {
        id: "ev-4",
        user_id: MOCK_USER_ID,
        child_id: MOCK_CHILD_ID,
        type: "terapia",
        title: "Fonoaudiologia",
        professional_id: null,
        professional_name_raw: "Dr. Felipe Andrade",
        start_at: mockOffset(1, 10, 0),
        end_at: mockOffset(1, 11, 0),
        locale: "Clínica Voz",
        recurrence: { freq: "weekly" },
        reminders: { oneDayBefore: true, oneHourBefore: true },
        status: "upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type_data: {},
        linked_event_id: null,
        child: { id: MOCK_CHILD_ID, name: "Lucas" },
        professional: null,
      },
      {
        id: "ev-5",
        user_id: MOCK_USER_ID,
        child_id: MOCK_CHILD_ID,
        type: "escola",
        title: "Reunião AEE",
        professional_id: null,
        professional_name_raw: "Prof. Ana Beatriz",
        start_at: mockOffset(2, 8, 0),
        end_at: mockOffset(2, 9, 0),
        locale: "Escola Vivência",
        recurrence: { freq: "none" },
        reminders: { oneDayBefore: true, oneHourBefore: true },
        status: "upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type_data: {},
        linked_event_id: null,
        child: { id: MOCK_CHILD_ID, name: "Lucas" },
        professional: null,
      },
      {
        id: "ev-6",
        user_id: MOCK_USER_ID,
        child_id: MOCK_CHILD_ID,
        type: "terapia",
        title: "Terapia ABA",
        professional_id: null,
        professional_name_raw: "Dra. Mariana Silva",
        start_at: mockOffset(7, 14, 0),
        end_at: mockOffset(7, 15, 0),
        locale: null,
        recurrence: { freq: "weekly" },
        reminders: { oneDayBefore: true, oneHourBefore: true },
        status: "upcoming",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type_data: {},
        linked_event_id: null,
        child: { id: MOCK_CHILD_ID, name: "Lucas" },
        professional: null,
      },
    ]
  : [];

// ─── TherapistSessionInput — usado por TherapistEventFormSheet ────────────────
export interface TherapistSessionInput {
  childId: string;
  childName: string;
  sessionType: "individual" | "grupo" | "familiar";
  date: string;           // "YYYY-MM-DD"
  startTime: string;      // "HH:MM"
  durationMinutes: number;
  recurrence: "none" | "weekly" | "biweekly" | "monthly";
  daysOfWeek: number[];   // 0=Dom .. 6=Sáb (usados quando recurrence = weekly/biweekly)
  locale: string;
}

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  grupo: "Em grupo",
  familiar: "Familiar",
};

function mapError(message: string): string {
  if (/network|failed to fetch/i.test(message)) {
    return "Sem conexão com o servidor. Tente novamente.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

const SELECT_WITH_RELATIONS =
  "*, child:children(id, name), professional:professionals(id, name)";

export async function listAgendaEvents(): Promise<AgendaEventWithRelations[]> {
  if (DEV_BYPASS) return MOCK_EVENTS;
  const { data, error } = await supabase
    .from("agenda_events")
    .select(SELECT_WITH_RELATIONS)
    .order("start_at", { ascending: true });
  if (error) throw new Error(mapError(error.message));
  return (data ?? []) as unknown as AgendaEventWithRelations[];
}

export async function createAgendaEvent(
  userId: string,
  input: AgendaEventInput,
): Promise<AgendaEvent> {
  if (DEV_BYPASS) {
    throw new Error(
      "Modo preview: não é possível criar compromissos sem sessão real.",
    );
  }
  const startAt = combineDateTime(input.date, input.start_time);
  const endAt = input.end_time
    ? combineDateTime(input.date, input.end_time)
    : null;

  // Separa campos auxiliares de Consulta (returnDate/returnTime) — não vão
  // para o JSONB persistido; servem só para criar o evento vinculado.
  const typeData = input.type_data;
  let storedTypeData: Record<string, unknown> = typeData;
  let returnSpec: { date: string; time: string } | null = null;
  if (typeData.kind === "consulta") {
    const { returnDate, returnTime, ...rest } = typeData;
    storedTypeData = rest;
    if (typeData.returnScheduled && returnDate && returnTime) {
      returnSpec = { date: returnDate, time: returnTime };
    }
  }

  const payload: AgendaEventInsert = {
    user_id: userId,
    child_id: input.child_id,
    type: input.type,
    title: input.title.trim(),
    professional_id: input.professional_id ?? null,
    professional_name_raw: input.professional_name_raw?.trim() || null,
    start_at: startAt,
    end_at: endAt,
    locale: input.locale?.trim() || null,
    recurrence: input.recurrence,
    reminders: input.reminders,
    type_data: storedTypeData,
  };
  const { data, error } = await supabase
    .from("agenda_events")
    // recurrence/reminders/type_data são JSONB no schema — TS gera tipo Json
    // estrito; o payload já tem o shape correto.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(payload as any)
    .select()
    .single();
  if (error) throw new Error(mapError(error.message));
  const created = data as unknown as AgendaEvent;

  // Retorno vinculado (consulta) — best effort. Falha aqui não invalida o
  // evento principal já criado; apenas mostra o erro pra mãe decidir.
  if (returnSpec) {
    const retornoTitle =
      input.title.trim().toLowerCase().startsWith("retorno")
        ? input.title.trim()
        : `Retorno — ${input.title.trim()}`;
    const retornoPayload: AgendaEventInsert = {
      user_id: userId,
      child_id: input.child_id,
      type: "consulta",
      title: retornoTitle.slice(0, 120),
      professional_id: input.professional_id ?? null,
      professional_name_raw: input.professional_name_raw?.trim() || null,
      start_at: combineDateTime(returnSpec.date, returnSpec.time),
      end_at: null,
      locale: input.locale?.trim() || null,
      recurrence: { freq: "once" },
      reminders: input.reminders,
      type_data: {
        kind: "consulta",
        consultType: "followup",
        specialty:
          typeData.kind === "consulta" ? typeData.specialty : "other",
        documentsChecklist: [],
        returnScheduled: false,
      },
      linked_event_id: created.id,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("agenda_events").insert(retornoPayload as any);
  }

  return created;
}

/**
 * Gera as datas de ocorrência para uma sessão recorrente.
 * - weekly:   até 12 ocorrências (≈3 meses)
 * - biweekly: até 6 ocorrências  (≈3 meses)
 * - monthly:  até 6 ocorrências  (≈6 meses)
 *
 * Para "weekly" com múltiplos `daysOfWeek`, cada combinação
 * semana×dia gera uma ocorrência separada.
 */
function computeOccurrenceDates(
  firstDate: Date,
  recurrence: "weekly" | "biweekly" | "monthly",
  daysOfWeek: number[],
): Date[] {
  const h = firstDate.getHours();
  const m = firstDate.getMinutes();

  if (recurrence === "weekly") {
    const selectedDays = daysOfWeek.length ? daysOfWeek : [firstDate.getDay()];
    const dates: Date[] = [];
    for (let week = 0; week < 12; week++) {
      for (const day of selectedDays) {
        const diff = (day - firstDate.getDay() + 7) % 7 + week * 7;
        const d = new Date(firstDate);
        d.setDate(d.getDate() + diff);
        d.setHours(h, m, 0, 0);
        if (d >= firstDate) dates.push(d);
      }
    }
    return dates.sort((a, b) => a.getTime() - b.getTime());
  }

  if (recurrence === "biweekly") {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(firstDate);
      d.setDate(d.getDate() + i * 14);
      d.setHours(h, m, 0, 0);
      return d;
    });
  }

  // monthly
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(firstDate);
    d.setMonth(d.getMonth() + i);
    d.setHours(h, m, 0, 0);
    return d;
  });
}

export async function createTherapistSession(
  userId: string,
  input: TherapistSessionInput,
): Promise<AgendaEvent> {
  if (DEV_BYPASS) {
    throw new Error("Modo preview: operação indisponível.");
  }

  const startAt = combineDateTime(input.date, input.startTime);
  const startDateObj = new Date(startAt);
  const durationMs = input.durationMinutes * 60 * 1000;

  const typeLabel = SESSION_TYPE_LABELS[input.sessionType] ?? "Sessão";
  const title = `${input.childName} — ${typeLabel}`;

  type RecurrencePayload =
    | { freq: "none" }
    | { freq: "weekly"; daysOfWeek: number[] }
    | { freq: "biweekly"; dayOfWeek: number }
    | { freq: "monthly" };

  let recurrencePayload: RecurrencePayload;
  if (input.recurrence === "weekly") {
    recurrencePayload = { freq: "weekly", daysOfWeek: input.daysOfWeek.length ? input.daysOfWeek : [startDateObj.getDay()] };
  } else if (input.recurrence === "biweekly") {
    recurrencePayload = { freq: "biweekly", dayOfWeek: input.daysOfWeek[0] ?? startDateObj.getDay() };
  } else if (input.recurrence === "monthly") {
    recurrencePayload = { freq: "monthly" };
  } else {
    recurrencePayload = { freq: "none" };
  }

  const basePayload = {
    user_id: userId,
    child_id: input.childId,
    therapist_id: userId,
    session_type: input.sessionType,
    type: "terapia" as const,
    title: title.slice(0, 120),
    professional_id: null,
    professional_name_raw: null,
    locale: input.locale.trim() || null,
    recurrence: recurrencePayload,
    reminders: { oneDayBefore: false, oneHourBefore: false },
    type_data: { kind: "terapia" },
  };

  // Sessão sem recorrência — insere linha única (comportamento original)
  if (input.recurrence === "none") {
    const { data, error } = await supabase
      .from("agenda_events")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        ...basePayload,
        start_at: startAt,
        end_at: new Date(startDateObj.getTime() + durationMs).toISOString(),
      } as any)
      .select()
      .single();
    if (error) throw new Error(mapError(error.message));
    return data as unknown as AgendaEvent;
  }

  // Sessão recorrente — insere uma linha por ocorrência
  const occurrenceDates = computeOccurrenceDates(
    startDateObj,
    input.recurrence,
    input.daysOfWeek,
  );

  const rows = occurrenceDates.map((occDate) => ({
    ...basePayload,
    start_at: occDate.toISOString(),
    end_at: new Date(occDate.getTime() + durationMs).toISOString(),
  }));

  const { data, error } = await supabase
    .from("agenda_events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(rows as any)
    .select();
  if (error) throw new Error(mapError(error.message));

  // Retorna a primeira ocorrência (a mais próxima)
  return (data as unknown as AgendaEvent[])[0];
}

export async function deleteAgendaEvent(id: string): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_events")
    .delete()
    .eq("id", id);
  if (error) throw new Error(mapError(error.message));
}

import type { AgendaEventStatus } from "@/types/agenda";

export async function updateAgendaEventStatus(
  id: string,
  status: AgendaEventStatus,
): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_events")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(mapError(error.message));
}
