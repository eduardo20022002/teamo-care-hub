import type {
  AgendaEventType,
  ConsultaTypeData,
  EscolaTypeData,
  MedicacaoTypeData,
  OutroTypeData,
  RecurrenceConfig,
  TerapiaTypeData,
} from "@/types/agenda";

export type TypeDataFor<T extends AgendaEventType> = T extends "medicacao"
  ? MedicacaoTypeData
  : T extends "terapia"
    ? TerapiaTypeData
    : T extends "consulta"
      ? ConsultaTypeData & { returnDate?: string; returnTime?: string }
      : T extends "escola"
        ? EscolaTypeData
        : OutroTypeData;

export function defaultTypeData<T extends AgendaEventType>(
  type: T,
): TypeDataFor<T> {
  switch (type) {
    case "medicacao":
      return {
        medicationName: "",
        dose: { value: 0, unit: "mg" },
        route: "oral",
        moment: "any",
        times: [""],
        isContinuous: true,
      } as unknown as TypeDataFor<T>;
    case "terapia":
      return {
        therapyType: "aba",
        duration: "45",
        hasContract: false,
      } as unknown as TypeDataFor<T>;
    case "consulta":
      return {
        consultType: "first",
        specialty: "neuro",
        documentsChecklist: [],
        returnScheduled: false,
      } as unknown as TypeDataFor<T>;
    case "escola":
      return {
        eventType: "aee",
        documentsChecklist: [],
      } as unknown as TypeDataFor<T>;
    default:
      return {} as unknown as TypeDataFor<T>;
  }
}

/** Recorrência default sugerida por tipo. */
export function defaultRecurrence(type: AgendaEventType): RecurrenceConfig {
  switch (type) {
    case "medicacao":
      return { freq: "daily" };
    case "consulta":
      return { freq: "once" };
    default:
      return { freq: "none" };
  }
}
