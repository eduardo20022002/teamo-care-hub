import type { AgendaEventStatus } from "@/types/agenda";

interface Action {
  label: string;
  color: string;
  bg: string;
  value: AgendaEventStatus;
}

const ACTIONS: Action[] = [
  { label: "Aconteceu", color: "#16A34A", bg: "#DCFCE7", value: "happened" },
  { label: "Remarcar", color: "#D97706", bg: "#FEF3C7", value: "rescheduled" },
  { label: "Não fui", color: "#6B7280", bg: "#F4F5FA", value: "missed" },
];

interface Props {
  currentStatus: AgendaEventStatus;
  onChoose: (status: AgendaEventStatus) => void;
}

export function AfterAppointmentActions({ currentStatus, onChoose }: Props) {
  return (
    <div className="mt-2">
      <div
        className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "#9CA3AF" }}
      >
        Após o compromisso
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => {
          const active = currentStatus === a.value;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => onChoose(a.value)}
              className="flex h-11 items-center justify-center rounded-[11px] text-[13px] font-bold transition-transform hover:-translate-y-px"
              style={{
                background: a.bg,
                color: a.color,
                outline: active ? `2px solid ${a.color}` : "none",
                outlineOffset: -2,
              }}
              aria-pressed={active}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
