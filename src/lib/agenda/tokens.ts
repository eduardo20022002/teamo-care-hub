import type { AgendaEventType } from "@/types/agenda";

export const AGENDA_BRAND = {
  col: "#7C3AED",
  tint: "#F3E8FF",
  tintDeep: "#E6D5FA",
} as const;

export const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
export const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
export const AGENDA_SHADOW = "0 8px 18px -8px rgba(124,58,237,0.35)";
export const PASTEL_GRADIENT =
  "linear-gradient(140deg, #E5E9FF 0%, #ECE5FE 45%, #FDE8F3 100%)";

interface TypeStyle {
  col: string;
  tint: string;
  label: string;
}

export const TYPE_STYLES: Record<AgendaEventType, TypeStyle> = {
  terapia: { col: "#4F46E5", tint: "#EEF1FF", label: "Terapia" },
  medica: { col: "#EC4899", tint: "#FDF2F8", label: "Consulta médica" },
  escola: { col: "#D97706", tint: "#FEF3C7", label: "Escola" },
  medicacao: { col: "#7C3AED", tint: "#F3E8FF", label: "Medicação" },
  outro: { col: "#6B7280", tint: "#F4F5FA", label: "Outro" },
};

// Reservado SÓ para "observações pendentes" / "lembrar de mencionar".
export const ALERT_TONE = {
  titleColor: "#7C2D12",
  bodyColor: "#9A3412",
  background: "#FFF7ED",
  border: "#FED7AA",
  ctaColor: "#EA580C",
} as const;
