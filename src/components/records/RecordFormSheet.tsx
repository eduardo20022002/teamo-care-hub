import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Mic,
  Moon,
  Sun,
  Sunrise,
  Sunset,
  Video,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RECORD_TYPE_CONFIG,
  RECORD_SHIFTS,
  SHIFT_LABELS,
  type RecordType,
  type RecordShift,
  type DiaryRecordInput,
} from "@/lib/validation";
import { RecordTypeChip } from "./RecordTypeChip";
import type { DiaryRecordWithRelations } from "@/services/attendance.service";
import type { Child, Professional } from "@/types/database";
import { listAgendaEvents } from "@/services/agenda/events.service";
import type { AgendaEventWithRelations } from "@/types/agenda";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Shared primitive components ─────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[12.5px] font-semibold text-foreground">
      {children}
    </p>
  );
}

function StyledTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#4F46E5] focus:bg-[#FAFBFF] focus:outline-none focus:ring-4 focus:ring-[rgba(79,70,229,0.10)] resize-none"
    />
  );
}

function StyledInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-[44px] w-full min-w-0 max-w-full rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#4F46E5] focus:bg-[#FAFBFF] focus:outline-none focus:ring-4 focus:ring-[rgba(79,70,229,0.10)]"
    />
  );
}

// ─── ChipGroup with disk checkmark for multi-select ──────────────────────────

function ChipGroup({
  options,
  value,
  onChange,
  color,
  multi = false,
}: {
  options: { key: string; label: string }[];
  value: string | string[];
  onChange: (v: string | string[]) => void;
  color: string;
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (key: string) => {
    if (multi) {
      const next = selected.includes(key)
        ? selected.filter((k) => k !== key)
        : [...selected, key];
      onChange(next);
    } else {
      onChange(selected[0] === key ? "" : key);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ key, label }) => {
        const active = selected.includes(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className="inline-flex items-center gap-1.5 rounded-[9px] border-[1.5px] px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={
              active
                ? { background: `${color}14`, borderColor: color, color }
                : { background: "#fff", borderColor: "#E5E7EB", color: "#374151" }
            }
          >
            {active && multi && (
              <span
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{ width: 14, height: 14, background: color }}
              >
                {/* checkmark SVG */}
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 8 8"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.5 4L3 5.5L6.5 2"
                    stroke="white"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── IntensityWaves — 5 wave-SVG boxes of growing size ───────────────────────

function IntensityWaves({
  value,
  onChange,
  color,
  leftLabel = "Leve",
  rightLabel = "Intenso",
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div>
      <div className="flex items-end gap-1.5">
        <span className="mb-1.5 text-[11px] font-semibold text-[#9CA3AF]">
          {leftLabel}
        </span>
        <div className="flex flex-1 items-end justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= value;
            const size = 18 + n; // 19, 20, 21, 22, 23 px
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className="flex items-center justify-center rounded-[9px] border-[1.5px] transition-colors"
                style={{
                  width: 40,
                  height: 38,
                  background: active ? `${color}14` : "#F6F7FB",
                  borderColor: active ? color : "#E5E7EB",
                }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={active ? color : "#D1D5DB"}
                  strokeWidth={2}
                  strokeLinecap="round"
                >
                  <path d="M3 12c1.5-2 3-2 4.5 0S10.5 14 12 12s3-2 4.5 0S19.5 14 21 12" />
                </svg>
              </button>
            );
          })}
        </div>
        <span className="mb-1.5 text-[11px] font-semibold text-[#9CA3AF]">
          {rightLabel}
        </span>
      </div>
    </div>
  );
}

// ─── MoonScale — 5 moon-SVG boxes with growing fill opacity ──────────────────

function MoonScale({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-end gap-1.5">
        <span className="mb-1.5 text-[11px] font-semibold text-[#9CA3AF]">
          Ruim
        </span>
        <div className="flex flex-1 items-end justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= value;
            const size = 16 + n * 2; // 18, 20, 22, 24, 26 px
            const fillOpacity = active ? n * 0.18 : 0;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className="flex items-center justify-center rounded-[9px] border-[1.5px] transition-colors"
                style={{
                  width: 40,
                  height: 44,
                  background: active ? `${color}14` : "#F6F7FB",
                  borderColor: active ? color : "#E5E7EB",
                }}
              >
                <svg
                  width={size}
                  height={size}
                  viewBox="0 0 24 24"
                  fill={color}
                  fillOpacity={fillOpacity}
                  stroke={active ? color : "#D1D5DB"}
                  strokeWidth={1.5}
                >
                  <path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z" />
                </svg>
              </button>
            );
          })}
        </div>
        <span className="mb-1.5 text-[11px] font-semibold text-[#9CA3AF]">
          Ótimo
        </span>
      </div>
    </div>
  );
}

// ─── TurnPicker — 4-column grid shift selector ───────────────────────────────

const SHIFT_ORDER = ["madrugada", "manha", "tarde", "noite"] as const;

const SHIFT_ICONS: Record<string, LucideIcon> = {
  madrugada: Moon,
  manha: Sunrise,
  tarde: Sun,
  noite: Sunset,
};

function TurnPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: RecordShift) => void;
  color: string;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SHIFT_ORDER.map((s) => {
        const active = value === s;
        const Icon = SHIFT_ICONS[s];
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s as RecordShift)}
            className="flex flex-col items-center justify-center gap-1 rounded-[11px] border-[1.5px] transition-all"
            style={{
              height: 56,
              background: active ? `${color}14` : "#F6F7FB",
              borderColor: active ? color : "#E5E7EB",
              boxShadow: active ? `0 0 0 3px ${color}1A` : "none",
            }}
          >
            <Icon
              className="h-4 w-4"
              strokeWidth={active ? 2 : 1.75}
              style={{ color: active ? color : "#9CA3AF" }}
            />
            <span
              className="text-[11px] font-bold"
              style={{ color: active ? color : "#6B7280" }}
            >
              {SHIFT_LABELS[s as RecordShift]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── DateShiftRow — date + TurnPicker ────────────────────────────────────────

function DateShiftRow({
  date,
  shift,
  onDate,
  onShift,
  color,
  showShift = true,
}: {
  date: string;
  shift: string;
  onDate: (v: string) => void;
  onShift: (v: RecordShift) => void;
  color: string;
  showShift?: boolean;
}) {
  if (!showShift) {
    return (
      <div className="min-w-0">
        <FieldLabel>Data</FieldLabel>
        <StyledInput type="date" value={date} onChange={onDate} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="min-w-0">
        <FieldLabel>Data</FieldLabel>
        <StyledInput type="date" value={date} onChange={onDate} />
      </div>
      <div>
        <FieldLabel>Turno</FieldLabel>
        <TurnPicker value={shift} onChange={onShift} color={color} />
      </div>
    </div>
  );
}

// ─── YesNoBlock — separate flex buttons + optional sub-block ─────────────────

function YesNoBlock({
  value,
  onChange,
  color,
  children,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["Não", "Sim"] as const).map((label) => {
          const active = (label === "Sim") === value;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onChange(label === "Sim")}
              className="flex flex-1 items-center justify-center rounded-[11px] border-[1.5px] text-sm font-semibold transition-colors"
              style={{
                height: 40,
                background: active ? color : "#F6F7FB",
                borderColor: active ? color : "#E5E7EB",
                color: active ? "#fff" : "#6B7280",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {value && children && (
        <div
          className="rounded-[11px] border space-y-3 p-3"
          style={{ background: "#FAFBFD", borderColor: "#EEF0F4" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── AttachmentRow — configurable file-type buttons ──────────────────────────

type AttachBtn = "Foto" | "Vídeo" | "Áudio" | "Arquivo";

const ATTACH_ICONS: Record<AttachBtn, LucideIcon> = {
  Foto: Camera,
  Vídeo: Video,
  Áudio: Mic,
  Arquivo: FileText,
};

function AttachmentRow({
  buttons,
  color,
  onSelect,
}: {
  buttons: AttachBtn[];
  color: string;
  onSelect?: (type: AttachBtn, files: File[]) => void;
}) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  // Limitado aos tipos que o bucket "attachments" aceita (PDF/imagem/áudio/vídeo).
  // Office (.doc/.xls/.txt) não é suportado pelo Storage e era rejeitado em silêncio.
  const acceptMap: Record<AttachBtn, string> = {
    Foto: "image/*",
    Vídeo: "video/*",
    Áudio: "audio/*",
    Arquivo: ".pdf,application/pdf,image/*",
  };
  return (
    <div>
      <FieldLabel>Anexo (opcional)</FieldLabel>
      <div className="flex gap-2">
        {buttons.map((btn) => {
          const Icon = ATTACH_ICONS[btn];
          return (
            <button
              key={btn}
              type="button"
              onClick={() => refs.current[btn]?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-white text-xs font-semibold text-[#374151] transition-colors hover:bg-[#F6F7FB]"
              style={{ height: 44 }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color }} strokeWidth={2} />
              {btn}
              <input
                ref={(el) => { refs.current[btn] = el; }}
                type="file"
                accept={acceptMap[btn]}
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length && onSelect) onSelect(btn, files);
                  e.target.value = "";
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Type-specific field sections ────────────────────────────────────────────

function ComportamentoFields({
  td,
  update,
  content,
  setContent,
  color,
  onAttach,
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
  onAttach?: (type: AttachBtn, files: File[]) => void;
}) {
  const DURACAO = [
    { key: "menos5", label: "menos de 5 min" },
    { key: "5a15", label: "5–15 min" },
    { key: "15a30", label: "15–30 min" },
    { key: "mais30", label: "mais de 30 min" },
  ];
  const GATILHOS = [
    { key: "transicao", label: "Transição" },
    { key: "demanda", label: "Demanda" },
    { key: "sensorial", label: "Sensorial" },
    { key: "fome_cansaco", label: "Fome / cansaço" },
    { key: "mudanca_rotina", label: "Mudança de rotina" },
    { key: "barulho", label: "Barulho" },
    { key: "toque", label: "Toque" },
    { key: "outro", label: "Outro" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>O que aconteceu</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Descreva o que aconteceu..."
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>Intensidade</FieldLabel>
        <IntensityWaves
          value={(td.intensity as number) ?? 0}
          onChange={(v) => update({ intensity: v })}
          color={color}
        />
      </div>
      <div>
        <FieldLabel>Duração</FieldLabel>
        <ChipGroup
          options={DURACAO}
          value={(td.duration as string) ?? ""}
          onChange={(v) => update({ duration: v as string })}
          color={color}
        />
      </div>
      <div>
        <FieldLabel>O que veio antes (gatilhos)</FieldLabel>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Selecione todos que se aplicam.
        </p>
        <ChipGroup
          options={GATILHOS}
          value={(td.triggers as string[]) ?? []}
          onChange={(v) => update({ triggers: v })}
          color={color}
          multi
        />
      </div>
      <div>
        <FieldLabel>O que ajudou</FieldLabel>
        <StyledTextarea
          value={(td.helped as string) ?? ""}
          onChange={(v) => update({ helped: v })}
          placeholder="O que funcionou pra acalmar..."
          rows={2}
        />
      </div>
      <AttachmentRow
        buttons={["Foto", "Vídeo", "Áudio"]}
        color={color}
        onSelect={onAttach}
      />
    </div>
  );
}

function ConquistaFields({
  td,
  update,
  content,
  setContent,
  color,
  onAttach,
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
  onAttach?: (type: AttachBtn, files: File[]) => void;
}) {
  const AREAS = [
    { key: "comunicacao", label: "Comunicação" },
    { key: "autonomia", label: "Autonomia" },
    { key: "socializacao", label: "Socialização" },
    { key: "motor", label: "Motor" },
    { key: "emocional", label: "Emocional" },
    { key: "escolar", label: "Escolar" },
    { key: "outro", label: "Outro" },
  ];
  const LOCAIS = [
    { key: "em_casa", label: "Em casa" },
    { key: "na_terapia", label: "Na terapia" },
    { key: "na_escola", label: "Na escola" },
    { key: "em_passeio", label: "Em passeio" },
    { key: "outro", label: "Outro" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>O que aconteceu</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Ex: disse o nome da professora pela primeira vez"
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>Área da conquista</FieldLabel>
        <ChipGroup
          options={AREAS}
          value={(td.area as string) ?? ""}
          onChange={(v) => update({ area: v as string })}
          color={color}
        />
      </div>
      <div>
        <FieldLabel>Onde aconteceu</FieldLabel>
        <ChipGroup
          options={LOCAIS}
          value={(td.location as string) ?? ""}
          onChange={(v) => update({ location: v as string })}
          color={color}
        />
      </div>
      <div>
        <AttachmentRow
          buttons={["Foto", "Vídeo"]}
          color={color}
          onSelect={onAttach}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground italic">
          Registre o momento — você vai querer voltar aqui.
        </p>
      </div>
    </div>
  );
}

function SonoFields({
  td,
  update,
  content,
  setContent,
  color,
  onAttach,
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
  onAttach?: (type: AttachBtn, files: File[]) => void;
}) {
  const woke = (td.woke_up as boolean) ?? false;
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Data de início (noite anterior)</FieldLabel>
        <StyledInput
          type="date"
          value={(td.date_start as string) ?? ""}
          onChange={(v) => update({ date_start: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <FieldLabel>Dormiu às</FieldLabel>
          <StyledInput
            type="time"
            value={(td.sleep_time as string) ?? ""}
            onChange={(v) => update({ sleep_time: v })}
          />
        </div>
        <div className="min-w-0">
          <FieldLabel>Acordou às</FieldLabel>
          <StyledInput
            type="time"
            value={(td.wake_time as string) ?? ""}
            onChange={(v) => update({ wake_time: v })}
          />
        </div>
      </div>
      <div>
        <FieldLabel>Qualidade do sono</FieldLabel>
        <MoonScale
          value={(td.quality as number) ?? 0}
          onChange={(v) => update({ quality: v })}
          color={color}
        />
      </div>
      <div>
        <FieldLabel>Acordou durante a noite?</FieldLabel>
        <YesNoBlock
          value={woke}
          onChange={(v) => update({ woke_up: v })}
          color={color}
        >
          <div>
            <FieldLabel>Quantas vezes</FieldLabel>
            <StyledInput
              type="number"
              value={String((td.wake_count as number) ?? "")}
              onChange={(v) => update({ wake_count: Number(v) })}
              placeholder="2"
            />
          </div>
          <div>
            <FieldLabel>O que aconteceu</FieldLabel>
            <StyledTextarea
              value={(td.wake_content as string) ?? ""}
              onChange={(v) => update({ wake_content: v })}
              placeholder="Pediu água, chorou, voltou a dormir..."
              rows={2}
            />
          </div>
        </YesNoBlock>
      </div>
      <div>
        <FieldLabel>Observações (opcional)</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Como ele estava ao acordar, sonhos contados..."
          rows={2}
        />
      </div>
      <AttachmentRow
        buttons={["Foto", "Vídeo", "Áudio"]}
        color={color}
        onSelect={onAttach}
      />
    </div>
  );
}

function SaudeFields({
  td,
  update,
  content,
  setContent,
  color,
  onAttach,
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
  onAttach?: (type: AttachBtn, files: File[]) => void;
}) {
  const SINTOMAS = [
    { key: "febre", label: "Febre" },
    { key: "vomito", label: "Vômito" },
    { key: "diarreia", label: "Diarreia" },
    { key: "constipacao", label: "Constipação" },
    { key: "dor", label: "Dor" },
    { key: "reacao_med", label: "Reação a medicamento" },
    { key: "outro", label: "Outro" },
  ];
  const gaveMeds = (td.gave_meds as boolean) ?? false;
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>O que está acontecendo</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Descreva os sintomas observados..."
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>Tipo de sintoma</FieldLabel>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Permite múltipla seleção.
        </p>
        <ChipGroup
          options={SINTOMAS}
          value={(td.symptoms as string[]) ?? []}
          onChange={(v) => update({ symptoms: v })}
          color={color}
          multi
        />
      </div>
      <div>
        <FieldLabel>Intensidade</FieldLabel>
        <IntensityWaves
          value={(td.intensity as number) ?? 0}
          onChange={(v) => update({ intensity: v })}
          color={color}
        />
      </div>
      <div>
        <FieldLabel>Deu alguma medicação como resposta?</FieldLabel>
        <YesNoBlock
          value={gaveMeds}
          onChange={(v) => update({ gave_meds: v })}
          color={color}
        >
          <div>
            <FieldLabel>Qual medicamento e qual dose</FieldLabel>
            <StyledInput
              value={(td.meds_description as string) ?? ""}
              onChange={(v) => update({ meds_description: v })}
              placeholder="Ex: Dipirona infantil · 7ml"
            />
          </div>
        </YesNoBlock>
      </div>
      <div>
        <FieldLabel>Observações (opcional)</FieldLabel>
        <StyledTextarea
          value={(td.observations as string) ?? ""}
          onChange={(v) => update({ observations: v })}
          placeholder="Outras informações relevantes..."
          rows={2}
        />
      </div>
      <AttachmentRow
        buttons={["Foto", "Vídeo", "Áudio"]}
        color={color}
        onSelect={onAttach}
      />
    </div>
  );
}

function AlimentacaoFields({
  td,
  update,
  content,
  setContent,
  color,
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
}) {
  const REFEICOES = [
    { key: "cafe", label: "Café" },
    { key: "almoco", label: "Almoço" },
    { key: "lanche", label: "Lanche" },
    { key: "jantar", label: "Jantar" },
    { key: "madrugada", label: "Madrugada" },
  ];
  const RESTRICOES = [
    { key: "sem_gluten", label: "Sem glúten" },
    { key: "sem_laticinios", label: "Sem laticínios" },
    { key: "sem_acucar", label: "Sem açúcar" },
    { key: "outra", label: "Outra" },
  ];
  const refused = (td.refused as boolean) ?? false;
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Refeição</FieldLabel>
        <p className="mb-2 text-[11px] text-muted-foreground">
          O turno aqui indica qual refeição.
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {REFEICOES.map(({ key, label }) => {
            const active = td.meal === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ meal: key })}
                className="shrink-0 rounded-[9px] border-[1.5px] px-4 text-xs font-semibold transition-colors"
                style={{
                  height: 34,
                  background: active ? `${color}14` : "#F6F7FB",
                  borderColor: active ? color : "#E5E7EB",
                  color: active ? color : "#6B7280",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <FieldLabel>O que comeu</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Arroz, frango grelhado, brócolis..."
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>Recusou algum alimento?</FieldLabel>
        <YesNoBlock
          value={refused}
          onChange={(v) => update({ refused: v })}
          color={color}
        >
          <div>
            <FieldLabel>O que recusou</FieldLabel>
            <StyledInput
              value={(td.refused_what as string) ?? ""}
              onChange={(v) => update({ refused_what: v })}
              placeholder="Ex: Salada de tomate"
            />
          </div>
          <div>
            <FieldLabel>Motivo aparente</FieldLabel>
            <StyledInput
              value={(td.refused_reason as string) ?? ""}
              onChange={(v) => update({ refused_reason: v })}
              placeholder="Ex: Textura"
            />
          </div>
        </YesNoBlock>
      </div>
      <div>
        <FieldLabel>Restrições ativas nessa refeição (opcional)</FieldLabel>
        <ChipGroup
          options={RESTRICOES}
          value={(td.restrictions as string[]) ?? []}
          onChange={(v) => update({ restrictions: v })}
          color={color}
          multi
        />
      </div>
      <div>
        <FieldLabel>Observações (opcional)</FieldLabel>
        <StyledTextarea
          value={(td.observations as string) ?? ""}
          onChange={(v) => update({ observations: v })}
          placeholder="Outras observações sobre a refeição..."
          rows={2}
        />
      </div>
    </div>
  );
}

function SensorialFields({
  td,
  update,
  content,
  setContent,
  color,
  onAttach,
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
  onAttach?: (type: AttachBtn, files: File[]) => void;
}) {
  const GATILHOS = [
    { key: "barulho", label: "Barulho" },
    { key: "luz_intensa", label: "Luz intensa" },
    { key: "toque", label: "Toque" },
    { key: "textura_roupa", label: "Textura de roupa" },
    { key: "cheiro", label: "Cheiro" },
    { key: "multidao", label: "Multidão" },
    { key: "outro", label: "Outro" },
  ];
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>O que aconteceu</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Descreva a situação..."
          rows={3}
        />
      </div>
      <div>
        <FieldLabel>Gatilho sensorial</FieldLabel>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Permite múltipla seleção.
        </p>
        <ChipGroup
          options={GATILHOS}
          value={(td.triggers as string[]) ?? []}
          onChange={(v) => update({ triggers: v })}
          color={color}
          multi
        />
      </div>
      <div>
        <FieldLabel>Reação da criança</FieldLabel>
        <StyledTextarea
          value={(td.reaction as string) ?? ""}
          onChange={(v) => update({ reaction: v })}
          placeholder="Chorou, saiu correndo, fechou os ouvidos..."
          rows={2}
        />
      </div>
      <div>
        <FieldLabel>Estratégia que funcionou (opcional)</FieldLabel>
        <StyledTextarea
          value={(td.strategy as string) ?? ""}
          onChange={(v) => update({ strategy: v })}
          placeholder="O que ajudou a acalmar ou evitar a reação..."
          rows={2}
        />
      </div>
      <AttachmentRow
        buttons={["Foto", "Vídeo", "Áudio"]}
        color={color}
        onSelect={onAttach}
      />
    </div>
  );
}

function LivreFields({
  content,
  setContent,
  color,
  onAttach,
}: {
  content: string;
  setContent: (v: string) => void;
  color: string;
  onAttach?: (type: AttachBtn, files: File[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Anotação</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Anote qualquer observação, detalhe ou ideia que queira lembrar..."
          rows={8}
        />
      </div>
      <AttachmentRow
        buttons={["Foto", "Vídeo", "Áudio", "Arquivo"]}
        color={color}
        onSelect={onAttach}
      />
    </div>
  );
}

// ─── "Quero mencionar" expandable section ────────────────────────────────────

function MentionSection({
  open,
  onToggle,
  professionals,
  profId,
  setProfId,
  note,
  setNote,
  agendaEvents,
  agendaEventId,
  setAgendaEventId,
}: {
  open: boolean;
  onToggle: () => void;
  professionals: Professional[];
  profId: string;
  setProfId: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  agendaEvents: AgendaEventWithRelations[];
  agendaEventId: string;
  setAgendaEventId: (v: string) => void;
}) {
  return (
    <div className="rounded-[14px] border border-[#FCD34D] bg-[#FFFBEB] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <Bell className="h-4 w-4 text-amber-600" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-amber-900">
            Quero mencionar isso com alguém
          </p>
          <p className="text-[11px] text-amber-700">
            {open ? "Selecione o profissional e, opcionalmente, o evento." : "Te avisamos na data certa."}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-amber-600 shrink-0" strokeWidth={2} />
        ) : (
          <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className="border-t border-amber-200 px-4 pb-4 pt-3 space-y-3">
          <div>
            <FieldLabel>Para quem</FieldLabel>
            <Select value={profId} onValueChange={setProfId}>
              <SelectTrigger className="h-[44px] rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-white text-sm">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.specialty ? ` · ${p.specialty}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seletor de evento da agenda — aparece quando profissional está selecionado */}
          {profId && (
            <div>
              <FieldLabel>Em qual consulta/sessão? (opcional)</FieldLabel>
              <Select value={agendaEventId || "__none__"} onValueChange={(v) => setAgendaEventId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-[44px] rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-white text-sm">
                  <SelectValue placeholder="Selecione um evento (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem vínculo com evento</SelectItem>
                  {agendaEvents.map((ev) => {
                    const d = new Date(ev.start_at);
                    const label = `${ev.title} · ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                    return (
                      <SelectItem key={ev.id} value={ev.id}>
                        {label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {agendaEventId && (
                <p className="mt-1 text-[11px] text-amber-700">
                  ✓ Um indicador vai aparecer nesse evento da agenda.
                </p>
              )}
            </div>
          )}

          <div>
            <FieldLabel>Observação (opcional)</FieldLabel>
            <StyledTextarea
              value={note}
              onChange={setNote}
              placeholder="Ex: Levar na próxima consulta, perguntar sobre dosagem..."
              rows={2}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType: RecordType;
  childrenList: Child[];
  professionals: Professional[];
  initial?: DiaryRecordWithRelations | null;
  defaultChildId?: string;
  onSave: (input: DiaryRecordInput, files: File[]) => Promise<void>;
  submitting: boolean;
}

export function RecordFormSheet({
  open,
  onOpenChange,
  recordType,
  childrenList,
  professionals,
  initial,
  defaultChildId,
  onSave,
  submitting,
}: Props) {
  const cfg = RECORD_TYPE_CONFIG[recordType];
  const isEdit = !!initial;

  // Shared state
  const [childId, setChildId] = useState("");
  const [recordDate, setRecordDate] = useState(todayISO());
  const [shift, setShift] = useState<RecordShift | "">("");
  const [content, setContent] = useState("");
  const [typeData, setTypeData] = useState<Record<string, unknown>>({});
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionProfId, setMentionProfId] = useState("");
  const [mentionNote, setMentionNote] = useState("");
  const [mentionAgendaEventId, setMentionAgendaEventId] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Carrega eventos futuros da agenda para o seletor "Em qual consulta?"
  const agendaEventsQuery = useQuery({
    queryKey: ["agenda-events-for-mention"],
    queryFn: () =>
      listAgendaEvents({
        from: new Date().toISOString(),
        to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    enabled: open && mentionOpen && !!mentionProfId,
    staleTime: 60_000,
  });
  const agendaEventsForMention = agendaEventsQuery.data ?? [];

  const updateTD = useCallback((patch: Record<string, unknown>) => {
    setTypeData((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleAttach = useCallback((_type: AttachBtn, files: File[]) => {
    setAttachedFiles((prev) => [...prev, ...files]);
  }, []);

  // Types that default to mention open on new records
  const defaultMentionOpen =
    recordType === "comportamento" || recordType === "saude";

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setChildId(initial.child_id);
      setRecordDate(initial.record_date);
      setShift((initial.shift as RecordShift) ?? "");
      setContent(initial.content ?? "");
      const td = { ...((initial.type_data ?? {}) as Record<string, unknown>) };
      const mention = td.mention as
        | { enabled?: boolean; professional_id?: string; note?: string }
        | undefined;
      if (mention?.enabled) {
        setMentionOpen(true);
        setMentionProfId(mention.professional_id ?? "");
        setMentionNote(mention.note ?? "");
        setMentionAgendaEventId((mention as Record<string, unknown>).agenda_event_id as string ?? "");
        delete td.mention;
      } else {
        setMentionOpen(false);
        setMentionProfId("");
        setMentionNote("");
        setMentionAgendaEventId("");
      }
      setTypeData(td);
    } else {
      setChildId(defaultChildId ?? (childrenList.length === 1 ? childrenList[0].id : ""));
      setRecordDate(todayISO());
      setShift("tarde");
      setContent("");
      setTypeData({});
      setMentionOpen(defaultMentionOpen);
      setMentionProfId("");
      setMentionNote("");
      setMentionAgendaEventId("");
    }
    setAttachedFiles([]);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, childrenList]);

  const handleSave = async () => {
    if (!childId) {
      setError("Selecione uma criança.");
      return;
    }
    if (!recordDate) {
      setError("Informe a data.");
      return;
    }

    const finalTypeData: Record<string, unknown> = { ...typeData };
    if (mentionOpen && mentionProfId) {
      const prof = professionals.find((p) => p.id === mentionProfId);
      const linkedEvent = agendaEventsForMention.find((e) => e.id === mentionAgendaEventId);
      finalTypeData.mention = {
        enabled: true,
        professional_id: mentionProfId,
        professional_name: prof?.name ?? "",
        note: mentionNote,
        ...(mentionAgendaEventId
          ? {
              agenda_event_id: mentionAgendaEventId,
              agenda_event_title: linkedEvent?.title ?? "",
            }
          : {}),
      };
    }

    // Build auto-title for list display
    let autoTitle = "";
    if (recordType === "comportamento") autoTitle = content.slice(0, 80);
    else if (recordType === "conquista") autoTitle = content.slice(0, 80);
    else if (recordType === "sono") {
      const st = typeData.sleep_time as string;
      const wt = typeData.wake_time as string;
      autoTitle = st && wt ? `${st} → ${wt}` : "Registro de sono";
    } else if (recordType === "saude") autoTitle = content.slice(0, 80);
    else if (recordType === "alimentacao") {
      const meals: Record<string, string> = {
        cafe: "Café da manhã",
        almoco: "Almoço",
        lanche: "Lanche",
        jantar: "Jantar",
        madrugada: "Madrugada",
      };
      autoTitle = meals[typeData.meal as string] ?? "Alimentação";
    } else if (recordType === "sensorial") autoTitle = content.slice(0, 80);
    else if (recordType === "livre") autoTitle = content.slice(0, 80);

    const input: DiaryRecordInput = {
      child_id: childId,
      record_type: recordType,
      shift: (shift as RecordShift) || null,
      record_date: recordDate,
      title: autoTitle || null,
      content: content || null,
      type_data: finalTypeData,
    };

    setError(null);
    await onSave(input, attachedFiles);
  };

  const showShift = recordType !== "alimentacao" && recordType !== "sono";

  const typeTitle =
    recordType === "livre" ? "Nova anotação" : `Novo · ${cfg.label}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-[24px] px-0 pb-0 pt-0"
      >
        <SheetTitle className="sr-only">{typeTitle}</SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        <div className="px-5 pt-3 pb-4">
          {/* Type chip — o X de fechar é o padrão do SheetContent (canto sup. direito) */}
          <div className="mb-2 flex items-center">
            <RecordTypeChip type={recordType} size="md" />
          </div>

          <h2 className="text-[20px] font-bold text-foreground leading-tight">
            {typeTitle}
          </h2>
          {childrenList.length === 1 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              Para {childrenList[0].name}
            </p>
          )}
        </div>

        <div className="h-px bg-[#EEF0F4]" />

        <div className="space-y-5 px-5 py-5">
          {/* Child selector (only if multiple children) */}
          {childrenList.length > 1 && (
            <div>
              <FieldLabel>Criança</FieldLabel>
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger className="h-[44px] rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] text-sm">
                  <SelectValue placeholder="Selecione a criança" />
                </SelectTrigger>
                <SelectContent>
                  {childrenList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date + Shift (except Sono which has its own date fields, and Alimentação which has MealPicker) */}
          {showShift && (
            <DateShiftRow
              date={recordDate}
              shift={shift}
              onDate={setRecordDate}
              onShift={(s) => setShift(s)}
              color={cfg.color}
              showShift
            />
          )}
          {!showShift && recordType !== "sono" && (
            <DateShiftRow
              date={recordDate}
              shift={shift}
              onDate={setRecordDate}
              onShift={(s) => setShift(s)}
              color={cfg.color}
              showShift={false}
            />
          )}

          {/* Type-specific fields */}
          {recordType === "comportamento" && (
            <ComportamentoFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
              onAttach={handleAttach}
            />
          )}
          {recordType === "conquista" && (
            <ConquistaFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
              onAttach={handleAttach}
            />
          )}
          {recordType === "sono" && (
            <SonoFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
              onAttach={handleAttach}
            />
          )}
          {recordType === "saude" && (
            <SaudeFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
              onAttach={handleAttach}
            />
          )}
          {recordType === "alimentacao" && (
            <AlimentacaoFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
            />
          )}
          {recordType === "sensorial" && (
            <SensorialFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
              onAttach={handleAttach}
            />
          )}
          {recordType === "livre" && (
            <LivreFields
              content={content}
              setContent={setContent}
              color={cfg.color}
              onAttach={handleAttach}
            />
          )}

          {/* Mention section */}
          {professionals.length > 0 && (
            <MentionSection
              open={mentionOpen}
              onToggle={() => setMentionOpen((v) => !v)}
              professionals={professionals}
              profId={mentionProfId}
              setProfId={setMentionProfId}
              note={mentionNote}
              setNote={setMentionNote}
              agendaEvents={agendaEventsForMention}
              agendaEventId={mentionAgendaEventId}
              setAgendaEventId={setMentionAgendaEventId}
            />
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="space-y-3 px-5 pb-8 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="flex h-[50px] w-full items-center justify-center rounded-[12px] text-sm font-semibold text-white disabled:opacity-45"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: submitting ? "none" : BRAND_SHADOW,
            }}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isEdit ? (
              "Salvar alterações"
            ) : (
              "Salvar registro"
            )}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full py-2 text-sm text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
