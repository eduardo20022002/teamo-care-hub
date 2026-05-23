import type { ReactNode } from "react";

/**
 * Revela conteúdo com animação suave (height 0→auto, opacity 0→1) usando
 * o truque do `grid-template-rows: 0fr / 1fr` (CSS puro, sem JS de medida).
 */
export function AnimatedReveal({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        transition: "grid-template-rows 220ms ease, opacity 180ms ease",
      }}
      aria-hidden={!show}
    >
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}
