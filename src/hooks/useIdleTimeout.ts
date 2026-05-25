import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "click"] as const;

export interface IdleTimeoutOptions {
  /**
   * Milliseconds before `timeoutMs` to fire `onWarn`.
   * E.g. pass 60_000 to warn 1 minute before the session expires.
   */
  warnBeforeMs?: number;
  /** Callback fired `warnBeforeMs` before the session expires. */
  onWarn?: () => void;
}

/**
 * Dispara `onTimeout` após `timeoutMs` sem interação do usuário.
 * Considera mousemove, keydown, touchstart e click como atividade.
 *
 * Se `options.warnBeforeMs` e `options.onWarn` forem fornecidos, dispara
 * `onWarn` `warnBeforeMs` ms antes do timeout (e.g. aviso de 1 minuto antes).
 * Qualquer atividade do usuário cancela e reagenda ambos os timers.
 */
export function useIdleTimeout(
  timeoutMs: number,
  onTimeout: () => void,
  enabled = true,
  options?: IdleTimeoutOptions,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onTimeout);
  const warnCallbackRef = useRef(options?.onWarn);

  useEffect(() => {
    callbackRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    warnCallbackRef.current = options?.onWarn;
  }, [options?.onWarn]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const clearTimers = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearTimeout(warnTimerRef.current);
    };

    const reset = () => {
      clearTimers();

      // Schedule warning timer if configured
      if (options?.warnBeforeMs && options.warnBeforeMs < timeoutMs) {
        warnTimerRef.current = setTimeout(
          () => warnCallbackRef.current?.(),
          timeoutMs - options.warnBeforeMs,
        );
      }

      timerRef.current = setTimeout(() => callbackRef.current(), timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
    // options.warnBeforeMs intentionally not in deps — stable at call-site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, enabled, options?.warnBeforeMs]);
}
