import { ChevronLeft, ChevronRight } from "lucide-react";
import { AGENDA_BRAND, TYPE_STYLES } from "@/lib/agenda/tokens";
import type { AgendaEventWithRelations } from "@/types/agenda";

export type SessionDayStatus = "complete" | "pending" | "missed" | "upcoming";

const SESSION_STATUS_COLORS: Record<SessionDayStatus, string> = {
  complete: "#0D9488",  // teal verde
  pending:  "#D97706",  // amber
  missed:   "#DC2626",  // vermelho
  upcoming: "#9CA3AF",  // cinza
};

interface Props {
  monthYear: { year: number; month: number }; // month 0-indexed
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  events: AgendaEventWithRelations[];
  /** Quando fornecido (modo terapeuta), mostra dots de status em vez de dots de tipo */
  sessionStatusMap?: Map<string, SessionDayStatus>;
}

const MONTH_LABELS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAY_HEADERS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

function buildCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const offset = first.getDay(); // 0=Sunday
  const startDate = new Date(year, month, 1 - offset);
  // 6 semanas × 7 dias = 42 células
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });
}

export function MonthGrid({
  monthYear,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  events,
  sessionStatusMap,
}: Props) {
  const days = buildCalendarDays(monthYear.year, monthYear.month);
  const today = new Date();
  const therapistMode = !!sessionStatusMap;

  // Mapeia "year-month-day" → set de tipos (até 3) presentes (modo pai)
  const typesByDay = new Map<string, string[]>();
  if (!therapistMode) {
    for (const ev of events) {
      const d = new Date(ev.start_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = typesByDay.get(key) ?? [];
      if (!arr.includes(ev.type)) arr.push(ev.type);
      typesByDay.set(key, arr);
    }
  }

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div
      className="rounded-2xl border bg-white p-3"
      style={{ borderColor: "#EEF0F4" }}
    >
      <div className="mb-2.5 flex items-center justify-between px-1.5 pt-1">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Mês anterior"
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[#F4F5FA]"
        >
          <ChevronLeft size={16} strokeWidth={2} color="#6B7280" />
        </button>
        <div
          className="text-[15px] font-extrabold"
          style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
        >
          {MONTH_LABELS_PT[monthYear.month]} {monthYear.year}
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Próximo mês"
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[#F4F5FA]"
        >
          <ChevronRight size={16} strokeWidth={2} color="#6B7280" />
        </button>
      </div>

      <div className="mb-1.5 grid grid-cols-7">
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className="text-center text-[11px] font-bold tracking-[0.05em]"
            style={{ color: "#9CA3AF" }}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === monthYear.month;
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, selectedDate);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

          // Modo terapeuta: 1 marcador de status por dia
          const sessionStatus = therapistMode ? sessionStatusMap!.get(key) : undefined;

          // Modo pai: quadradinhos por tipo (até 3 + overflow)
          const allTypes = !therapistMode ? (typesByDay.get(key) ?? []) : [];
          const types = allTypes.slice(0, 3);
          const overflow = allTypes.length - types.length;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(d)}
              className="relative flex flex-col items-center justify-center rounded-[10px]"
              style={{
                aspectRatio: "1",
                background: isSelected ? (therapistMode ? "#0D9488" : AGENDA_BRAND.col) : "transparent",
              }}
            >
              <span
                className="text-[13px]"
                style={{
                  color: isSelected
                    ? "white"
                    : inMonth
                      ? "#0F172A"
                      : "#D1D5DB",
                  fontWeight: isToday ? 800 : 600,
                  letterSpacing: "-0.005em",
                }}
              >
                {d.getDate()}
              </span>
              {/* Quadradinho de status (modo terapeuta) */}
              {sessionStatus && (
                <span
                  className="mt-0.5 h-1.5 w-1.5 rounded-[2px]"
                  style={{
                    background: isSelected ? "white" : SESSION_STATUS_COLORS[sessionStatus],
                  }}
                />
              )}
              {/* Quadradinhos com inicial do tipo (modo pai) */}
              {types.length > 0 && (
                <div className="mt-0.5 flex items-center gap-0.5">
                  {types.map((tType, j) => {
                    const style = TYPE_STYLES[tType as keyof typeof TYPE_STYLES];
                    const initial = (style?.label ?? tType).charAt(0).toUpperCase();
                    return (
                      <span
                        key={j}
                        className="flex h-[11px] w-[11px] items-center justify-center rounded-[3px] text-[7px] font-extrabold leading-none"
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.9)" : style?.col ?? "#6B7280",
                          color: isSelected ? (style?.col ?? "#6B7280") : "white",
                        }}
                      >
                        {initial}
                      </span>
                    );
                  })}
                  {overflow > 0 && (
                    <span
                      className="text-[7px] font-bold leading-none"
                      style={{ color: isSelected ? "white" : "#9CA3AF" }}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthLegend() {
  return (
    <div className="flex flex-wrap gap-2.5">
      {(Object.keys(TYPE_STYLES) as Array<keyof typeof TYPE_STYLES>).map(
        (k) => (
          <span
            key={k}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
            style={{ color: "#6B7280" }}
          >
            <span
              className="flex h-[12px] w-[12px] items-center justify-center rounded-[3px] text-[7px] font-extrabold text-white"
              style={{ background: TYPE_STYLES[k].col }}
            >
              {TYPE_STYLES[k].label.charAt(0).toUpperCase()}
            </span>
            {TYPE_STYLES[k].label}
          </span>
        ),
      )}
    </div>
  );
}

/** Legenda de status de sessão para a visão de mês do terapeuta. */
export function TherapistMonthLegend() {
  const items: { status: SessionDayStatus; label: string }[] = [
    { status: "complete", label: "Registro completo" },
    { status: "pending",  label: "Pendente" },
    { status: "missed",   label: "Falta" },
    { status: "upcoming", label: "Futura" },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map(({ status, label }) => (
        <span
          key={status}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
          style={{ color: "#6B7280" }}
        >
          <span
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ background: SESSION_STATUS_COLORS[status] }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
