import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "touchstart", "click"] as const;

/**
 * Dispara `onTimeout` após `timeoutMs` sem interação do usuário.
 * Considera mousemove, keydown, touchstart e click como atividade.
 */
export function useIdleTimeout(timeoutMs: number, onTimeout: () => void, enabled = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(onTimeout);

  useEffect(() => {
    callbackRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => callbackRef.current(), timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [timeoutMs, enabled]);
}
