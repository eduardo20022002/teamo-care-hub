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
  medicacao: { col: "#7C3AED", tint: "#F3E8FF", label: "Medicação" },
  terapia: { col: "#4F46E5", tint: "#EEF1FF", label: "Terapia" },
  consulta: { col: "#EC4899", tint: "#FDF2F8", label: "Consulta" },
  escola: { col: "#D97706", tint: "#FEF3C7", label: "Escola" },
  outro: { col: "#6B7280", tint: "#F4F5FA", label: "Outro" },
};

// ─── Paleta de cores por paciente (terapeuta) ────────────────────────────────
// 8 cores distintas, deterministicamente atribuídas por patientId.
export const PATIENT_COLORS = [
  { col: "#0D9488", tint: "#F0FDFA" }, // teal
  { col: "#7C3AED", tint: "#F3E8FF" }, // purple
  { col: "#EA580C", tint: "#FFF4ED" }, // orange
  { col: "#0284C7", tint: "#F0F9FF" }, // sky
  { col: "#BE185D", tint: "#FDF2F8" }, // pink
  { col: "#65A30D", tint: "#F7FEE7" }, // lime
  { col: "#B45309", tint: "#FFFBEB" }, // amber
  { col: "#6366F1", tint: "#EEF2FF" }, // indigo
] as const;

export type PatientColor = (typeof PATIENT_COLORS)[number];

/**
 * Retorna a cor do paciente de forma determinística.
 * Usa os charCodes do início + fim do ID para distribuir uniformemente.
 */
export function getPatientColor(patientId: string): PatientColor {
  if (!patientId) return PATIENT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) {
    hash = (hash * 31 + patientId.charCodeAt(i)) & 0xffff;
  }
  return PATIENT_COLORS[hash % PATIENT_COLORS.length];
}

// Reservado SÓ para "observações pendentes" / "lembrar de mencionar".
export const ALERT_TONE = {
  titleColor: "#7C2D12",
  bodyColor: "#9A3412",
  background: "#FFF7ED",
  border: "#FED7AA",
  ctaColor: "#EA580C",
} as const;
