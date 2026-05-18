import type { AgendaEvent } from "@/types/agenda";

const MONTHS_PT_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MONTHS_PT_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "maio",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const WEEKDAYS_PT_LONG = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

const WEEKDAYS_PT_SHORT_CAP = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

/** "Terça, 17 de maio" — usado no hero da Agenda. */
export function formatHeroDate(d: Date = new Date()): string {
  const weekday = WEEKDAYS_PT_SHORT_CAP[d.getDay()];
  return `${weekday}, ${d.getDate()} de ${MONTHS_PT_LONG[d.getMonth()]}`;
}

/** "08:00" ou "08:00 – 09:00". */
export function formatEventTimeRange(
  startAt: string,
  endAt: string | null,
): string {
  const s = new Date(startAt);
  const start = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`;
  if (!endAt) return start;
  const e = new Date(endAt);
  const end = `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`;
  return `${start} – ${end}`;
}

/** Eyebrow do agrupamento — segue o algoritmo do brief. */
export function formatDayGroupLabel(date: Date, now: Date = new Date()): string {
  const diff = diffDays(date, now);
  if (diff === 0) {
    return `HOJE · ${date.getDate()} ${MONTHS_PT_SHORT[date.getMonth()]}`;
  }
  if (diff === 1) {
    return `AMANHÃ · ${WEEKDAYS_PT_LONG[date.getDay()].split("-")[0]}`;
  }

  // Esta semana? (dentro de 7 dias após o início da semana atual)
  const dayOfWeek = now.getDay();
  const startOfWeek = startOfDay(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  if (date >= startOfWeek && date <= endOfWeek) {
    const wd = WEEKDAYS_PT_SHORT_CAP[date.getDay()];
    return `${wd} · ${date.getDate()} ${MONTHS_PT_SHORT[date.getMonth()]}`;
  }

  // Próxima semana?
  const startNext = new Date(endOfWeek);
  startNext.setDate(endOfWeek.getDate() + 1);
  const endNext = new Date(startNext);
  endNext.setDate(startNext.getDate() + 6);
  if (date >= startNext && date <= endNext) {
    return "Próxima semana";
  }

  // Mesmo mês — só "DD de mmm"
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} de ${MONTHS_PT_SHORT[date.getMonth()]}`;
  }

  return `${MONTHS_PT_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** "Você tem N compromissos hoje · M medicações" — texto do hero. */
export function formatTodaySummary(events: AgendaEvent[], now: Date = new Date()): string {
  const today = events.filter((e) => diffDays(new Date(e.start_at), now) === 0);
  const meds = today.filter((e) => e.type === "medicacao").length;
  const others = today.length - meds;
  const partsParts: string[] = [];
  if (others > 0) {
    partsParts.push(`${others} ${others === 1 ? "compromisso" : "compromissos"}`);
  } else {
    partsParts.push("nenhum compromisso");
  }
  let result = `Você tem ${partsParts.join(" ")} hoje`;
  if (meds > 0) result += ` · ${meds} ${meds === 1 ? "medicação" : "medicações"}`;
  return result;
}

interface DayGroup<T> {
  key: string;
  label: string;
  isToday: boolean;
  events: T[];
}

/**
 * Agrupa eventos por dia, ordenando por start_at e gerando o eyebrow
 * de cada grupo no formato do brief.
 *
 * "Próxima semana" colapsa todos os eventos da semana seguinte num único grupo.
 * Genérica em `T` pra preservar o tipo concreto (Event ou EventWithRelations).
 */
export function groupEventsByDay<T extends Pick<AgendaEvent, "start_at">>(
  events: T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const sorted = [...events].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const groups = new Map<string, DayGroup<T>>();

  for (const ev of sorted) {
    const d = new Date(ev.start_at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const label = formatDayGroupLabel(d, now);
    const key = label === "Próxima semana" ? "next-week" : dayKey;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        isToday: diffDays(d, now) === 0,
        events: [],
      });
    }
    groups.get(key)!.events.push(ev);
  }
  return Array.from(groups.values());
}

/** "Hoje · 14:32" / "Terça passada · 14:50" / "Há 2 semanas" para NoteCard. */
export function formatRelativeDateTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = diffDays(now, d);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (days === 0) return `Hoje · ${time}`;
  if (days === 1) return `Ontem · ${time}`;
  if (days < 7) return `${WEEKDAYS_PT_SHORT_CAP[d.getDay()]} passada · ${time}`;
  if (days < 14) return "Há 1 semana";
  if (days < 30) return `Há ${Math.floor(days / 7)} semanas`;
  return `${d.getDate()} de ${MONTHS_PT_SHORT[d.getMonth()]}`;
}

/** Junta data ("YYYY-MM-DD") + hora ("HH:MM") em ISO timestamp local. */
export function combineDateTime(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm);
  return dt.toISOString();
}
