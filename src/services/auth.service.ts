import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { logAuthEvent } from "./audit.service";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already exists"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("user already registered"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("password") && m.includes("pwned"))
    return "Esta senha aparece em vazamentos conhecidos. Escolha outra.";
  if (
    m.includes("rate limit") ||
    m.includes("for security purposes") ||
    m.includes("you can only request") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("too many")
  ) {
    const match = message.match(/(\d+)\s*seconds?/i);
    return match
      ? `Aguarde ${match[1]} segundos antes de tentar novamente.`
      : "Muitas tentativas. Aguarde um instante e tente novamente.";
  }
  if (m.includes("network") || m.includes("fetch"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return "Não foi possível concluir. Tente novamente.";
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined;
  const trimmedName = displayName?.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: trimmedName ? { display_name: trimmedName } : undefined,
    },
  });
  if (error) {
    await logAuthEvent(null, "auth.login_failure", { stage: "signup" });
    return { ok: false, error: translateAuthError(error.message) };
  }
  // Supabase retorna user com identities vazio quando o email já está cadastrado
  // (proteção contra enumeração). Detectamos aqui para dar feedback claro.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      ok: false,
      error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha.",
    };
  }
  await logAuthEvent(data.user?.id ?? null, "auth.signup_success", {});
  return { ok: true };
}

export async function resendVerification(email: string): Promise<AuthResult> {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: translateAuthError(error.message) };
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await logAuthEvent(null, "auth.login_failure", {});
    return { ok: false, error: translateAuthError(error.message) };
  }
  await logAuthEvent(data.user?.id ?? null, "auth.login_success", {});
  return { ok: true };
}

export async function signOut(reason: "manual" | "idle" = "manual"): Promise<void> {
  const { data } = await supabase.auth.getUser();
  await logAuthEvent(
    data.user?.id ?? null,
    reason === "idle" ? "auth.session_expired" : "auth.logout",
    {},
  );
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(
  callback: (session: Session | null) => void,
): { unsubscribe: () => void } {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return { unsubscribe: () => data.subscription.unsubscribe() };
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/redefinir-senha` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    await logAuthEvent(null, "auth.login_failure", { stage: "password_reset_request" });
    return { ok: false, error: translateAuthError(error.message) };
  }
  // Intentionally generic — never confirm if email exists (prevents enumeration)
  return { ok: true };
}

export async function updatePassword(newPassword: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: translateAuthError(error.message) };
  }
  await logAuthEvent(data.user?.id ?? null, "auth.password_changed", {});
  return { ok: true };
}
