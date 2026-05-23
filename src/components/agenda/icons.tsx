/**
 * Ícones dedicados dos tipos de compromisso da Agenda.
 * Mantemos como SVGs próprios (não lucide) pra fidelidade ao design.
 */

type IconProps = { c?: string; size?: number };

export function TerapiaIcon({ c = "#4F46E5", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 3a3 3 0 013 3v2h-2a2 2 0 100 4h2v2a3 3 0 11-3-3H6a2 2 0 110-4h2V6a3 3 0 010-3z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M16 21a3 3 0 01-3-3v-2h2a2 2 0 100-4h-2v-2a3 3 0 113 3h2a2 2 0 110 4h-2v2a3 3 0 010 3z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ConsultaIcon({ c = "#EC4899", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 3v6a4 4 0 008 0V3"
        stroke={c}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M10 13v3a4 4 0 008 0v-2"
        stroke={c}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="18" cy="11" r="2" stroke={c} strokeWidth="1.7" />
    </svg>
  );
}

export function EscolaIcon({ c = "#D97706", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 9l10-5 10 5-10 5-10-5z"
        stroke={c}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6 11v5c2 2 4 2.5 6 2.5s4-.5 6-2.5v-5"
        stroke={c}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M22 9v5" stroke={c} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MedicacaoIcon({ c = "#7C3AED", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="9"
        width="18"
        height="6"
        rx="3"
        stroke={c}
        strokeWidth="1.7"
        transform="rotate(-45 12 12)"
      />
      <path
        d="M8.5 8.5l7 7"
        stroke={c}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OutroIcon({ c = "#6B7280", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.5" fill={c} />
      <circle cx="12" cy="12" r="1.5" fill={c} />
      <circle cx="18" cy="12" r="1.5" fill={c} />
    </svg>
  );
}

import type { AgendaEventType } from "@/types/agenda";

export function TypeIcon({
  type,
  size = 16,
  color,
}: {
  type: AgendaEventType;
  size?: number;
  color?: string;
}) {
  switch (type) {
    case "terapia":
      return <TerapiaIcon size={size} c={color} />;
    case "consulta":
      return <ConsultaIcon size={size} c={color} />;
    case "escola":
      return <EscolaIcon size={size} c={color} />;
    case "medicacao":
      return <MedicacaoIcon size={size} c={color} />;
    default:
      return <OutroIcon size={size} c={color} />;
  }
}
