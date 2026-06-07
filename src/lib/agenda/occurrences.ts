/**
 * Expansão de recorrência → datas de ocorrência.
 *
 * Generaliza o antigo `computeOccurrenceDates` (que só cobria weekly/biweekly/
 * monthly do fluxo do terapeuta) para todos os `freq` da união `RecurrenceConfig`,
 * honrando o fim (`endsOn` / `ends`) e um horizonte para recorrências indefinidas.
 *
 * Cada data retornada já carrega o horário correto:
 * - freqs genéricas (daily/weekly/...): herdam a hora de `startAt`;
 * - freqs de terapia (weekly_same_time/weekly_varies/intensive): usam a hora
 *   embutida na própria recorrência.
 */
import type { RecurrenceConfig } from "@/types/agenda";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Teto absoluto de ocorrências por série, evita explosão acidental. */
const MAX_OCCURRENCES = 400;

export interface ExpandOptions {
  /** Para recorrências indefinidas (dia/semana), até quantos dias à frente materializar. */
  horizonDays?: number;
}

interface Limit {
  until: Date;
  maxCount: number;
}

function endOfDayFromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999);
}

function parseHHMM(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function atTime(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Limite por `endsOn?` (string) ou horizonte. */
function limitFromEndsOn(endsOn: string | undefined, horizonEnd: Date): Limit {
  return {
    until: endsOn ? endOfDayFromISO(endsOn) : horizonEnd,
    maxCount: MAX_OCCURRENCES,
  };
}

/** Limite pela união `ends` (terapia). */
function limitFromEnds(
  ends:
    | { kind: "indeterminate" }
    | { kind: "on"; date: string }
    | { kind: "after"; count: number },
  horizonEnd: Date,
): Limit {
  if (ends.kind === "on") return { until: endOfDayFromISO(ends.date), maxCount: MAX_OCCURRENCES };
  if (ends.kind === "after") {
    return { until: new Date(8640000000000000), maxCount: Math.min(ends.count, MAX_OCCURRENCES) };
  }
  return { until: horizonEnd, maxCount: MAX_OCCURRENCES };
}

function stepBy(
  start: Date,
  advance: (d: Date, i: number) => void,
  limit: Limit,
): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < MAX_OCCURRENCES && out.length < limit.maxCount; i++) {
    const d = new Date(start);
    advance(d, i);
    if (d.getTime() < start.getTime()) continue;
    if (d.getTime() > limit.until.getTime()) break;
    out.push(d);
  }
  return out;
}

function stepWeeklyDays(
  start: Date,
  days: number[],
  h: number,
  m: number,
  limit: Limit,
): Date[] {
  const out: Date[] = [];
  const startDay = start.getDay();
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  for (let week = 0; week < 80 && out.length < limit.maxCount; week++) {
    for (const day of sorted) {
      const diff = ((day - startDay + 7) % 7) + week * 7;
      const d = atTime(new Date(start.getTime() + diff * DAY_MS), h, m);
      if (d.getTime() < start.getTime()) continue;
      if (d.getTime() > limit.until.getTime()) continue;
      out.push(d);
    }
    // corta cedo quando o início da semana já passou do limite
    if (start.getTime() + week * 7 * DAY_MS > limit.until.getTime()) break;
  }
  return out
    .sort((a, b) => a.getTime() - b.getTime())
    .slice(0, limit.maxCount);
}

/**
 * Gera as datas de ocorrência (com hora) para uma recorrência.
 * Retorna sempre ao menos `[startAt]` para freqs pontuais.
 */
export function expandOccurrences(
  startAt: Date,
  recurrence: RecurrenceConfig,
  opts: ExpandOptions = {},
): Date[] {
  const horizonDays = opts.horizonDays ?? 90;
  const horizonEnd = new Date(startAt.getTime() + horizonDays * DAY_MS);
  const h = startAt.getHours();
  const m = startAt.getMinutes();

  switch (recurrence.freq) {
    case "none":
    case "once":
      return [startAt];

    case "daily":
      return stepBy(startAt, (d, i) => d.setDate(d.getDate() + i), limitFromEndsOn(recurrence.endsOn, horizonEnd));

    case "every_n_days":
      return stepBy(
        startAt,
        (d, i) => d.setDate(d.getDate() + i * recurrence.interval),
        limitFromEndsOn(recurrence.endsOn, horizonEnd),
      );

    case "custom":
      return stepBy(
        startAt,
        (d, i) => d.setDate(d.getDate() + i * (recurrence.interval ?? 1)),
        limitFromEndsOn(recurrence.endsOn, horizonEnd),
      );

    case "weekly": {
      const days = recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [startAt.getDay()];
      return stepWeeklyDays(startAt, days, h, m, limitFromEndsOn(recurrence.endsOn, horizonEnd));
    }

    case "biweekly":
      return stepBy(startAt, (d, i) => d.setDate(d.getDate() + i * 14), limitFromEndsOn(recurrence.endsOn, horizonEnd));

    case "monthly":
      return stepBy(
        startAt,
        (d, i) => d.setMonth(d.getMonth() + i),
        // cadência mensal: limita por contagem para não explodir
        recurrence.endsOn
          ? limitFromEndsOn(recurrence.endsOn, horizonEnd)
          : { until: new Date(8640000000000000), maxCount: 6 },
      );

    case "every_n_months":
      return stepBy(startAt, (d, i) => d.setMonth(d.getMonth() + i * recurrence.interval), {
        until: new Date(8640000000000000),
        maxCount: 6,
      });

    case "yearly":
      return stepBy(startAt, (d, i) => d.setFullYear(d.getFullYear() + i), {
        until: new Date(8640000000000000),
        maxCount: 3,
      });

    case "weekly_same_time": {
      const { h: th, m: tm } = parseHHMM(recurrence.time);
      const limit = limitFromEnds(recurrence.ends, horizonEnd);
      let dates = stepWeeklyDays(startAt, [recurrence.dayOfWeek], th, tm, limit);
      if (recurrence.pauses?.length) {
        const ranges = recurrence.pauses.map((p) => ({
          from: endOfDayFromISO(p.from).getTime() - DAY_MS, // início do dia "from"
          to: endOfDayFromISO(p.to).getTime(),
        }));
        dates = dates.filter(
          (d) => !ranges.some((r) => d.getTime() >= r.from && d.getTime() <= r.to),
        );
      }
      return dates;
    }

    case "weekly_varies": {
      const limit = limitFromEnds(recurrence.ends, horizonEnd);
      const all: Date[] = [];
      for (const slot of recurrence.schedule) {
        const { h: th, m: tm } = parseHHMM(slot.time);
        all.push(...stepWeeklyDays(startAt, [slot.dayOfWeek], th, tm, limit));
      }
      return all
        .sort((a, b) => a.getTime() - b.getTime())
        .slice(0, limit.maxCount);
    }

    case "intensive": {
      const { h: th, m: tm } = parseHHMM(recurrence.time);
      const limit: Limit = {
        until: endOfDayFromISO(recurrence.endsOn),
        maxCount: MAX_OCCURRENCES,
      };
      // o início efetivo é o maior entre startAt e startsOn
      const startsOn = endOfDayFromISO(recurrence.startsOn).getTime() - DAY_MS;
      const base = new Date(Math.max(startAt.getTime(), startsOn));
      return stepWeeklyDays(atTime(base, th, tm), recurrence.daysOfWeek, th, tm, limit);
    }

    default:
      return [startAt];
  }
}

/** `true` quando a recorrência não tem fim explícito (precisa de top-up). */
export function isIndefinite(recurrence: RecurrenceConfig): boolean {
  switch (recurrence.freq) {
    case "none":
    case "once":
      return false;
    case "daily":
    case "weekly":
    case "biweekly":
    case "custom":
    case "every_n_days":
      return !recurrence.endsOn;
    case "weekly_same_time":
    case "weekly_varies":
      return recurrence.ends.kind === "indeterminate";
    case "monthly":
      return !("endsOn" in recurrence && recurrence.endsOn);
    case "every_n_months":
    case "yearly":
      return true;
    case "intensive":
      return false;
    default:
      return false;
  }
}
