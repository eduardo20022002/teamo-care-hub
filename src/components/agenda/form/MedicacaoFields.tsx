import { TYPE_STYLES } from "@/lib/agenda/tokens";
import type {
  MedicacaoMoment,
  MedicacaoRoute,
  MedicacaoTypeData,
  MedicacaoUnit,
} from "@/types/agenda";
import { ChipGroup } from "./primitives/ChipGroup";
import { FieldLabel, inputClasses } from "./primitives/FieldLabel";
import { TimeMultiPicker } from "./primitives/TimeMultiPicker";
import { AnimatedReveal } from "./primitives/AnimatedReveal";

const COMMON_MEDS = [
  "Risperidona",
  "Aripiprazol",
  "Metilfenidato",
  "Melatonina",
  "Sertralina",
  "Fluoxetina",
  "Clonidina",
  "Ácido valpróico",
  "Lamotrigina",
  "Vitamina D",
  "Ômega 3",
];

const UNIT_OPTIONS: { value: MedicacaoUnit; label: string }[] = [
  { value: "mg", label: "mg" },
  { value: "ml", label: "ml" },
  { value: "comprimido", label: "comprimido" },
  { value: "gotas", label: "gotas" },
  { value: "other", label: "Outro" },
];

const ROUTE_OPTIONS: { value: MedicacaoRoute; label: string }[] = [
  { value: "oral", label: "Oral" },
  { value: "sublingual", label: "Sublingual" },
  { value: "nasal", label: "Nasal" },
  { value: "other", label: "Outro" },
];

const MOMENT_OPTIONS: { value: MedicacaoMoment; label: string }[] = [
  { value: "fasting", label: "Em jejum" },
  { value: "with_food", label: "Com alimento" },
  { value: "bedtime", label: "Antes de dormir" },
  { value: "any", label: "Qualquer hora" },
  { value: "other", label: "Outro" },
];

const INTERVAL_OPTIONS = [4, 6, 8, 12, 24] as const;

/**
 * Calcula os horários das doses a partir da 1ª dose e do intervalo (em horas),
 * cobrindo uma janela de 24h. Ex.: 08:00 a cada 8h → ["08:00","16:00","00:00"].
 */
function computeIntervalTimes(firstDose: string, everyHours: number): string[] {
  if (!firstDose || !everyHours) return [];
  const [h, m] = firstDose.split(":").map(Number);
  const start = (h ?? 0) * 60 + (m ?? 0);
  const out: string[] = [];
  for (let i = 0; i < 24 && out.length < 8; i++) {
    const t = start + i * everyHours * 60;
    if (i > 0 && t >= start + 24 * 60) break;
    const mins = ((t % 1440) + 1440) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    out.push(`${hh}:${mm}`);
  }
  return out;
}

interface Props {
  data: MedicacaoTypeData;
  onChange: (d: MedicacaoTypeData) => void;
  disabled?: boolean;
}

export function MedicacaoFields({ data, onChange, disabled }: Props) {
  const color = TYPE_STYLES.medicacao.col;
  const tint = TYPE_STYLES.medicacao.tint;
  const set = <K extends keyof MedicacaoTypeData>(
    k: K,
    v: MedicacaoTypeData[K],
  ) => onChange({ ...data, [k]: v });

  // Atualiza vários campos de uma vez (evita sobrescrita por sets encadeados).
  const update = (partial: Partial<MedicacaoTypeData>) =>
    onChange({ ...data, ...partial });

  const doseMode = data.doseSchedule?.mode ?? "fixed";
  const firstDose = data.doseSchedule?.firstDose ?? data.times[0] ?? "08:00";
  const everyHours = data.doseSchedule?.everyHours ?? 8;

  const applyInterval = (fd: string, eh: number) => {
    const times = computeIntervalTimes(fd, eh);
    update({
      doseSchedule: { mode: "interval", firstDose: fd, everyHours: eh },
      times: times.length ? times : data.times,
    });
  };

  const setDoseMode = (m: "fixed" | "interval") => {
    if (m === "interval") applyInterval(firstDose, everyHours);
    else update({ doseSchedule: { mode: "fixed" } });
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Nome do medicamento + autocomplete */}
      <div>
        <FieldLabel>Nome do medicamento</FieldLabel>
        <input
          type="text"
          list="med-suggestions"
          value={data.medicationName}
          onChange={(e) => set("medicationName", e.target.value)}
          placeholder="Ex.: Risperidona"
          disabled={disabled}
          maxLength={120}
          className={inputClasses()}
          style={{ color: "#0F172A" }}
        />
        <datalist id="med-suggestions">
          {COMMON_MEDS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>

      {/* Dose + unidade */}
      <div>
        <FieldLabel>Dose</FieldLabel>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={data.dose.value === 0 ? "" : data.dose.value}
            onChange={(e) =>
              set("dose", {
                ...data.dose,
                value: e.target.value ? Number(e.target.value) : 0,
              })
            }
            placeholder="0"
            disabled={disabled}
            className={`${inputClasses()} w-24`}
            style={{ color: "#0F172A" }}
          />
          <div className="flex-1">
            <ChipGroup
              options={UNIT_OPTIONS}
              value={data.dose.unit}
              onChange={(v) => set("dose", { ...data.dose, unit: v })}
              activeColor={color}
              activeTint={tint}
              customValue="other"
              customInput={data.dose.customUnit ?? ""}
              onCustomInputChange={(v) =>
                set("dose", { ...data.dose, customUnit: v })
              }
              customPlaceholder="Outra unidade"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Via */}
      <div>
        <FieldLabel>Via de administração</FieldLabel>
        <ChipGroup
          options={ROUTE_OPTIONS}
          value={data.route}
          onChange={(v) => set("route", v)}
          activeColor={color}
          activeTint={tint}
          customValue="other"
          customInput={data.routeCustom ?? ""}
          onCustomInputChange={(v) => set("routeCustom", v)}
          customPlaceholder="Outra via"
          disabled={disabled}
        />
      </div>

      {/* Momento */}
      <div>
        <FieldLabel>Momento</FieldLabel>
        <ChipGroup
          options={MOMENT_OPTIONS}
          value={data.moment}
          onChange={(v) => set("moment", v)}
          activeColor={color}
          activeTint={tint}
          customValue="other"
          customInput={data.momentCustom ?? ""}
          onCustomInputChange={(v) => set("momentCustom", v)}
          customPlaceholder="Outro momento"
          disabled={disabled}
        />
      </div>

      {/* Horários — fixos ou por intervalo */}
      <div>
        <FieldLabel>Horário(s)</FieldLabel>
        <div className="mb-2 flex gap-1 rounded-xl bg-[#F4F5FA] p-1">
          {([["fixed", "Horários fixos"], ["interval", "Por intervalo"]] as const).map(
            ([m, label]) => {
              const active = doseMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  onClick={() => setDoseMode(m)}
                  className="flex-1 rounded-lg py-1.5 text-[12.5px] font-bold transition-colors disabled:opacity-60"
                  style={{
                    background: active ? "#fff" : "transparent",
                    color: active ? color : "#6B7280",
                    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                  }}
                >
                  {label}
                </button>
              );
            },
          )}
        </div>

        {doseMode === "fixed" ? (
          <TimeMultiPicker
            value={data.times}
            onChange={(v) => set("times", v)}
            disabled={disabled}
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <FieldLabel>Primeira dose</FieldLabel>
                <input
                  type="time"
                  value={firstDose}
                  onChange={(e) => applyInterval(e.target.value, everyHours)}
                  disabled={disabled}
                  className={inputClasses()}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel>A cada</FieldLabel>
                <select
                  value={everyHours}
                  onChange={(e) => applyInterval(firstDose, Number(e.target.value))}
                  disabled={disabled}
                  className={inputClasses()}
                  style={{ color: "#0F172A" }}
                >
                  {INTERVAL_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      De {h} em {h}h
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11.5px]" style={{ color: "#6B7280" }}>
                Doses no dia:
              </span>
              {(data.times.length
                ? data.times
                : computeIntervalTimes(firstDose, everyHours)
              ).map((t) => (
                <span
                  key={t}
                  className="rounded-full px-2 py-0.5 text-[11.5px] font-bold"
                  style={{ background: tint, color }}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
              Geramos as doses do dia a partir da 1ª. Doses após a meia-noite
              entram no mesmo dia.
            </p>
          </div>
        )}
      </div>

      {/* É contínuo? */}
      <div>
        <div className="flex items-center justify-between">
          <FieldLabel className="!mb-0">É contínuo?</FieldLabel>
          <Toggle
            checked={data.isContinuous}
            onChange={(v) => set("isContinuous", v)}
            color={color}
            disabled={disabled}
          />
        </div>
        <AnimatedReveal show={!data.isContinuous}>
          <div className="mt-2.5">
            <FieldLabel>Até quando?</FieldLabel>
            <input
              type="date"
              value={data.endsOn ?? ""}
              onChange={(e) => set("endsOn", e.target.value || undefined)}
              disabled={disabled}
              className={inputClasses()}
              style={{ color: "#0F172A", colorScheme: "light" }}
            />
          </div>
        </AnimatedReveal>
      </div>

      {/* Validade da receita */}
      <div>
        <FieldLabel optional>Validade da receita</FieldLabel>
        <input
          type="date"
          value={data.prescriptionExpiresOn ?? ""}
          onChange={(e) =>
            set("prescriptionExpiresOn", e.target.value || undefined)
          }
          disabled={disabled}
          className={inputClasses()}
          style={{ color: "#0F172A", colorScheme: "light" }}
        />
        <p className="mt-1 text-[11.5px]" style={{ color: "#9CA3AF" }}>
          Avisaremos 15 dias antes de vencer.
        </p>
      </div>

      {/* Observações clínicas */}
      <div>
        <FieldLabel optional>Observações clínicas</FieldLabel>
        <textarea
          value={data.clinicalNotes ?? ""}
          onChange={(e) => set("clinicalNotes", e.target.value || undefined)}
          placeholder="Ex.: reduzir se houver tremores"
          disabled={disabled}
          maxLength={2000}
          rows={3}
          className="w-full rounded-xl border border-[#E5E7EB] bg-[#F6F7FB] px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)] disabled:opacity-60"
          style={{ color: "#0F172A", resize: "vertical" }}
        />
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  color,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-50"
      style={{ background: checked ? color : "#E5E7EB" }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export { Toggle };
