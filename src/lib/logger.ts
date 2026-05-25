/**
 * Structured logger with PHI redaction.
 *
 * Never log PHI directly. Pass only stable identifiers (UUIDs) and event types.
 * Free-text fields are sanitized to strip patterns that look like PII/PHI
 * (emails, phones, CPF, full names with @, etc.) before output.
 *
 * In production, redirects to console (captured by Vercel logs).
 * Replace with a dedicated logging vendor (Datadog/Logtail with DPA) when available.
 */

type LogLevel = "info" | "warn" | "error";

interface LogContext {
  ref?: string; // correlation id (UUID)
  userId?: string;
  shareId?: string;
  professionalId?: string;
  childId?: string;
  recordId?: string;
  eventType?: string;
  outcome?: "success" | "failure";
  failureCode?: string; // short code, never free text from upstream
  [key: string]: unknown;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /\b(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/g;
const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
// UUID padrão 8-4-4-4-12: preservado nos logs para correlação de eventos
const UUID_REGEX = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Tokens longos em base64url/hex (sem hífen para não capturar UUIDs)
const TOKEN_REGEX = /\b[A-Za-z0-9_]{32,}\b/g;

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    return value
      .replace(EMAIL_REGEX, "[EMAIL_REDACTED]")
      .replace(PHONE_REGEX, "[PHONE_REDACTED]")
      .replace(CPF_REGEX, "[CPF_REDACTED]")
      .replace(SSN_REGEX, "[SSN_REDACTED]")
      .replace(UUID_REGEX, "[UUID]")          // UUIDs preservados como [UUID], não como TOKEN
      .replace(TOKEN_REGEX, "[TOKEN_REDACTED]");
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      // Allow known safe keys through without redaction (UUIDs, enums, counters)
      if (
        k === "ref" ||
        k === "userId" ||
        k === "shareId" ||
        k === "professionalId" ||
        k === "childId" ||
        k === "recordId" ||
        k === "eventType" ||
        k === "outcome" ||
        k === "failureCode" ||
        k === "attemptsRemaining" ||
        k === "status"
      ) {
        out[k] = v;
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  if (Array.isArray(value)) return value.map(sanitize);
  return value;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    message: typeof sanitize(message) === "string" ? sanitize(message) : message,
    ...(context ? (sanitize(context) as object) : {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(line);
  } else if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};
