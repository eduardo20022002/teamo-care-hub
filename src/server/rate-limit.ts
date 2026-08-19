/**
 * Rate limiter simples in-memory por chave (IP + endpoint).
 *
 * Limitações:
 * - Por instância de serverless function: em ambientes com múltiplas
 *   instâncias quentes (Vercel), o contador é local. Suficiente para
 *   defesa em profundidade junto com o cooldown de OTP e contagem de
 *   tentativas persistida no DB.
 * - Para escala maior, migrar para Upstash Redis ou similar com DPA.
 *
 * Janela deslizante (sliding window) com timestamps.
 */

interface Entry {
  timestamps: number[]; // ms epoch
}

const store = new Map<string, Entry>();

// Limpeza periódica (apenas no servidor): evita vazamento de memória.
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_AGE_MS = 10 * 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < MAX_AGE_MS);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Não bloqueia o processo
  if (typeof cleanupTimer === "object" && cleanupTimer !== null && "unref" in cleanupTimer) {
    (cleanupTimer as unknown as { unref?: () => void }).unref?.();
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
}

/**
 * Verifica e contabiliza uma requisição.
 *
 * @param key Identificador único (ex: `otp:1.2.3.4`)
 * @param limit Máximo de requisições na janela
 * @param windowMs Janela em ms (ex: 60_000 = 1 min)
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };
  // Remove timestamps fora da janela
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = windowMs - (now - oldest);
    store.set(key, entry);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0,
    };
  }
  entry.timestamps.push(now);
  store.set(key, entry);
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: limit - entry.timestamps.length,
  };
}

/**
 * Extrai o IP do cliente de forma resistente a spoofing.
 *
 * O `x-forwarded-for` pode conter valores PREPENDED pelo próprio cliente antes
 * de chegar no edge da Vercel — então `xff.split(",")[0]` (o primeiro item) é
 * controlável pelo atacante, o que permitia burlar o rate limit variando o
 * header a cada request. Preferimos headers que o edge da Vercel injeta e o
 * cliente não consegue repassar:
 *   1. `x-vercel-forwarded-for` — setado pelo edge da Vercel com o IP real.
 *   2. `x-real-ip` — IP do peer, também injetado pela plataforma.
 *   3. fallback: o ÚLTIMO hop de `x-forwarded-for` (o mais próximo do proxy
 *      confiável), nunca o primeiro.
 */
export function getClientIp(request: Request): string {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0].trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real && real.trim()) return real.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1]; // último hop = proxy confiável
  }
  return "unknown";
}
