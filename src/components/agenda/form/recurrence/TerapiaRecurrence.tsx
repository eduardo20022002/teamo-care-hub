import { Clock, Plus, X } from "lucide-react";
import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type { RecurrenceConfig } from "@/types/agenda";
import { ChipGroup } from "../primitives/ChipGroup";
import { FieldLabel, inputClasses } from "../primitives/FieldLabel";
import { WeekdayPicker } from "../primitives/WeekdayPicker";
import { DateRangePicker } from "../primitives/DateRangePicker";
import { AnimatedReveal } from "../primitives/AnimatedReveal";
import { Toggle } from "../MedicacaoFields";

type Step1Choice =
  | "weekly_same_time"
  | "weekly_varies"
  | "biweekly"
  | "intensive"
  | "once";

const STEP1_OPTIONS: { value: Step1Choice; label: string }[] = [
  { value: "weekly_same_time", label: "Toda semana, mesmo horário" },
  { value: "weekly_varies", label: "Toda semana, horário varia" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "intensive", label: "Intensivo por período" },
  { value: "once", label: "Avulso" },
];

const WEEK_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

type EndsKind = "indeterminate" | "on" | "after";

function endsKindFromValue(value: RecurrenceConfig): EndsKind {
  if (
    value.freq === "weekly_same_time" ||
    value.freq === "weekly_varies" ||
    value.freq === "biweekly"
  ) {
    if (value.freq === "biweekly") {
      // legacy: biweekly não tem ends — usamos endsOn aqui mas mantemos UI igual
      return value.endsOn ? "on" : "indeterminate";
    }
    return value.ends.kind;
  }
  return "indeterminate";
}

interface Props {
  value: RecurrenceConfig;
  onChange: (v: RecurrenceConfig) => void;
  disabled?: boolean;
}

export function TerapiaRecurrence({ value, onChange, disabled }: Props) {
  const color = TYPE_STYLES.terapia.col;
  const tint = TYPE_STYLES.terapia.tint;
  const step1: Step1Choice =
    value.freq === "weekly_same_time"
      ? "weekly_same_time"
      : value.freq === "weekly_varies"
        ? "weekly_varies"
        : value.freq === "biweekly"
          ? "biweekly"
          : value.freq === "intensive"
            ? "intensive"
            : "once";

  const setStep1 = (c: Step1Choice) => {
    if (c === "weekly_same_time")
      onChange({
        freq: "weekly_same_time",
        dayOfWeek: 1,
        time: "09:00",
        ends: { kind: "indeterminate" },
      });
    else if (c === "weekly_varies")
      onChange({
        freq: "weekly_varies",
        schedule: [],
        ends: { kind: "indeterminate" },
      });
    else if (c === "biweekly")
      onChange({ freq: "biweekly", dayOfWeek: 1 });
    else if (c === "intensive")
      onChange({
        freq: "intensive",
        perWeek: 3,
        daysOfWeek: [],
        time: "09:00",
        startsOn: "",
        endsOn: "",
      });
    else onChange({ freq: "once" });
  };

  return (
    <div>
      <FieldLabel>Como é a frequência?</FieldLabel>
      <ChipGroup
        options={STEP1_OPTIONS}
        value={step1}
        onChange={setStep1}
        activeColor={color}
        activeTint={tint}
        scroll
        disabled={disabled}
      />

      {/* Toda semana, mesmo horário */}
      <AnimatedReveal show={value.freq === "weekly_same_time"}>
        {value.freq === "weekly_same_time" && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <FieldLabel>Dia da semana</FieldLabel>
              <WeekdayPicker
                value={[value.dayOfWeek]}
                onChange={(days) =>
                  onChange({
                    ...value,
                    dayOfWeek: days[days.length - 1] ?? value.dayOfWeek,
                  })
                }
                single
                activeColor={color}
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel>Horário</FieldLabel>
              <div className="relative">
                <input
                  type="time"
                  value={value.time}
                  onChange={(e) =>
                    onChange({ ...value, time: e.target.value })
                  }
                  disabled={disabled}
                  className={`${inputClasses()} pr-10`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Clock
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
            </div>
            <EndsConfig
              value={endsKindFromValue(value)}
              afterCount={
                value.ends.kind === "after" ? value.ends.count : undefined
              }
              onDate={
                value.ends.kind === "on" ? value.ends.date : undefined
              }
              onChange={(ends) => onChange({ ...value, ends })}
              color={color}
              tint={tint}
              disabled={disabled}
            />
            <PausesField
              pauses={value.pauses ?? []}
              onChange={(pauses) =>
                onChange({ ...value, pauses: pauses.length ? pauses : undefined })
              }
              color={color}
              disabled={disabled}
            />
          </div>
        )}
      </AnimatedReveal>

      {/* Toda semana, horário varia */}
      <AnimatedReveal show={value.freq === "weekly_varies"}>
        {value.freq === "weekly_varies" && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <FieldLabel>Dias e horários</FieldLabel>
              <div className="flex flex-col gap-2">
                {WEEK_LABELS.map((label, idx) => {
                  const entry = value.schedule.find(
                    (s) => s.dayOfWeek === idx,
                  );
                  const checked = !!entry;
                  return (
                    <div
                      key={`wv-${idx}`}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (checked) {
                            onChange({
                              ...value,
                              schedule: value.schedule.filter(
                                (s) => s.dayOfWeek !== idx,
                              ),
                            });
                          } else {
                            onChange({
                              ...value,
                              schedule: [
                                ...value.schedule,
                                { dayOfWeek: idx, time: "09:00" },
                              ].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
                            });
                          }
                        }}
                        disabled={disabled}
                        className="flex h-9 w-9 items-center justify-center rounded-[9px] text-[12px] font-extrabold transition-colors"
                        style={{
                          background: checked ? color : "#F6F7FB",
                          border: `1px solid ${checked ? color : "#E5E7EB"}`,
                          color: checked ? "white" : "#6B7280",
                        }}
                      >
                        {label}
                      </button>
                      {checked && entry && (
                        <input
                          type="time"
                          value={entry.time}
                          onChange={(e) =>
                            onChange({
                              ...value,
                              schedule: value.schedule.map((s) =>
                                s.dayOfWeek === idx
                                  ? { ...s, time: e.target.value }
                                  : s,
                              ),
                            })
                          }
                          disabled={disabled}
                          className="h-9 w-32 rounded-[9px] border border-[#E5E7EB] bg-[#F6F7FB] px-2.5 text-[13px] outline-none focus:border-[#4F46E5]"
                          style={{ color: "#0F172A", colorScheme: "light" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <EndsConfig
              value={value.ends.kind}
              afterCount={
                value.ends.kind === "after" ? value.ends.count : undefined
              }
              onDate={
                value.ends.kind === "on" ? value.ends.date : undefined
              }
              onChange={(ends) => onChange({ ...value, ends })}
              color={color}
              tint={tint}
              disabled={disabled}
            />
          </div>
        )}
      </AnimatedReveal>

      {/* Quinzenal */}
      <AnimatedReveal show={value.freq === "biweekly"}>
        {value.freq === "biweekly" && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <FieldLabel>Dia da semana preferencial</FieldLabel>
              <WeekdayPicker
                value={
                  value.dayOfWeek !== undefined ? [value.dayOfWeek] : []
                }
                onChange={(days) =>
                  onChange({
                    ...value,
                    dayOfWeek: days[days.length - 1] ?? value.dayOfWeek,
                  })
                }
                single
                activeColor={color}
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </AnimatedReveal>

      {/* Intensivo */}
      <AnimatedReveal show={value.freq === "intensive"}>
        {value.freq === "intensive" && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <FieldLabel>Quantas vezes por semana</FieldLabel>
              <ChipGroup
                options={[
                  { value: "2", label: "2x" },
                  { value: "3", label: "3x" },
                  { value: "4", label: "4x" },
                  { value: "5", label: "5x" },
                ]}
                value={String(value.perWeek)}
                onChange={(v) => onChange({ ...value, perWeek: Number(v) })}
                activeColor={color}
                activeTint={tint}
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel>Quais dias</FieldLabel>
              <WeekdayPicker
                value={value.daysOfWeek}
                onChange={(days) => onChange({ ...value, daysOfWeek: days })}
                activeColor={color}
                disabled={disabled}
              />
            </div>
            <div>
              <FieldLabel>Horário</FieldLabel>
              <div className="relative">
                <input
                  type="time"
                  value={value.time}
                  onChange={(e) =>
                    onChange({ ...value, time: e.target.value })
                  }
                  disabled={disabled}
                  className={`${inputClasses()} pr-10`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Clock
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
            </div>
            <div>
              <FieldLabel>De quando até quando</FieldLabel>
              <DateRangePicker
                from={value.startsOn}
                to={value.endsOn}
                onChange={({ from, to }) =>
                  onChange({ ...value, startsOn: from, endsOn: to })
                }
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </AnimatedReveal>
    </div>
  );
}

function EndsConfig({
  value,
  afterCount,
  onDate,
  onChange,
  color,
  tint,
  disabled,
}: {
  value: EndsKind;
  afterCount?: number;
  onDate?: string;
  onChange: (
    ends:
      | { kind: "indeterminate" }
      | { kind: "on"; date: string }
      | { kind: "after"; count: number },
  ) => void;
  color: string;
  tint: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel>Quando termina?</FieldLabel>
      <ChipGroup
        options={[
          { value: "indeterminate", label: "Tempo indeterminado" },
          { value: "on", label: "Numa data específica" },
          { value: "after", label: "Após N sessões" },
        ]}
        value={value}
        onChange={(v) => {
          if (v === "indeterminate") onChange({ kind: "indeterminate" });
          else if (v === "on") onChange({ kind: "on", date: onDate ?? "" });
          else onChange({ kind: "after", count: afterCount ?? 10 });
        }}
        activeColor={color}
        activeTint={tint}
        disabled={disabled}
      />
      <AnimatedReveal show={value === "on"}>
        <input
          type="date"
          value={onDate ?? ""}
          onChange={(e) => onChange({ kind: "on", date: e.target.value })}
          disabled={disabled}
          className={`${inputClasses()} mt-2`}
          style={{ color: "#0F172A", colorScheme: "light" }}
        />
      </AnimatedReveal>
      <AnimatedReveal show={value === "after"}>
        <input
          type="number"
          min="1"
          max="999"
          inputMode="numeric"
          value={afterCount ?? ""}
          onChange={(e) =>
            onChange({
              kind: "after",
              count: Math.max(1, Number(e.target.value) || 1),
            })
          }
          disabled={disabled}
          placeholder="Ex.: 12 sessões"
          className={`${inputClasses()} mt-2`}
          style={{ color: "#0F172A" }}
        />
      </AnimatedReveal>
    </div>
  );
}

function PausesField({
  pauses,
  onChange,
  color,
  disabled,
}: {
  pauses: Array<{ from: string; to: string }>;
  onChange: (p: Array<{ from: string; to: string }>) => void;
  color: string;
  disabled?: boolean;
}) {
  const enabled = pauses.length > 0;
  return (
    <div>
      <div className="flex items-center justify-between">
        <FieldLabel className="!mb-0">Tem período de pausa?</FieldLabel>
        <Toggle
          checked={enabled}
          onChange={(v) => onChange(v ? [{ from: "", to: "" }] : [])}
          color={color}
          disabled={disabled}
        />
      </div>
      <AnimatedReveal show={enabled}>
        <div className="mt-2.5 flex flex-col gap-2">
          {pauses.map((p, idx) => (
            <div key={`pause-${idx}`} className="flex items-start gap-2">
              <div className="flex-1">
                <DateRangePicker
                  from={p.from}
                  to={p.to}
                  onChange={(range) =>
                    onChange(
                      pauses.map((px, i) => (i === idx ? range : px)),
                    )
                  }
                  disabled={disabled}
                />
              </div>
              {pauses.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(pauses.filter((_, i) => i !== idx))}
                  disabled={disabled}
                  aria-label="Remover pausa"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[#9CA3AF] transition-colors hover:bg-[#E5E7EB] hover:text-[#6B7280] disabled:opacity-50"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...pauses, { from: "", to: "" }])}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 self-start rounded-[9px] border border-dashed border-[#D1D5DB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#4B5563] transition-colors hover:border-[#9CA3AF] hover:text-[#374151] disabled:opacity-50"
          >
            <Plus size={14} strokeWidth={2} />
            Adicionar pausa
          </button>
        </div>
      </AnimatedReveal>
    </div>
  );
}
