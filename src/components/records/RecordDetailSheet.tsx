import { Bell, Pencil, Share2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  RECORD_TYPE_CONFIG,
  SHIFT_LABELS,
  type RecordType,
  type RecordShift,
} from "@/lib/validation";
import { RecordTypeChip } from "./RecordTypeChip";
import { RecordAttachmentsSection } from "@/components/attachments/RecordAttachmentsSection";
import { formatDateBR } from "@/lib/formatters";
import type { DiaryRecordWithRelations } from "@/services/attendance.service";

interface Props {
  record: DiaryRecordWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (record: DiaryRecordWithRelations) => void;
  onShare: (record: DiaryRecordWithRelations) => void;
  onDelete: (record: DiaryRecordWithRelations) => void;
  /** Quando true, oculta os botões de ação (Editar/Compartilhar/Excluir) */
  readOnly?: boolean;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-3 border-b border-[#F3F4F8] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-24 shrink-0 pt-0.5">
        {label}
      </span>
      <div className="flex-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function WaveDisplay({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= value;
          return (
            <span
              key={n}
              className="flex h-6 w-6 items-center justify-center rounded-[6px] border-[1.5px]"
              style={{
                background: active ? `${color}14` : "#F3F4F8",
                borderColor: active ? color : "#E5E7EB",
              }}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? color : "#C9CDD6"}
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M3 12c1.5-2 3-2 4.5 0S10.5 14 12 12s3-2 4.5 0S19.5 14 21 12" />
              </svg>
            </span>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">{value} / 5</span>
    </div>
  );
}

function MoonDisplay({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= value;
          return (
            <span
              key={n}
              className="flex h-6 w-6 items-center justify-center rounded-[6px] border-[1.5px]"
              style={{
                background: active ? `${color}14` : "#F3F4F8",
                borderColor: active ? color : "#E5E7EB",
              }}
            >
              <svg
                width={13}
                height={13}
                viewBox="0 0 24 24"
                fill={color}
                fillOpacity={active ? n * 0.18 : 0}
                stroke={active ? color : "#C9CDD6"}
                strokeWidth={1.5}
              >
                <path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z" />
              </svg>
            </span>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">{value} / 5</span>
    </div>
  );
}

function ChipDisplay({
  items,
  color,
  tint,
}: {
  items: string[];
  color: string;
  tint: string;
}) {
  if (!items?.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ background: tint, color }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function renderTypeFields(record: DiaryRecordWithRelations) {
  const td = (record.type_data ?? {}) as Record<string, unknown>;
  const cfg = RECORD_TYPE_CONFIG[record.record_type as RecordType];
  const { color, tint } = cfg;

  const type = record.record_type as RecordType;

  const rows: { label: string; value: React.ReactNode }[] = [];

  if (type === "comportamento") {
    if (record.content) rows.push({ label: "O que aconteceu", value: <p className="whitespace-pre-wrap">{record.content}</p> });
    if (td.intensity) rows.push({ label: "Intensidade", value: <WaveDisplay value={td.intensity as number} color={color} /> });
    if (td.duration) rows.push({ label: "Duração", value: String(td.duration) });
    if ((td.triggers as string[])?.length) rows.push({ label: "Gatilhos", value: <ChipDisplay items={td.triggers as string[]} color={color} tint={tint} /> });
    if (td.helped) rows.push({ label: "O que ajudou", value: <p className="whitespace-pre-wrap">{td.helped as string}</p> });
  }

  if (type === "conquista") {
    if (record.content) rows.push({ label: "O que aconteceu", value: <p className="whitespace-pre-wrap">{record.content}</p> });
    if (td.area) rows.push({ label: "Área", value: <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: tint, color }}>{td.area as string}</span> });
    if (td.location) rows.push({ label: "Onde", value: <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: tint, color }}>{td.location as string}</span> });
  }

  if (type === "sono") {
    if (td.sleep_time && td.wake_time) rows.push({ label: "Horários", value: `${td.sleep_time} → ${td.wake_time}` });
    if (td.quality) rows.push({ label: "Qualidade", value: <MoonDisplay value={td.quality as number} color={color} /> });
    if (td.woke_up) {
      rows.push({ label: "Despertares", value: `${td.wake_count ?? "?"} vez(es)` });
      if (td.wake_content) rows.push({ label: "O que aconteceu", value: <p className="whitespace-pre-wrap">{td.wake_content as string}</p> });
    }
    if (record.content) rows.push({ label: "Observações", value: <p className="whitespace-pre-wrap">{record.content}</p> });
  }

  if (type === "saude") {
    if (record.content) rows.push({ label: "O que acontece", value: <p className="whitespace-pre-wrap">{record.content}</p> });
    if ((td.symptoms as string[])?.length) rows.push({ label: "Sintomas", value: <ChipDisplay items={td.symptoms as string[]} color={color} tint={tint} /> });
    if (td.intensity) rows.push({ label: "Intensidade", value: <WaveDisplay value={td.intensity as number} color={color} /> });
    if (td.gave_meds && td.meds_description) rows.push({ label: "Medicação", value: String(td.meds_description) });
  }

  if (type === "alimentacao") {
    const meals: Record<string, string> = { cafe: "Café", almoco: "Almoço", lanche: "Lanche", jantar: "Jantar", madrugada: "Madrugada" };
    if (td.meal) rows.push({ label: "Refeição", value: <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: tint, color }}>{meals[td.meal as string] ?? (td.meal as string)}</span> });
    if (record.content) rows.push({ label: "O que comeu", value: <p className="whitespace-pre-wrap">{record.content}</p> });
    if (td.refused) {
      if (td.refused_what) rows.push({ label: "Recusou", value: String(td.refused_what) });
      if (td.refused_reason) rows.push({ label: "Motivo", value: String(td.refused_reason) });
    }
    if ((td.restrictions as string[])?.length) rows.push({ label: "Restrições", value: <ChipDisplay items={td.restrictions as string[]} color={color} tint={tint} /> });
  }

  if (type === "sensorial") {
    if (record.content) rows.push({ label: "O que aconteceu", value: <p className="whitespace-pre-wrap">{record.content}</p> });
    if ((td.triggers as string[])?.length) rows.push({ label: "Gatilhos", value: <ChipDisplay items={td.triggers as string[]} color={color} tint={tint} /> });
    if (td.reaction) rows.push({ label: "Reação", value: <p className="whitespace-pre-wrap">{td.reaction as string}</p> });
    if (td.strategy) rows.push({ label: "Estratégia", value: <p className="whitespace-pre-wrap">{td.strategy as string}</p> });
  }

  if (type === "livre") {
    if (record.content) rows.push({ label: "Anotação", value: <p className="whitespace-pre-wrap">{record.content}</p> });
  }

  return rows;
}

export function RecordDetailSheet({
  record,
  open,
  onOpenChange,
  onEdit,
  onShare,
  onDelete,
  readOnly = false,
}: Props) {
  if (!record) return null;

  const cfg = RECORD_TYPE_CONFIG[record.record_type as RecordType];
  const mention = (record.type_data as Record<string, unknown> | null)?.mention as
    | { enabled?: boolean; professional_name?: string; note?: string }
    | undefined;
  const hasMention = mention?.enabled === true;

  const displayTitle =
    record.title?.trim() ||
    record.content?.trim()?.slice(0, 80) ||
    cfg?.label;

  const fields = renderTypeFields(record);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[24px] px-0 pb-0 pt-0"
      >
        <SheetTitle className="sr-only">Detalhe do registro</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        <div className="px-5 pt-3 pb-4">
          {record.record_type && (
            <RecordTypeChip type={record.record_type as RecordType} size="md" />
          )}
          <h2 className="mt-2 text-[18px] font-bold text-foreground leading-snug">
            {displayTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {record.child?.name && `${record.child.name} · `}
            {formatDateBR(record.record_date)}
            {record.shift ? ` · ${SHIFT_LABELS[record.shift as RecordShift]}` : ""}
          </p>
        </div>

        <div className="h-px bg-[#EEF0F4]" />

        <div className="px-5 py-4 space-y-4">
          {/* Mention pending banner */}
          {hasMention && (
            <div className="flex items-start gap-3 rounded-[14px] bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400">
                <Bell className="h-3.5 w-3.5 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-900">
                  Pra mencionar com {mention?.professional_name || "o profissional"}
                </p>
                {mention?.note && (
                  <p className="mt-0.5 text-xs text-amber-700">{mention.note}</p>
                )}
              </div>
            </div>
          )}

          {/* Fields card */}
          {fields.length > 0 && (
            <div className="rounded-[14px] border border-[#EEF0F4] bg-white px-4 py-1">
              {fields.map(({ label, value }) => (
                <FieldRow key={label} label={label}>
                  {value}
                </FieldRow>
              ))}
            </div>
          )}

          {/* Attachments */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Anexos
            </p>
            <RecordAttachmentsSection recordId={record.id} />
          </div>

          {/* Actions — ocultas em modo readOnly */}
          {!readOnly && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Ações
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onEdit(record); }}
                  className="flex items-center justify-center gap-2 rounded-[12px] border border-[#EEF0F4] bg-white py-3 text-sm font-semibold text-foreground hover:bg-[#F6F7FB]"
                >
                  <Pencil className="h-4 w-4" style={{ color: "#4F46E5" }} strokeWidth={1.75} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); onShare(record); }}
                  className="flex items-center justify-center gap-2 rounded-[12px] border border-[#EEF0F4] bg-white py-3 text-sm font-semibold text-foreground hover:bg-[#F6F7FB]"
                >
                  <Share2 className="h-4 w-4" style={{ color: "#F97316" }} strokeWidth={1.75} />
                  Compartilhar
                </button>
              </div>
              <button
                type="button"
                onClick={() => { onOpenChange(false); onDelete(record); }}
                className="mt-2 w-full rounded-[12px] border border-red-200 bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
              >
                <Trash2 className="mr-2 inline h-4 w-4" strokeWidth={1.75} />
                Excluir registro
              </button>
            </div>
          )}
        </div>

        <div className="h-8" />
      </SheetContent>
    </Sheet>
  );
}
