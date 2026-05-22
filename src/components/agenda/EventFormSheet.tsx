import { useEffect, useState, type FormEvent } from "react";
import { Calendar, ChevronDown, Clock, Loader2, X } from "lucide-react";
import {
  agendaEventSchema,
  AGENDA_EVENT_TYPES,
  type AgendaEventInput,
} from "@/lib/agenda/validation";
import {
  BRAND_GRADIENT,
  BRAND_SHADOW,
  TYPE_STYLES,
  AGENDA_BRAND,
} from "@/lib/agenda/tokens";
import type { AgendaEventType } from "@/types/agenda";
import type { Child } from "@/types/database";
import type { Professional } from "@/types/database";
import { TypeIcon } from "./icons";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AgendaEventInput) => Promise<void> | void;
  submitting?: boolean;
  childrenList: Child[];
  professionals: Professional[];
  defaultChildId?: string;
}

const RECURRENCE_OPTIONS: Array<{ label: string; value: AgendaEventInput["recurrence"]["freq"]; interval?: number }> = [
  { label: "Não repetir", value: "none" },
  { label: "Toda semana", value: "weekly" },
  { label: "A cada 15 dias", value: "biweekly" },
  { label: "Todo mês", value: "monthly" },
  { label: "Personalizar", value: "custom" },
];

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

export function EventFormSheet({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  childrenList,
  professionals,
  defaultChildId,
}: Props) {
  const [type, setType] = useState<AgendaEventType>("terapia");
  const [title, setTitle] = useState("");
  const [childId, setChildId] = useState<string>(
    defaultChildId ?? childrenList[0]?.id ?? "",
  );
  const [professionalId, setProfessionalId] = useState<string>("");
  const [professionalNameRaw, setProfessionalNameRaw] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locale, setLocale] = useState("");
  const [recurrenceFreq, setRecurrenceFreq] = useState<
    AgendaEventInput["recurrence"]["freq"]
  >("none");
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setChildId(defaultChildId ?? childrenList[0]?.id ?? "");
    }
  }, [open, defaultChildId, childrenList]);

  if (!open) return null;

  const toggleDay = (idx: number) => {
    setRecurrenceDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx],
    );
  };

  const showDayPicker =
    recurrenceFreq === "weekly" || recurrenceFreq === "biweekly";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const recurrence: AgendaEventInput["recurrence"] = {
      freq: recurrenceFreq,
      ...(showDayPicker && recurrenceDays.length > 0
        ? { daysOfWeek: recurrenceDays }
        : {}),
    };
    const parsed = agendaEventSchema.safeParse({
      child_id: childId,
      type,
      title,
      professional_id: professionalId || null,
      professional_name_raw: professionalNameRaw || null,
      date,
      start_time: startTime,
      end_time: endTime,
      locale,
      recurrence,
      reminders: { oneDayBefore: true, oneHourBefore: true },
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
    // Reset on success
    setTitle("");
    setProfessionalId("");
    setProfessionalNameRaw("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setLocale("");
    setRecurrenceFreq("none");
    setRecurrenceDays([]);
  };

  const handleClose = () => {
    if (submitting) return;
    setErrors({});
    onOpenChange(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={handleClose}
        className="absolute inset-0 cursor-default bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-sheet-title"
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:max-w-md sm:rounded-3xl sm:shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />

        <div className="mb-1 flex items-start justify-between gap-3">
          <h2
            id="event-sheet-title"
            className="text-[19px] font-extrabold tracking-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
          >
            Novo compromisso
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[#9CA3AF] transition-colors hover:bg-[#E5E7EB] hover:text-[#6B7280] disabled:opacity-50"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <p
          className="mb-[18px] text-[13.5px] leading-snug"
          style={{ color: "#6B7280", maxWidth: 320 }}
        >
          Cadastre um compromisso pontual ou recorrente. Você pode adicionar
          observações depois.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Tipo */}
          <FieldLabel>Tipo</FieldLabel>
          <div className="-mr-5 mb-3.5 flex gap-2 overflow-x-auto pb-1">
            {AGENDA_EVENT_TYPES.map((k) => {
              const t = TYPE_STYLES[k];
              const active = k === type;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[12.5px] font-bold transition-shadow"
                  style={{
                    background: active ? t.tint : "#F6F7FB",
                    border: `1.5px solid ${active ? t.col : "transparent"}`,
                    boxShadow: active ? `0 0 0 4px ${t.tint}80` : "none",
                    color: active ? t.col : "#6B7280",
                  }}
                >
                  <TypeIcon type={k} size={14} color={active ? t.col : "#6B7280"} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Título */}
          <FieldLabel>Título</FieldLabel>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Terapia ABA"
            disabled={submitting}
            maxLength={120}
            className={inputClasses(!!errors.title)}
            style={{ color: "#0F172A" }}
          />
          {errors.title && (
            <p className="mt-1 text-xs text-red-500">{errors.title}</p>
          )}

          {/* Criança */}
          {childrenList.length === 0 ? (
            <div
              className="mb-1 rounded-xl border px-3.5 py-3 text-[13px] leading-snug"
              style={{
                background: "#FFF7ED",
                borderColor: "#FED7AA",
                color: "#9A3412",
              }}
            >
              Cadastre uma criança no Painel antes de criar compromissos.
            </div>
          ) : childrenList.length > 1 ? (
            <>
              <FieldLabel className="mt-3.5">Criança</FieldLabel>
              <div className="relative">
                <select
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  disabled={submitting}
                  className={`${inputClasses(!!errors.child_id)} appearance-none pr-10`}
                  style={{ color: "#0F172A" }}
                >
                  {childrenList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
              {errors.child_id && (
                <p className="mt-1 text-xs text-red-500">{errors.child_id}</p>
              )}
            </>
          ) : null}
          {/* Mostra erro de criança mesmo quando o select não está visível (0 crianças). */}
          {errors.child_id && childrenList.length <= 1 && (
            <p className="mt-1 text-xs text-red-500">{errors.child_id}</p>
          )}

          {/* Profissional */}
          <FieldLabel optional className="mt-3.5">
            Profissional
          </FieldLabel>
          <div className="relative">
            <select
              value={professionalId}
              onChange={(e) => {
                setProfessionalId(e.target.value);
                if (e.target.value) setProfessionalNameRaw("");
              }}
              disabled={submitting}
              className={`${inputClasses(false)} appearance-none pr-10`}
              style={{ color: professionalId ? "#0F172A" : "#9CA3AF" }}
            >
              <option value="">Vincular ou digitar nome</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
          </div>
          {!professionalId && (
            <input
              type="text"
              value={professionalNameRaw}
              onChange={(e) => setProfessionalNameRaw(e.target.value)}
              placeholder="ou digite o nome do profissional"
              disabled={submitting}
              maxLength={120}
              className={`${inputClasses(false)} mt-2`}
              style={{ color: "#0F172A" }}
            />
          )}
          <p className="mt-1.5 text-[11.5px]" style={{ color: "#9CA3AF" }}>
            Vincule a alguém de Profissionais ou digite o nome.
          </p>

          {/* Data + Hora */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel>Data</FieldLabel>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                  className={`${inputClasses(!!errors.date)} pr-10`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Calendar
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
              {errors.date && (
                <p className="mt-1 text-xs text-red-500">{errors.date}</p>
              )}
            </div>
            <div>
              <FieldLabel>Hora</FieldLabel>
              <div className="relative">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={submitting}
                  className={`${inputClasses(!!errors.start_time)} pr-10`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Clock
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
              {errors.start_time && (
                <p className="mt-1 text-xs text-red-500">{errors.start_time}</p>
              )}
            </div>
          </div>
          {/* Hora final opcional */}
          <FieldLabel optional className="mt-3.5">
            Hora final
          </FieldLabel>
          <div className="relative">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={submitting}
              className={`${inputClasses(false)} pr-10`}
              style={{ color: "#0F172A", colorScheme: "light" }}
            />
            <Clock
              size={16}
              strokeWidth={1.6}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
          </div>

          {/* Recorrência */}
          <FieldLabel className="mt-3.5">Recorrência</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {RECURRENCE_OPTIONS.map((opt) => {
              const active = recurrenceFreq === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecurrenceFreq(opt.value)}
                  className="inline-flex h-8 items-center rounded-[9px] px-3 text-[12.5px] font-bold transition-colors"
                  style={{
                    background: active ? AGENDA_BRAND.tint : "#F6F7FB",
                    border: `1px solid ${active ? AGENDA_BRAND.col : "#E5E7EB"}`,
                    color: active ? AGENDA_BRAND.col : "#4B5563",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {showDayPicker && (
            <div className="mt-3 flex gap-1.5">
              {WEEKDAY_LABELS.map((label, idx) => {
                const on = recurrenceDays.includes(idx);
                return (
                  <button
                    key={`day-${idx}`}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className="flex h-9 flex-1 items-center justify-center rounded-[9px] text-[12px] font-extrabold transition-colors"
                    style={{
                      background: on ? AGENDA_BRAND.col : "#F6F7FB",
                      border: `1px solid ${on ? AGENDA_BRAND.col : "#E5E7EB"}`,
                      color: on ? "white" : "#6B7280",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Local */}
          <FieldLabel optional className="mt-3.5">
            Local
          </FieldLabel>
          <input
            type="text"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            placeholder="Ex.: Clínica Acolher"
            disabled={submitting}
            maxLength={200}
            className={inputClasses(false)}
            style={{ color: "#0F172A" }}
          />

          {/* CTA */}
          <button
            type="submit"
            disabled={submitting || childrenList.length === 0}
            className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: BRAND_SHADOW,
              letterSpacing: "-0.005em",
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar compromisso
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151] disabled:opacity-50"
            style={{ color: "#6B7280" }}
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  optional,
  className = "",
}: {
  children: React.ReactNode;
  optional?: boolean;
  className?: string;
}) {
  return (
    <label
      className={`mb-1.5 block text-[12.5px] font-semibold ${className}`}
      style={{ color: "#374151", letterSpacing: "-0.005em" }}
    >
      {children}
      {optional && (
        <span style={{ color: "#9CA3AF", fontWeight: 500, marginLeft: 6 }}>
          (opcional)
        </span>
      )}
    </label>
  );
}

function inputClasses(hasError: boolean) {
  return `h-11 w-full rounded-xl border bg-[#F6F7FB] px-3.5 text-[14.5px] outline-none transition-all ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
      : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
  } disabled:opacity-60`;
}
