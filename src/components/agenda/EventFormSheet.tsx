import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Calendar, ChevronDown, Clock, Loader2, X } from "lucide-react";
import {
  agendaEventSchema,
  AGENDA_EVENT_TYPES,
  type AgendaEventInput,
  type TypeDataInput,
} from "@/lib/agenda/validation";
import {
  BRAND_GRADIENT,
  BRAND_SHADOW,
  TYPE_STYLES,
} from "@/lib/agenda/tokens";
import {
  defaultRecurrence,
  defaultTypeData,
  type TypeDataFor,
} from "@/lib/agenda/defaults";
import type {
  AgendaEventType,
  RecurrenceConfig,
} from "@/types/agenda";
import type { Child, Professional } from "@/types/database";
import { TypeIcon } from "./icons";
import { FieldLabel, inputClasses } from "./form/primitives/FieldLabel";
import { MedicacaoFields } from "./form/MedicacaoFields";
import { TerapiaFields } from "./form/TerapiaFields";
import { ConsultaFields } from "./form/ConsultaFields";
import { EscolaFields } from "./form/EscolaFields";
import { OutroFields } from "./form/OutroFields";
import { MedicacaoRecurrence } from "./form/recurrence/MedicacaoRecurrence";
import { TerapiaRecurrence } from "./form/recurrence/TerapiaRecurrence";
import { ConsultaRecurrence } from "./form/recurrence/ConsultaRecurrence";
import { GenericRecurrence } from "./form/recurrence/GenericRecurrence";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AgendaEventInput) => Promise<void> | void;
  submitting?: boolean;
  childrenList: Child[];
  professionals: Professional[];
  defaultChildId?: string;
}

export function EventFormSheet({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  childrenList,
  professionals,
  defaultChildId,
}: Props) {
  const [type, setType] = useState<AgendaEventType>("medicacao");
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
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>(
    defaultRecurrence("medicacao"),
  );
  const [reminders, setReminders] = useState({
    oneDayBefore: true,
    oneHourBefore: true,
  });
  // type_data é armazenado por tipo (cada um isolado) para não perder o
  // que a mãe digitou se ela alternar de tipo por engano.
  const [typeDataByType, setTypeDataByType] = useState<{
    [K in AgendaEventType]: TypeDataFor<K>;
  }>(() => ({
    medicacao: defaultTypeData("medicacao"),
    terapia: defaultTypeData("terapia"),
    consulta: defaultTypeData("consulta"),
    escola: defaultTypeData("escola"),
    outro: defaultTypeData("outro"),
  }));

  useEffect(() => {
    if (open) {
      setChildId(defaultChildId ?? childrenList[0]?.id ?? "");
    }
  }, [open, defaultChildId, childrenList]);

  const handleTypeChange = (next: AgendaEventType) => {
    setType(next);
    setRecurrence(defaultRecurrence(next));
  };

  const candidateInput = useMemo<AgendaEventInput | null>(() => {
    const typeData = { kind: type, ...typeDataByType[type] } as TypeDataInput;
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
      reminders,
      type_data: typeData,
    });
    return parsed.success ? parsed.data : null;
  }, [
    type,
    typeDataByType,
    childId,
    title,
    professionalId,
    professionalNameRaw,
    date,
    startTime,
    endTime,
    locale,
    recurrence,
    reminders,
  ]);

  const canSubmit = !!candidateInput && childrenList.length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!candidateInput) return;
    await onSubmit(candidateInput);
    // Reset
    setTitle("");
    setProfessionalId("");
    setProfessionalNameRaw("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setLocale("");
    setRecurrence(defaultRecurrence(type));
    setReminders({ oneDayBefore: true, oneHourBefore: true });
    setTypeDataByType({
      medicacao: defaultTypeData("medicacao"),
      terapia: defaultTypeData("terapia"),
      consulta: defaultTypeData("consulta"),
      escola: defaultTypeData("escola"),
      outro: defaultTypeData("outro"),
    });
  };

  const handleClose = () => {
    if (submitting) return;
    onOpenChange(false);
  };

  if (!open) return null;

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
        className="relative max-h-[92vh] w-full overflow-x-hidden overflow-y-auto rounded-t-3xl bg-white px-5 pb-6 pt-3 shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:max-w-md sm:rounded-3xl sm:shadow-[0_20px_60px_rgba(15,23,42,0.2)]"
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
                  onClick={() => handleTypeChange(k)}
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
            placeholder={titlePlaceholderFor(type)}
            disabled={submitting}
            maxLength={120}
            className={inputClasses()}
            style={{ color: "#0F172A" }}
          />

          {/* Criança */}
          {childrenList.length === 0 ? (
            <div
              className="mt-3.5 rounded-xl border px-3.5 py-3 text-[13px] leading-snug"
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
                  className={`${inputClasses()} appearance-none pr-10`}
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
            </>
          ) : null}

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
              className={`${inputClasses()} appearance-none pr-10`}
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
              className={`${inputClasses()} mt-2`}
              style={{ color: "#0F172A" }}
            />
          )}

          {/* Data + Hora */}
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            <div className="min-w-0">
              <FieldLabel>Data</FieldLabel>
              <div className="relative min-w-0">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                  className={`${inputClasses()} pr-10`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Calendar
                  size={16}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
            </div>
            <div className="min-w-0">
              <FieldLabel>Hora</FieldLabel>
              <div className="relative min-w-0">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={submitting}
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
          </div>
          <FieldLabel optional className="mt-3.5">
            Hora final
          </FieldLabel>
          <div className="relative">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={submitting}
              className={`${inputClasses()} pr-10`}
              style={{ color: "#0F172A", colorScheme: "light" }}
            />
            <Clock
              size={16}
              strokeWidth={1.6}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
          </div>

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
            className={inputClasses()}
            style={{ color: "#0F172A" }}
          />

          {/* Separador suave */}
          <div
            className="my-4 h-px"
            style={{ background: "#EEF0F4" }}
            aria-hidden
          />

          {/* Campos específicos do tipo */}
          {type === "medicacao" && (
            <MedicacaoFields
              data={typeDataByType.medicacao}
              onChange={(d) =>
                setTypeDataByType((prev) => ({ ...prev, medicacao: d }))
              }
              disabled={submitting}
            />
          )}
          {type === "terapia" && (
            <TerapiaFields
              data={typeDataByType.terapia}
              onChange={(d) =>
                setTypeDataByType((prev) => ({ ...prev, terapia: d }))
              }
              disabled={submitting}
            />
          )}
          {type === "consulta" && (
            <ConsultaFields
              data={typeDataByType.consulta}
              onChange={(d) =>
                setTypeDataByType((prev) => ({ ...prev, consulta: d }))
              }
              disabled={submitting}
            />
          )}
          {type === "escola" && (
            <EscolaFields
              data={typeDataByType.escola}
              onChange={(d) =>
                setTypeDataByType((prev) => ({ ...prev, escola: d }))
              }
              disabled={submitting}
            />
          )}
          {type === "outro" && (
            <OutroFields
              data={typeDataByType.outro}
              onChange={(d) =>
                setTypeDataByType((prev) => ({ ...prev, outro: d }))
              }
              disabled={submitting}
            />
          )}

          {/* Recorrência */}
          <div className="mt-4">
            {type === "medicacao" && (
              <MedicacaoRecurrence
                value={recurrence}
                onChange={setRecurrence}
                disabled={submitting}
              />
            )}
            {type === "terapia" && (
              <TerapiaRecurrence
                value={recurrence}
                onChange={setRecurrence}
                disabled={submitting}
              />
            )}
            {type === "consulta" && (
              <ConsultaRecurrence
                value={recurrence}
                onChange={setRecurrence}
                disabled={submitting}
              />
            )}
            {(type === "escola" || type === "outro") && (
              <GenericRecurrence
                value={recurrence}
                onChange={setRecurrence}
                activeColor={TYPE_STYLES[type].col}
                activeTint={TYPE_STYLES[type].tint}
                disabled={submitting}
              />
            )}
          </div>

          {/* Lembretes */}
          <div className="mt-4">
            <FieldLabel>Lembretes</FieldLabel>
            <div className="flex flex-col gap-2">
              {([
                ["oneDayBefore", "1 dia antes"],
                ["oneHourBefore", "1 hora antes"],
              ] as const).map(([key, label]) => {
                const checked = reminders[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    disabled={submitting}
                    onClick={() =>
                      setReminders((r) => ({ ...r, [key]: !r[key] }))
                    }
                    className="flex w-full min-w-0 items-center justify-between rounded-xl border px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors disabled:opacity-60"
                    style={{
                      borderColor: checked ? TYPE_STYLES[type].col : "#E5E7EB",
                      background: checked ? TYPE_STYLES[type].tint : "#F6F7FB",
                      color: checked ? TYPE_STYLES[type].col : "#6B7280",
                    }}
                  >
                    {label}
                    <span
                      className="relative h-5 w-9 flex-shrink-0 rounded-full transition-colors"
                      style={{ background: checked ? TYPE_STYLES[type].col : "#D1D5DB" }}
                    >
                      <span
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:hover:translate-y-0"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: BRAND_SHADOW,
              letterSpacing: "-0.005em",
              opacity: canSubmit ? 1 : 0.45,
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

function titlePlaceholderFor(type: AgendaEventType): string {
  switch (type) {
    case "medicacao":
      return "Ex.: Risperidona — 0,5 mg";
    case "terapia":
      return "Ex.: Terapia ABA";
    case "consulta":
      return "Ex.: Retorno neuropediatra";
    case "escola":
      return "Ex.: Reunião AEE";
    default:
      return "Ex.: Passeio sensorial";
  }
}
