import { Bell, FileImage, Pencil } from "lucide-react";
import { AGENDA_BRAND, ALERT_TONE } from "@/lib/agenda/tokens";
import { formatRelativeDateTime } from "@/lib/agenda/format";
import type { AgendaObservation } from "@/types/agenda";

interface AttachmentSummary {
  filename: string;
  kind: "image" | "video" | "audio" | "pdf" | "other";
  durationSeconds?: number | null;
  sizeBytes?: number | null;
}

interface Props {
  observation: AgendaObservation;
  attachments?: AttachmentSummary[];
  reminderLabel?: string | null; // ex.: "Lembrar dia 19/05 na consulta com Dra. Carla"
  onPromote?: () => void;
  onEdit?: () => void;
}

function describeAttachment(a: AttachmentSummary): string {
  if (a.kind === "video" && a.durationSeconds) {
    return `vídeo · ${a.durationSeconds}s`;
  }
  if (a.kind === "audio" && a.durationSeconds) {
    return `áudio · ${a.durationSeconds}s`;
  }
  if (a.sizeBytes != null) {
    if (a.sizeBytes < 1024 * 1024) {
      return `${a.filename} · ${(a.sizeBytes / 1024).toFixed(0)} KB`;
    }
    return `${a.filename} · ${(a.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return a.filename;
}

export function NoteCard({
  observation,
  attachments = [],
  reminderLabel,
  onPromote,
  onEdit,
}: Props) {
  const isPromoted = !!observation.promoted_to_record_id;
  return (
    <div
      className="relative rounded-[14px] border bg-white p-3.5"
      style={{
        borderColor: "#EEF0F4",
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      {/* Barra violeta lateral */}
      <span
        className="absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-full"
        style={{ background: AGENDA_BRAND.col }}
      />
      <div className="pl-2">
        <div className="mb-2">
          <span
            className="text-[11.5px] font-semibold"
            style={{ color: "#9CA3AF" }}
          >
            {formatRelativeDateTime(observation.created_at)}
          </span>
        </div>
        <div
          className="text-[13.5px] leading-relaxed"
          style={{ color: "#0F172A" }}
        >
          {observation.text}
        </div>

        {attachments.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: "#F6F7FB", color: "#374151" }}
              >
                <FileImage size={14} strokeWidth={1.6} color="#7C3AED" />
                {describeAttachment(a)}
              </div>
            ))}
          </div>
        )}

        {reminderLabel && (
          <div
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-xs font-semibold"
            style={{
              background: ALERT_TONE.background,
              borderColor: ALERT_TONE.border,
              color: ALERT_TONE.bodyColor,
            }}
          >
            <Bell size={13} strokeWidth={1.6} color={ALERT_TONE.bodyColor} />
            {reminderLabel}
          </div>
        )}

        {isPromoted && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#FDF2F8] px-2 py-0.5 text-[11px] font-semibold text-[#EC4899]">
            ↗ Virou registro
          </div>
        )}

        <div className="mt-3 flex gap-3 text-xs font-semibold">
          {!isPromoted && onPromote && (
            <button
              type="button"
              onClick={onPromote}
              className="inline-flex items-center gap-1 bg-transparent p-0 transition-colors hover:underline"
              style={{ color: "#EC4899" }}
            >
              ↗ Virar registro
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 bg-transparent p-0 transition-colors hover:text-[#0F172A]"
              style={{ color: "#6B7280" }}
            >
              <Pencil size={12} strokeWidth={1.8} />
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
