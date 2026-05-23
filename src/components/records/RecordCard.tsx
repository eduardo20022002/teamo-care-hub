import { Bell, ChevronRight, Paperclip } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { countRecordAttachments } from "@/services/attachments.service";
import { RECORD_TYPE_CONFIG, SHIFT_LABELS, type RecordType, type RecordShift } from "@/lib/validation";
import { RecordTypeChip } from "./RecordTypeChip";
import type { DiaryRecordWithRelations } from "@/services/attendance.service";

interface Props {
  record: DiaryRecordWithRelations;
  onClick: (record: DiaryRecordWithRelations) => void;
}

export function RecordCard({ record, onClick }: Props) {
  const cfg = RECORD_TYPE_CONFIG[record.record_type as RecordType];

  const { data: attachmentCount = 0 } = useQuery({
    queryKey: ["record-attachments-count", record.id],
    queryFn: () => countRecordAttachments(record.id),
  });

  const mention = record.type_data?.mention as
    | { enabled?: boolean; professional_name?: string }
    | undefined;
  const hasMention = mention?.enabled === true;

  const displayTitle =
    record.title?.trim() ||
    (record.content?.trim() ? record.content.trim().slice(0, 100) : cfg?.label ?? "Registro");

  return (
    <button
      type="button"
      onClick={() => onClick(record)}
      className="w-full text-left"
    >
      <article
        className="bg-white rounded-[14px] border border-[#EEF0F4] shadow-sm overflow-hidden"
        style={{ borderLeftWidth: 4, borderLeftColor: cfg?.color ?? "#9CA3AF" }}
      >
        <div className="px-4 py-3.5">
          {/* Top row: chip + shift + chevron */}
          <div className="flex items-center gap-1.5 mb-1.5">
            {record.record_type && (
              <RecordTypeChip type={record.record_type as RecordType} size="sm" />
            )}
            {record.shift && (
              <span className="text-[11px] text-[#9CA3AF]">
                · {SHIFT_LABELS[record.shift as RecordShift]}
              </span>
            )}
            <ChevronRight
              className="ml-auto h-4 w-4 shrink-0 text-[#C9CDD6]"
              strokeWidth={2}
            />
          </div>

          {/* Title */}
          <p className="text-[13.5px] font-semibold text-[#111827] leading-snug line-clamp-2">
            {displayTitle}
          </p>

          {/* Badges */}
          {(hasMention || attachmentCount > 0) && (
            <div className="flex items-center gap-2 mt-2">
              {hasMention && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Bell className="h-2.5 w-2.5" strokeWidth={2} />
                  Pendente
                </span>
              )}
              {attachmentCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#9CA3AF]">
                  <Paperclip className="h-3 w-3" strokeWidth={1.75} />
                  Anexo
                </span>
              )}
            </div>
          )}
        </div>
      </article>
    </button>
  );
}
