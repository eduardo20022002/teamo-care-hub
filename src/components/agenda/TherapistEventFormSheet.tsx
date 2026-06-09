/**
 * TherapistEventFormSheet — bottom sheet para criar sessões pelo terapeuta.
 * Exibido no FAB (+) da agenda do terapeuta.
 */
import { useState, useEffect } from "react";
import { X, Loader2, MapPin } from "lucide-react";
import { getPatientColor } from "@/lib/agenda/tokens";
import type { TherapistSessionInput } from "@/services/agenda/events.service";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

// ─── Types ───────────────────────────────────────────────────────────────────
type SessionType = "individual" | "grupo" | "familiar";
type DurationOption = 30 | 60 | 120 | 180 | 240 | "custom";
type CustomUnit = "minutes" | "hours";
type RecurrenceOption = "none" | "weekly" | "biweekly" | "monthly";

interface PatientOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TherapistSessionInput) => Promise<void> | void;
  submitting?: boolean;
  patients: PatientOption[];
}

const SESSION_TYPE_OPTIONS: { value: SessionType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "grupo",      label: "Em grupo" },
  { value: "familiar",   label: "Familiar" },
];

const DURATION_OPTIONS: { value: DurationOption; label: string }[] = [
  { value: 30,       label: "30 min" },
  { value: 60,       label: "1h" },
  { value: 120,      label: "2h" },
  { value: 180,      label: "3h" },
  { value: 240,      label: "4h" },
  { value: "custom", label: "Personalizado" },
];

const RECURRENCE_OPTIONS: { value: RecurrenceOption; label: string }[] = [
  { value: "none",     label: "Não repete" },
  { value: "weekly",   label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly",  label: "Mensal" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TherapistEventFormSheet({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  patients,
}: Props) {
  const [patientId, setPatientId]           = useState<string>(patients[0]?.id ?? "");
  const [sessionType, setSessionType]       = useState<SessionType>("individual");
  const [date, setDate]                     = useState<string>(todayISO());
  const [startTime, setStartTime]           = useState<string>(nowTimeStr());
  const [duration, setDuration]             = useState<DurationOption>(60);
  const [customDuration, setCustomDuration] = useState<string>("15");
  const [customUnit, setCustomUnit]         = useState<CustomUnit>("minutes");
  const [recurrence, setRecurrence]         = useState<RecurrenceOption>("weekly");
  const [daysOfWeek, setDaysOfWeek]         = useState<number[]>([new Date().getDay()]);
  const [locale, setLocale]                 = useState<string>("");

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPatientId(patients[0]?.id ?? "");
      setSessionType("individual");
      setDate(todayISO());
      setStartTime(nowTimeStr());
      setDuration(60);
      setCustomDuration("15");
      setCustomUnit("minutes");
      setRecurrence("weekly");
      setDaysOfWeek([new Date().getDay()]);
      setLocale("");
    }
  }, [open, patients]);

  if (!open) return null;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const selectedPatient = patients.find((p) => p.id === patientId);
  const durationMinutes = (() => {
    if (duration !== "custom") return duration;
    const n = parseInt(customDuration, 10) || 0;
    const minutes = customUnit === "hours" ? n * 60 : n;
    // Clamp entre 5 e 480 minutos
    return Math.min(480, Math.max(5, minutes || 60));
  })();

  const handleSubmit = async () => {
    if (!patientId) return;
    await onSubmit({
      childId:         patientId,
      childName:       selectedPatient?.name ?? "",
      sessionType,
      date,
      startTime,
      durationMinutes,
      recurrence,
      daysOfWeek:      recurrence === "none" || recurrence === "monthly" ? [] : daysOfWeek,
      locale,
    });
    onOpenChange(false);
  };

  // Chip style helpers
  function chipStyle(selected: boolean) {
    return selected
      ? { background: TEAL, color: "white", borderColor: TEAL }
      : { background: TEAL_SOFT, color: "#374151", borderColor: TEAL_BORDER };
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white shadow-2xl"
        style={{ maxHeight: "92dvh", overflowY: "auto" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4">
          <div>
            <h2
              className="text-[19px] font-extrabold"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              Nova sessão
            </h2>
            <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
              Agende uma sessão pontual ou recorrente para um paciente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#F4F5FA]"
          >
            <X size={18} color="#9CA3AF" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-5 pb-8">
          {/* Paciente */}
          <div>
            <label className="block text-[13px] font-bold text-[#374151] mb-2">
              Paciente
            </label>
            {patients.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">
                Nenhum paciente cadastrado.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {/* Bolinha colorida do paciente */}
                <div
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white"
                  style={{ background: getPatientColor(patientId).col }}
                >
                  {selectedPatient?.name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {/* Tipo de sessão */}
          <div>
            <label className="block text-[13px] font-bold text-[#374151] mb-2">
              Tipo de sessão
            </label>
            <div className="flex flex-wrap gap-2">
              {SESSION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSessionType(opt.value)}
                  className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all"
                  style={chipStyle(sessionType === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-[13px] font-bold text-[#374151] mb-2">
                Data de início
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full min-w-0 max-w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-[13px] font-bold text-[#374151] mb-2">
                Hora de início
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 w-full min-w-0 max-w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>

          {/* Duração */}
          <div>
            <label className="block text-[13px] font-bold text-[#374151] mb-2">
              Duração
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all"
                  style={chipStyle(duration === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {duration === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={customUnit === "hours" ? 8 : 480}
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  className="h-10 w-24 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as CustomUnit)}
                  className="h-10 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                >
                  <option value="minutes">minutos</option>
                  <option value="hours">horas</option>
                </select>
              </div>
            )}
          </div>

          {/* Recorrência */}
          <div>
            <label className="block text-[13px] font-bold text-[#374151] mb-2">
              Recorrência
            </label>
            <div className="flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecurrence(opt.value)}
                  className="rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all"
                  style={chipStyle(recurrence === opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dias da semana (semanal ou quinzenal) */}
          {(recurrence === "weekly" || recurrence === "biweekly") && (
            <div>
              <label className="block text-[13px] font-bold text-[#374151] mb-2">
                Dias da semana
              </label>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, day) => {
                  const sel = daysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all border"
                      style={sel
                        ? { background: TEAL, color: "white", borderColor: TEAL }
                        : { background: TEAL_SOFT, color: "#374151", borderColor: TEAL_BORDER }
                      }
                    >
                      {label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Local (opcional) */}
          <div>
            <label className="block text-[13px] font-bold text-[#374151] mb-2">
              Local{" "}
              <span className="text-[#9CA3AF] font-normal">(opcional)</span>
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                color="#9CA3AF"
              />
              <input
                type="text"
                placeholder="Ex.: Sala 2 · Clínica Acolher"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>
          </div>

          {/* Botão */}
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!patientId || submitting}
            className="flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px disabled:opacity-50"
            style={{ background: TEAL }}
          >
            {submitting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              "Agendar sessão"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
