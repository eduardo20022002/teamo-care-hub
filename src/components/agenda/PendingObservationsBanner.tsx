import { Bell } from "lucide-react";
import { ALERT_TONE } from "@/lib/agenda/tokens";
import type { AgendaObservation } from "@/types/agenda";
import { MOCK_EVENT_ORIGIN } from "@/services/agenda/observations.service";

interface Props {
  professionalName: string;
  observations: AgendaObservation[];
  onOpenAll?: () => void;
}

function truncate(s: string, max = 90): string {
  return s.length <= max ? s : `${s.slice(0, max).trim()}…`;
}

export function PendingObservationsBanner({
  professionalName,
  observations,
  onOpenAll,
}: Props) {
  if (!observations.length) return null;
  const count = observations.length;

  return (
    <div
      className="mt-3.5 rounded-2xl p-3.5"
      style={{
        background:
          "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)",
        border: `1px solid ${ALERT_TONE.border}`,
        boxShadow: "0 6px 18px -8px rgba(154,52,18,0.25)",
      }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white">
          <Bell size={18} strokeWidth={1.7} color={ALERT_TONE.bodyColor} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-sm font-extrabold"
            style={{ color: ALERT_TONE.titleColor, letterSpacing: "-0.005em" }}
          >
            {count === 1
              ? `1 coisa pra mencionar à ${professionalName}`
              : `${count} coisas pra mencionar à ${professionalName}`}
          </div>
          <div
            className="mt-0.5 text-xs"
            style={{ color: ALERT_TONE.bodyColor }}
          >
            Anotadas em compromissos anteriores
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {observations.slice(0, 3).map((o, i) => {
          const origin = MOCK_EVENT_ORIGIN[o.event_id];
          return (
            <div
              key={o.id}
              className="flex items-start gap-2.5 rounded-[10px] px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.85)" }}
            >
              <div
                className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold"
                style={{
                  border: `1.5px solid ${ALERT_TONE.border}`,
                  color: ALERT_TONE.bodyColor,
                }}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                {origin && (
                  <div
                    className="mb-0.5 text-[11.5px] font-bold"
                    style={{ color: ALERT_TONE.bodyColor }}
                  >
                    {origin.title} · {origin.dateLabel}
                  </div>
                )}
                <div
                  className="text-[13px] leading-snug"
                  style={{ color: "#0F172A" }}
                >
                  {truncate(o.text, 80)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {count > 0 && (
        <button
          type="button"
          onClick={onOpenAll}
          className="mt-3 flex h-[38px] w-full items-center justify-center rounded-[10px] text-[13px] font-bold text-white transition-transform hover:-translate-y-px"
          style={{ background: ALERT_TONE.ctaColor }}
        >
          Abrir todas
        </button>
      )}
    </div>
  );
}
