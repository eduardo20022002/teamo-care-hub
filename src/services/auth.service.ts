import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { logAuthEvent } from "./audit.service";

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** true quando o Supabase exige confirmação de e-mail antes de criar sessão */
  needsConfirmation?: boolean;
  /** segundos de espera quando o erro é rate limit — para a UI travar o botão */
  rateLimitSeconds?: number;
  /** true quando o e-mail já tem conta (permite oferecer adicionar outro papel) */
  emailExists?: boolean;
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already exists") || m.includes("user already registered"))
    return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("password") && m.includes("pwned"))
    return "Esta senha aparece em vazamentos conhecidos. Escolha outra.";
  if (m.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("token has expired") || m.includes("otp expired") || m.includes("expired or is invalid"))
    return "Código inválido ou expirado. Solicite um novo código.";
  if (m.includes("invalid token") || (m.includes("otp") && m.includes("invalid")))
    return "Código inválido. Verifique os dígitos e tente novamente.";
  if (m.includes("new password should be different"))
    return "A nova senha deve ser diferente da senha atual.";
  if ((m.includes("password") && m.includes("at least")) || m.includes("weak password"))
    return "A senha é muito fraca. Use ao menos 8 caracteres com letras, números e um símbolo.";
  if (m.includes("signup_disabled") || m.includes("signups not allowed"))
    return "O cadastro está temporariamente desativado. Tente mais tarde.";
  if (m.includes("email address") && m.includes("invalid"))
    return "O endereço de e-mail é inválido.";
  if (m.includes("user not found") || m.includes("no user found"))
    return "Não foi possível concluir. Verifique os dados e tente novamente.";
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

/** Extrai segundos de espera de mensagens de rate limit do Supabase. */
function getRateLimitSeconds(message: string): number | undefined {
  const m = message.toLowerCase();
  const isRateLimit =
    m.includes("rate limit") ||
    m.includes("for security purposes") ||
    m.includes("you can only request") ||
    m.includes("over_email_send_rate_limit") ||
    m.includes("too many");
  if (!isRateLimit) return undefined;
  const match = message.match(/(\d+)\s*seconds?/i);
  return match ? parseInt(match[1]) : 60;
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
  options?: { userType?: "parent" | "therapist" },
): Promise<AuthResult> {
  const userType = options?.userType ?? "parent";
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined;
  const trimmedName = displayName?.trim();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
      data: { ...(trimmedName ? { display_name: trimmedName } : {}), user_type: userType },
    },
  });
  if (error) {
    await logAuthEvent(null, "auth.login_failure", { stage: "signup" });
    const isExisting = /already registered|already exists|user already registered/i.test(error.message);
    return {
      ok: false,
      error: translateAuthError(error.message),
      rateLimitSeconds: getRateLimitSeconds(error.message),
      emailExists: isExisting || undefined,
    };
  }
  // Supabase retorna user com identities vazio quando o email já está cadastrado
  // (proteção contra enumeração). Detectamos aqui para dar feedback claro.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      ok: false,
      error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha.",
      emailExists: true,
    };
  }
  await logAuthEvent(data.user?.id ?? null, "auth.signup_success", {});
  // Quando e-mail de confirmação está habilitado, Supabase retorna session null.
  // Nesse caso, o usuário precisa confirmar antes de ter acesso autenticado.
  return { ok: true, needsConfirmation: !data.session };
}

export async function resendVerification(email: string): Promise<AuthResult> {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/onboarding` : undefined;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: translateAuthError(error.message), rateLimitSeconds: getRateLimitSeconds(error.message) };
  return { ok: true };
}

/**
 * Confirma o cadastro com o código de 6 dígitos (OTP) enviado por e-mail.
 * Em caso de sucesso, o Supabase cria a sessão automaticamente — o usuário
 * fica autenticado e o fluxo de redirecionamento (onboarding/convite) assume.
 */
export async function verifySignupOtp(email: string, code: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code.trim(),
    type: "signup",
  });
  if (error) {
    await logAuthEvent(null, "auth.login_failure", { stage: "signup_otp" });
    return {
      ok: false,
      error: translateAuthError(error.message),
      rateLimitSeconds: getRateLimitSeconds(error.message),
    };
  }
  await logAuthEvent(data.user?.id ?? null, "auth.signup_success", { method: "otp" });
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await logAuthEvent(null, "auth.login_failure", {});
    return { ok: false, error: translateAuthError(error.message), rateLimitSeconds: getRateLimitSeconds(error.message) };
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
    return { ok: false, error: translateAuthError(error.message), rateLimitSeconds: getRateLimitSeconds(error.message) };
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
