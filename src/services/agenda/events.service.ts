import { supabase } from "@/integrations/supabase/client";
import type {
  AgendaEvent,
  AgendaEventInsert,
  AgendaEventWithRelations,
  RecurrenceConfig,
} from "@/types/agenda";
import type { AgendaEventInput } from "@/lib/agenda/validation";
import { combineDateTime } from "@/lib/agenda/format";
import { expandOccurrences, isIndefinite } from "@/lib/agenda/occurrences";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseHHMM(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

/**
 * Datas+horas de início para todas as ocorrências/doses de uma recorrência.
 * Para medicação, multiplica cada data de ocorrência pelos horários em `times[]`.
 */
function buildStartDates(
  anchor: Date,
  recurrence: RecurrenceConfig,
  typeData: Record<string, unknown>,
  horizonDays: number,
): Date[] {
  const occ = expandOccurrences(anchor, recurrence, { horizonDays });
  const isMed = (typeData as { kind?: string })?.kind === "medicacao";
  const times = isMed ? ((typeData as { times?: string[] }).times ?? []) : [];
  if (isMed && times.length > 0) {
    const out: Date[] = [];
    for (const d of occ) {
      for (const t of times) {
        const { h, m } = parseHHMM(t);
        const x = new Date(d);
        x.setHours(h, m, 0, 0);
        out.push(x);
      }
    }
    return out.sort((a, b) => a.getTime() - b.getTime());
  }
  return occ;
}

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
        series_id: null,
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
        series_id: null,
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
        series_id: null,
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
        series_id: null,
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
        series_id: null,
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
        series_id: null,
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

export async function listAgendaEvents(opts?: { from?: string; to?: string }): Promise<AgendaEventWithRelations[]> {
  if (DEV_BYPASS) return MOCK_EVENTS;
  const now = new Date();
  const from = opts?.from ?? new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const to   = opts?.to   ?? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("agenda_events")
    .select(SELECT_WITH_RELATIONS)
    .gte("start_at", from)
    .lte("start_at", to)
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

  // Âncora: para medicação, a 1ª dose do dia; para os demais, a hora de início.
  const isMed = typeData.kind === "medicacao";
  const medTimes = isMed ? typeData.times ?? [] : [];
  const anchorTime = isMed ? medTimes[0] ?? input.start_time : input.start_time;
  const anchor = new Date(combineDateTime(input.date, anchorTime));

  // Duração (preservada em cada ocorrência) — só tipos com hora final.
  let durationMs = 0;
  if (input.end_time) {
    const s = new Date(combineDateTime(input.date, input.start_time)).getTime();
    const e = new Date(combineDateTime(input.date, input.end_time)).getTime();
    if (e > s) durationMs = e - s;
  }

  // Materializa ocorrências/doses (honra recorrência, fim e múltiplas doses).
  const startDates = buildStartDates(anchor, input.recurrence, typeData, 90);
  const isSeries = startDates.length > 1;
  const seriesId = isSeries ? crypto.randomUUID() : null;

  const rows: AgendaEventInsert[] = startDates.map((d) => ({
    user_id: userId,
    child_id: input.child_id,
    type: input.type,
    title: input.title.trim(),
    professional_id: input.professional_id ?? null,
    professional_name_raw: input.professional_name_raw?.trim() || null,
    start_at: d.toISOString(),
    end_at: durationMs ? new Date(d.getTime() + durationMs).toISOString() : null,
    locale: input.locale?.trim() || null,
    recurrence: input.recurrence,
    reminders: input.reminders,
    type_data: storedTypeData,
    // Só referencia a coluna quando há série — eventos avulsos seguem
    // funcionando mesmo se a migration de series_id ainda não foi aplicada.
    ...(seriesId ? { series_id: seriesId } : {}),
  }));

  const { data, error } = await supabase
    .from("agenda_events")
    // recurrence/reminders/type_data são JSONB no schema — TS gera tipo Json
    // estrito; o payload já tem o shape correto.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(rows as any)
    .select();
  if (error) throw new Error(mapError(error.message));
  const inserted = (data as unknown as AgendaEvent[]) ?? [];
  // Ocorrência âncora (a mais próxima da data informada) para retorno/links.
  const created =
    inserted.find((r) => r.start_at === anchor.toISOString()) ??
    [...inserted].sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  if (!created) throw new Error(mapError("insert returned no rows"));

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

export async function createTherapistSession(
  userId: string,
  input: TherapistSessionInput,
): Promise<AgendaEvent> {
  if (DEV_BYPASS) {
    throw new Error("Modo preview: operação indisponível.");
  }

  // Verifica que o paciente pertence a este terapeuta antes de criar sessões
  const { data: childCheck } = await supabase
    .from("children")
    .select("id")
    .eq("id", input.childId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!childCheck) throw new Error("Paciente não encontrado ou sem permissão.");

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

  // Sessão recorrente — insere uma linha por ocorrência (mesmo motor dos pais)
  const occurrenceDates = expandOccurrences(
    startDateObj,
    recurrencePayload as RecurrenceConfig,
    { horizonDays: 90 },
  );
  const seriesId = crypto.randomUUID();

  const rows = occurrenceDates.map((occDate) => ({
    ...basePayload,
    start_at: occDate.toISOString(),
    end_at: new Date(occDate.getTime() + durationMs).toISOString(),
    series_id: seriesId,
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

/**
 * Exclui uma série (ocorrências/doses) a partir de uma data — "esta e as
 * próximas". O passado é preservado como histórico.
 */
export async function deleteAgendaSeries(
  seriesId: string,
  fromISO?: string,
): Promise<void> {
  if (DEV_BYPASS) return;
  const from = fromISO ?? new Date().toISOString();
  const { error } = await supabase
    .from("agenda_events")
    .delete()
    .eq("series_id", seriesId)
    .gte("start_at", from);
  if (error) throw new Error(mapError(error.message));
}

/** Reagenda uma ocorrência (move data/hora). Não altera as demais da série. */
export async function rescheduleAgendaEvent(
  id: string,
  newStartISO: string,
  newEndISO?: string | null,
): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await supabase
    .from("agenda_events")
    .update({ start_at: newStartISO, end_at: newEndISO ?? null })
    .eq("id", id);
  if (error) throw new Error(mapError(error.message));
}

/**
 * Top-up de séries indefinidas: garante ~90 dias de ocorrências à frente do
 * último item materializado. Reusa o motor de expansão (TS) — sem recorrência
 * em SQL. Idempotente: só insere ocorrências com `start_at` posterior ao último.
 */
export async function extendAgendaSeries(seriesId: string): Promise<number> {
  if (DEV_BYPASS) return 0;
  const { data, error } = await supabase
    .from("agenda_events")
    .select("*")
    .eq("series_id", seriesId)
    .order("start_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(mapError(error.message));
  const lastRow = (data as unknown as AgendaEvent[])?.[0];
  if (!lastRow || !isIndefinite(lastRow.recurrence)) return 0;

  const lastStart = new Date(lastRow.start_at);
  const durationMs = lastRow.end_at
    ? new Date(lastRow.end_at).getTime() - lastStart.getTime()
    : 0;

  const dates = buildStartDates(
    lastStart,
    lastRow.recurrence,
    lastRow.type_data,
    90,
  ).filter((d) => d.getTime() > lastStart.getTime());
  if (dates.length === 0) return 0;

  const rows: AgendaEventInsert[] = dates.map((d) => ({
    user_id: lastRow.user_id,
    child_id: lastRow.child_id,
    type: lastRow.type,
    title: lastRow.title,
    professional_id: lastRow.professional_id,
    professional_name_raw: lastRow.professional_name_raw,
    start_at: d.toISOString(),
    end_at: durationMs ? new Date(d.getTime() + durationMs).toISOString() : null,
    locale: lastRow.locale,
    recurrence: lastRow.recurrence,
    reminders: lastRow.reminders,
    type_data: lastRow.type_data,
    series_id: seriesId,
  }));
  const { error: insErr } = await supabase
    .from("agenda_events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(rows as any);
  if (insErr) throw new Error(mapError(insErr.message));
  return rows.length;
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

// ─── Lembretes do responsável em sessões do terapeuta ─────────────────────────
// O pai não é dono do evento do terapeuta (não pode editar o campo `reminders`),
// então mantém a própria preferência de lembrete em parent_event_reminders.
// RLS garante que cada um só lê/escreve as próprias linhas (parent_id = auth.uid()).

export interface ParentEventReminder {
  oneDayBefore: boolean;
  oneHourBefore: boolean;
}

export async function getParentEventReminder(
  eventId: string,
): Promise<ParentEventReminder> {
  if (DEV_BYPASS) return { oneDayBefore: false, oneHourBefore: false };
  const { data, error } = await (supabase as any)
    .from("parent_event_reminders")
    .select("one_day_before, one_hour_before")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw new Error(mapError(error.message));
  return {
    oneDayBefore: (data as any)?.one_day_before ?? false,
    oneHourBefore: (data as any)?.one_hour_before ?? false,
  };
}

export async function upsertParentEventReminder(
  userId: string,
  eventId: string,
  reminder: ParentEventReminder,
): Promise<void> {
  if (DEV_BYPASS) return;
  const { error } = await (supabase as any)
    .from("parent_event_reminders")
    .upsert(
      {
        parent_id: userId,
        event_id: eventId,
        one_day_before: reminder.oneDayBefore,
        one_hour_before: reminder.oneHourBefore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "parent_id,event_id" },
    );
  if (error) throw new Error(mapError(error.message));
}
