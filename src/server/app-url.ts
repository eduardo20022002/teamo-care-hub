// Fonte única da URL base canônica do app (server-side).
// Usada para montar links de e-mail (convites, aprovações, etc.).
// Definir VITE_APP_URL na Vercel (Production + Preview) para sobrescrever.
export function appBaseUrl(): string {
  return process.env.VITE_APP_URL ?? "https://teamotech.online";
}
