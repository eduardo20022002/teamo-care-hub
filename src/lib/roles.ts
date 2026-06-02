// Helpers de papel de usuário.
// Regra: 1 e-mail = 1 tipo de perfil (parent | therapist).
// O papel é sempre profiles.user_type — nunca sessionStorage.
// NUNCA é usado em RLS: toda autorização no banco é por auth.uid().

export type Role = "parent" | "therapist";

/** Retorna o papel do usuário a partir do perfil. */
export function getRole(p: { user_type: Role }): Role {
  return p.user_type;
}
