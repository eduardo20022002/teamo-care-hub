import { Fragment } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AGENDA_BRAND, TYPE_STYLES } from "@/lib/agenda/tokens";
import type { AgendaEventWithRelations } from "@/types/agenda";

interface Props {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  events: AgendaEventWithRelations[];
  onSelectEvent: (eventId: string) => void;
  /** Quando fornecida, substitui TYPE_STYLES por cores personalizadas por evento */
  getEventColor?: (event: AgendaEventWithRelations) => { col: string; label?: string };
}

const HOURS = [8, 10, 12, 14, 16, 18];
const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MONTHS_SHORT_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function inHourSlot(eventDate: Date, h: number): boolean {
  return eventDate.getHours() >= h && eventDate.getHours() < h + 2;
}

export function WeekGrid({
  weekStart,
  onPrev,
  onNext,
  events,
  onSelectEvent,
  getEventColor,
}: Props) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const weekEnd = days[6];
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const rangeLabel = sameMonth
    ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${MONTHS_SHORT_PT[weekStart.getMonth()]}`
    : `${weekStart.getDate()} ${MONTHS_SHORT_PT[weekStart.getMonth()]} — ${weekEnd.getDate()} ${MONTHS_SHORT_PT[weekEnd.getMonth()]}`;

  // Pra cada (dayIdx, hour) → primeiro evento que cai naquele slot
  const eventByCell = new Map<string, AgendaEventWithRelations>();
  for (const ev of events) {
    const d = new Date(ev.start_at);
    const dayIdx = days.findIndex((day) => isSameDay(d, day));
    if (dayIdx < 0) continue;
    for (const h of HOURS) {
      if (inHourSlot(d, h)) {
        const key = `${dayIdx}-${h}`;
        if (!eventByCell.has(key)) eventByCell.set(key, ev);
        break;
      }
    }
  }

  return (
    <div
      className="rounded-2xl border bg-white p-3"
      style={{ borderColor: "#EEF0F4" }}
    >
      <div className="mb-3 flex items-center justify-between px-1 pt-1">
        <div className="text-[13px] font-bold" style={{ color: "#0F172A" }}>
          {rangeLabel}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Semana anterior"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-[#F4F5FA]"
          >
            <ChevronLeft size={14} strokeWidth={2} color="#6B7280" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Próxima semana"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-full transition-colors hover:bg-[#F4F5FA]"
          >
            <ChevronRight size={14} strokeWidth={2} color="#6B7280" />
          </button>
        </div>
      </div>

      <div
        className="mb-1.5 grid items-end gap-1"
        style={{ gridTemplateColumns: "28px repeat(7, 1fr)" }}
      >
        <div />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className="rounded-[8px] py-1 text-center"
              style={{ background: isToday ? AGENDA_BRAND.col : "transparent" }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.05em]"
                style={{
                  color: isToday ? "rgba(255,255,255,0.85)" : "#9CA3AF",
                }}
              >
                {WEEKDAYS_PT[d.getDay()]}
              </div>
              <div
                className="mt-0.5 text-[13px] font-extrabold"
                style={{ color: isToday ? "white" : "#0F172A" }}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: "28px repeat(7, 1fr)" }}
      >
        {HOURS.map((h) => (
          <Fragment key={h}>
            <div
              className="pt-0.5 text-[10px] font-semibold"
              style={{ color: "#9CA3AF" }}
            >
              {h}h
            </div>
            {days.map((_, i) => {
              const cellEv = eventByCell.get(`${i}-${h}`);
              const evColor = cellEv
                ? getEventColor
                  ? getEventColor(cellEv)
                  : { col: TYPE_STYLES[cellEv.type].col }
                : null;
              return (
                <button
                  key={`cell-${h}-${i}`}
                  type="button"
                  onClick={cellEv ? () => onSelectEvent(cellEv.id) : undefined}
                  className="h-7 rounded-[6px] relative overflow-hidden"
                  style={{
                    background: evColor ? evColor.col : "#FAFBFD",
                    border: cellEv ? "none" : "1px solid #F1F2F6",
                    cursor: cellEv ? "pointer" : "default",
                  }}
                  aria-label={cellEv ? cellEv.title : undefined}
                >
                  {evColor?.label && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold text-white"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
                    >
                      {evColor.label}
                    </span>
                  )}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
