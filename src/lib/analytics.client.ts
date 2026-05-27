// Helper client-side para disparar eventos de analytics.
// Todas as falhas são silenciosas — analytics nunca interrompe a UX.
// Chama trackEventServer (ServerFn); nunca acessa o banco diretamente.

import { trackEventServer } from "@/lib/analytics.functions";

// Session ID gerado uma vez por aba/sessão de browser.
// Não é identificável sozinho; serve para agrupar eventos da mesma sessão.
function getSessionId(): string {
  const key = "__teamo_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

interface TrackOptions {
  module?: string;
  route?: string;
  durationMs?: number;
  /** Apenas primitivos simples; nunca dados clínicos */
  properties?: Record<string, string | number | boolean | null>;
}

/**
 * Dispara um evento de analytics de forma assíncrona e silenciosa.
 * Nunca incluir PHI: nomes, emails, textos de registros, diagnósticos.
 *
 * @example
 * track("module.open", { module: "registros", route: "/registros" });
 * track("record.create", { module: "registros", properties: { type: "comportamento" } });
 */
export function track(eventType: string, opts: TrackOptions = {}): void {
  // fire-and-forget com tratamento de erro silencioso
  void (async () => {
    try {
      const sid = getSessionId();
      await trackEventServer({
        data: {
          sessionId: sid,
          eventType,
          module: opts.module,
          route: opts.route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
          durationMs: opts.durationMs,
          properties: opts.properties,
        },
      });
    } catch {
      // silencioso — analytics nunca quebra a UX
    }
  })();
}

// ─── Web Vitals ──────────────────────────────────────────────────────────────

let vitalsInitialized = false;

/**
 * Inicializa coleta de Web Vitals (LCP, CLS, INP).
 * Chamar uma vez no AppShell. Idempotente.
 */
export function initWebVitals(): void {
  if (vitalsInitialized || typeof window === "undefined") return;
  vitalsInitialized = true;

  // Importação dinâmica para não aumentar o bundle inicial
  void import("web-vitals").then(({ onCLS, onLCP, onINP }) => {
    const send = (metric: { name: string; value: number }) => {
      track("web_vitals", {
        durationMs: Math.round(metric.value),
        properties: { metric: metric.name, value: metric.value },
      });
    };
    onCLS(send);
    onLCP(send);
    onINP(send);
  }).catch(() => {
    // web-vitals não disponível — silencioso
  });
}

// ─── Error boundary helper ───────────────────────────────────────────────────

/**
 * Reporta um erro JavaScript capturado por ErrorBoundary.
 * Sanitiza a mensagem para não vazar PHI.
 */
export function trackJsError(error: Error, route?: string): void {
  // Limita a mensagem a 120 chars — reduz risco de mensagem conter dados sensíveis
  const message = error.message?.slice(0, 120) ?? "unknown";
  const name = error.name?.slice(0, 40) ?? "Error";
  track("error.js", {
    route: route ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
    properties: { message, name },
  });
}
