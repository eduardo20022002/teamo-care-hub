import { ChevronRight, MapPin, Paperclip } from "lucide-react";
import { AGENDA_BRAND } from "@/lib/agenda/tokens";
import { formatEventTimeRange } from "@/lib/agenda/format";
import type { AgendaEventWithRelations } from "@/types/agenda";
import { TypeChip } from "./TypeChip";

interface Props {
  event: AgendaEventWithRelations;
  onClick?: () => void;
}

export function EventCard({ event, onClick }: Props) {
  const time = formatEventTimeRange(event.start_at, event.end_at);
  const [startStr, endStr] = time.split(" – ");
  const isPast = new Date(event.start_at) < new Date();
  const profName =
    event.professional?.name ?? event.professional_name_raw ?? null;
  const obsCount = event.observation_count ?? 0;
  const attachCount = event.attachment_count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-5 flex items-center gap-3 rounded-[14px] border bg-white px-3.5 py-3 text-left transition-shadow hover:shadow-md"
      style={{
        borderColor: "#EEF0F4",
        opacity: isPast ? 0.75 : 1,
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      {/* Time column */}
      <div
        className="flex w-14 flex-shrink-0 flex-col items-center justify-center border-r pr-3 text-center"
        style={{ borderColor: "#EEF0F4" }}
      >
        <div
          className="text-base font-extrabold"
          style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
        >
          {startStr}
        </div>
        {endStr && (
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: "#9CA3AF" }}
          >
            {endStr}
          </div>
        )}
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <TypeChip type={event.type} size="sm" />
        </div>
        <div
          className="truncate text-[14.5px] font-bold"
          style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
        >
          {event.title}
        </div>
        {(profName || event.locale) && (
          <div
            className="mt-1 flex flex-wrap items-center gap-2 text-xs"
            style={{ color: "#6B7280" }}
          >
            {profName && <span>{profName}</span>}
            {profName && event.locale && (
              <span
                className="h-[3px] w-[3px] rounded-full"
                style={{ background: "#D1D5DB" }}
              />
            )}
            {event.locale && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} strokeWidth={1.6} />
                {event.locale}
              </span>
            )}
          </div>
        )}
        {(obsCount > 0 || attachCount > 0) && (
          <div className="mt-1.5 flex items-center gap-2">
            {obsCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  color: AGENDA_BRAND.col,
                  background: AGENDA_BRAND.tint,
                }}
              >
                {obsCount} obs.
              </span>
            )}
            {attachCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[11px]"
                style={{ color: "#6B7280" }}
              >
                <Paperclip size={12} strokeWidth={1.6} />
                {attachCount}
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight
        size={18}
        strokeWidth={1.8}
        style={{ color: "#9CA3AF", flexShrink: 0 }}
      />
    </button>
  );
}
