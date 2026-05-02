const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Formata "YYYY-MM-DD" como "15 de abril de 2026" (PT-BR). */
export function formatBirthDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${d} de ${MONTHS_PT[m - 1]} de ${y}`;
}

/**
 * Idade arredondada para baixo. Se < 1 ano, retorna meses.
 * "0 anos" só é usado quando a criança tem menos de 1 mês.
 */
export function formatAge(isoBirthDate: string, now: Date = new Date()): string {
  const [y, m, d] = isoBirthDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const birth = new Date(y, m - 1, d);
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  const dayDiff = now.getDate() - birth.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years--;

  if (years >= 1) return `${years} ${years === 1 ? "ano" : "anos"}`;

  // < 1 ano: meses
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + monthDiff;
  if (dayDiff < 0) months--;
  if (months <= 0) return "0 meses";
  return `${months} ${months === 1 ? "mês" : "meses"}`;
}

export function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}
