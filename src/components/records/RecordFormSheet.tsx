import { useEffect, useState, useCallback } from "react";
import { Bell, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
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

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Shared primitive components ─────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm font-semibold text-foreground">{children}</p>;
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
      className="h-[44px] w-full rounded-[11px] border-[1.5px] border-[#E5E7EB] bg-[#F6F7FB] px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#4F46E5] focus:bg-[#FAFBFF] focus:outline-none focus:ring-4 focus:ring-[rgba(79,70,229,0.10)]"
    />
  );
}

// Chip single-select
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
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors"
            style={
              active
                ? { background: color, borderColor: color, color: "#fff" }
                : { background: "#fff", borderColor: "#E5E7EB", color: "#374151" }
            }
          >
            {active && multi && <span className="text-[10px]">✓</span>}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Wave/moon intensity scale (1–5)
function IntensityScale({
  value,
  onChange,
  color,
  leftLabel = "Leve",
  rightLabel = "Intenso",
  icon = "~",
}: {
  value: number;
  onChange: (v: number) => void;
  color: string;
  leftLabel?: string;
  rightLabel?: string;
  icon?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">{leftLabel}</span>
        <div className="flex flex-1 items-center justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border-[1.5px] text-base font-bold transition-colors"
              style={
                n <= value
                  ? { background: color, borderColor: color, color: "#fff" }
                  : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#9CA3AF" }
              }
            >
              {icon}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">{rightLabel}</span>
      </div>
    </div>
  );
}

// Toggle Não / Sim
function YesNoToggle({
  value,
  onChange,
  color,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div className="grid grid-cols-2 rounded-[11px] border border-[#E5E7EB] overflow-hidden">
      {(["Não", "Sim"] as const).map((label) => {
        const active = (label === "Sim") === value;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(label === "Sim")}
            className="py-2.5 text-sm font-semibold transition-colors"
            style={
              active
                ? { background: color, color: "#fff" }
                : { background: "#F6F7FB", color: "#6B7280" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Date+Shift row
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
      <div>
        <FieldLabel>Data</FieldLabel>
        <StyledInput type="date" value={date} onChange={onDate} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Data</FieldLabel>
        <StyledInput type="date" value={date} onChange={onDate} />
      </div>
      <div>
        <FieldLabel>Turno</FieldLabel>
        <div className="flex flex-col gap-1">
          {RECORD_SHIFTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onShift(s)}
              className="rounded-[10px] border px-3 py-2 text-xs font-semibold transition-colors text-left"
              style={
                shift === s
                  ? { background: color, borderColor: color, color: "#fff" }
                  : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#6B7280" }
              }
            >
              {SHIFT_LABELS[s]}
            </button>
          ))}
        </div>
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
}: {
  td: Record<string, unknown>;
  update: (p: Record<string, unknown>) => void;
  content: string;
  setContent: (v: string) => void;
  color: string;
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
        <IntensityScale
          value={(td.intensity as number) ?? 0}
          onChange={(v) => update({ intensity: v })}
          color={color}
          icon="∿"
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
        <p className="mb-2 text-[11px] text-muted-foreground">Selecione todos que se aplicam.</p>
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
    </div>
  );
}

function ConquistaFields({
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
      <p className="text-[11px] text-muted-foreground italic">
        Registre o momento — você vai querer voltar aqui.
      </p>
    </div>
  );
}

function SonoFields({
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
        <div>
          <FieldLabel>Dormiu às</FieldLabel>
          <StyledInput
            type="time"
            value={(td.sleep_time as string) ?? ""}
            onChange={(v) => update({ sleep_time: v })}
          />
        </div>
        <div>
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
        <IntensityScale
          value={(td.quality as number) ?? 0}
          onChange={(v) => update({ quality: v })}
          color={color}
          leftLabel="Ruim"
          rightLabel="Ótimo"
          icon="☽"
        />
      </div>
      <div>
        <FieldLabel>Acordou durante a noite?</FieldLabel>
        <YesNoToggle
          value={woke}
          onChange={(v) => update({ woke_up: v })}
          color={color}
        />
      </div>
      {woke && (
        <div className="rounded-[14px] bg-[#F6F7FB] p-4 space-y-3">
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
        </div>
      )}
      <div>
        <FieldLabel>Observações (opcional)</FieldLabel>
        <StyledTextarea
          value={content}
          onChange={setContent}
          placeholder="Como ele estava ao acordar, sonhos contados..."
          rows={2}
        />
      </div>
    </div>
  );
}

function SaudeFields({
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
        <p className="mb-2 text-[11px] text-muted-foreground">Permite múltipla seleção.</p>
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
        <IntensityScale
          value={(td.intensity as number) ?? 0}
          onChange={(v) => update({ intensity: v })}
          color={color}
          icon="∿"
        />
      </div>
      <div>
        <FieldLabel>Deu alguma medicação como resposta?</FieldLabel>
        <YesNoToggle
          value={gaveMeds}
          onChange={(v) => update({ gave_meds: v })}
          color={color}
        />
      </div>
      {gaveMeds && (
        <div className="rounded-[14px] bg-[#F6F7FB] p-4">
          <FieldLabel>Qual medicamento e qual dose</FieldLabel>
          <StyledTextarea
            value={(td.meds_description as string) ?? ""}
            onChange={(v) => update({ meds_description: v })}
            placeholder="Ex: Dipirona infantil · 7ml"
            rows={2}
          />
        </div>
      )}
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
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {REFEICOES.map(({ key, label }) => {
            const active = td.meal === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => update({ meal: key })}
                className="shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors"
                style={
                  active
                    ? { background: color, borderColor: color, color: "#fff" }
                    : { background: "#F6F7FB", borderColor: "#E5E7EB", color: "#6B7280" }
                }
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
        <YesNoToggle
          value={refused}
          onChange={(v) => update({ refused: v })}
          color={color}
        />
      </div>
      {refused && (
        <div className="rounded-[14px] bg-[#F6F7FB] p-4 space-y-3">
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
        </div>
      )}
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
    </div>
  );
}

function SensorialFields({
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
        <p className="mb-2 text-[11px] text-muted-foreground">Permite múltipla seleção.</p>
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
    </div>
  );
}

function LivreFields({
  content,
  setContent,
}: {
  content: string;
  setContent: (v: string) => void;
}) {
  return (
    <div>
      <FieldLabel>Anotação</FieldLabel>
      <StyledTextarea
        value={content}
        onChange={setContent}
        placeholder="Anote qualquer observação, detalhe ou ideia que queira lembrar..."
        rows={8}
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
}: {
  open: boolean;
  onToggle: () => void;
  professionals: Professional[];
  profId: string;
  setProfId: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
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
            Te avisamos na data certa.
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
  const [error, setError] = useState<string | null>(null);

  const updateTD = useCallback((patch: Record<string, unknown>) => {
    setTypeData((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setChildId(initial.child_id);
      setRecordDate(initial.record_date);
      setShift((initial.shift as RecordShift) ?? "");
      setContent(initial.content ?? "");
      const td = { ...(initial.type_data ?? {}) };
      const mention = td.mention as { enabled?: boolean; professional_id?: string; note?: string } | undefined;
      if (mention?.enabled) {
        setMentionOpen(true);
        setMentionProfId(mention.professional_id ?? "");
        setMentionNote(mention.note ?? "");
        delete td.mention;
      } else {
        setMentionOpen(false);
        setMentionProfId("");
        setMentionNote("");
      }
      setTypeData(td);
    } else {
      setChildId(childrenList.length === 1 ? childrenList[0].id : "");
      setRecordDate(todayISO());
      setShift("tarde");
      setContent("");
      setTypeData({});
      setMentionOpen(false);
      setMentionProfId("");
      setMentionNote("");
    }
    setError(null);
  }, [open, initial, childrenList]);

  const handleSave = async () => {
    if (!childId) { setError("Selecione uma criança."); return; }
    if (!recordDate) { setError("Informe a data."); return; }

    const finalTypeData: Record<string, unknown> = { ...typeData };
    if (mentionOpen && mentionProfId) {
      const prof = professionals.find((p) => p.id === mentionProfId);
      finalTypeData.mention = {
        enabled: true,
        professional_id: mentionProfId,
        professional_name: prof?.name ?? "",
        note: mentionNote,
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
    }
    else if (recordType === "saude") autoTitle = content.slice(0, 80);
    else if (recordType === "alimentacao") {
      const meals: Record<string, string> = { cafe: "Café da manhã", almoco: "Almoço", lanche: "Lanche", jantar: "Jantar", madrugada: "Madrugada" };
      autoTitle = meals[typeData.meal as string] ?? "Alimentação";
    }
    else if (recordType === "sensorial") autoTitle = content.slice(0, 80);
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
    await onSave(input, []);
  };

  const showShift = recordType !== "alimentacao";

  const typeTitle =
    recordType === "livre"
      ? "Nova anotação"
      : `Novo · ${cfg.label}`;

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
          {/* Back link / type chip */}
          <div className="mb-2 flex items-center justify-between">
            <RecordTypeChip type={recordType} size="md" />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F6F7FB] text-muted-foreground hover:bg-[#EEF0F4]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
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

          {/* Date + Shift (except Sono which has its own date fields) */}
          {recordType !== "sono" && (
            <DateShiftRow
              date={recordDate}
              shift={shift}
              onDate={setRecordDate}
              onShift={(s) => setShift(s)}
              color={cfg.color}
              showShift={showShift}
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
            />
          )}
          {recordType === "conquista" && (
            <ConquistaFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
            />
          )}
          {recordType === "sono" && (
            <SonoFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
            />
          )}
          {recordType === "saude" && (
            <SaudeFields
              td={typeData}
              update={updateTD}
              content={content}
              setContent={setContent}
              color={cfg.color}
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
            />
          )}
          {recordType === "livre" && (
            <LivreFields content={content} setContent={setContent} />
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
            style={{ background: BRAND_GRADIENT, boxShadow: submitting ? "none" : BRAND_SHADOW }}
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
