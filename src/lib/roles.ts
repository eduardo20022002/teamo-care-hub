// Helpers de papel de usuário (parent | therapist).
// Um usuário pode ter dois papéis: user_type (primário) + secondary_role.
// O "papel ativo" da sessão é puramente UI — guardado em sessionStorage.
// NUNCA é usado em RLS: toda autorização no banco é por auth.uid().

export type Role = "parent" | "therapist";

const ACTIVE_ROLE_KEY = "teamo:activeRole";

interface RoleSource {
  user_type: Role;
  secondary_role?: Role | null;
}

/** Lista de papéis distintos que o usuário possui. */
export function getUserRoles(p: RoleSource): Role[] {
  const set = new Set<Role>([p.user_type]);
  if (p.secondary_role) set.add(p.secondary_role);
  return Array.from(set);
}

/** true quando o usuário tem ambos os papéis (precisa escolher no login). */
export function isDualRole(p: RoleSource): boolean {
  return getUserRoles(p).length > 1;
}

export function hasRole(p: RoleSource, role: Role): boolean {
  return getUserRoles(p).includes(role);
}

/** Lê o papel ativo escolhido na sessão (ou null). */
export function getActiveRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(ACTIVE_ROLE_KEY);
  return v === "parent" || v === "therapist" ? v : null;
}

export function setActiveRole(role: Role): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
  } catch {
    /* sessionStorage indisponível — não crítico */
  }
}

export function clearActiveRole(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  } catch {
    /* não crítico */
  }
}

/**
 * Resolve o papel ativo a usar agora:
 * - papel único → esse papel (e fixa no storage)
 * - dois papéis → o que está no storage, ou null se ainda não escolheu
 */
export function resolveActiveRole(p: RoleSource): Role | null {
  const roles = getUserRoles(p);
  if (roles.length === 1) {
    return roles[0];
  }
  const stored = getActiveRole();
  return stored && roles.includes(stored) ? stored : null;
}
