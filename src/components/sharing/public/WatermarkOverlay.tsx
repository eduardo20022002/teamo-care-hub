interface Props {
  text: string;
}

export function WatermarkOverlay({ text }: Props) {
  // Repeated diagonal watermark using a single full-screen overlay.
  const items = Array.from({ length: 60 });
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden select-none"
      style={{ mixBlendMode: "multiply" }}
    >
      <div
        className="absolute inset-0 grid grid-cols-3 gap-y-10"
        style={{ transform: "rotate(-28deg) scale(1.4)", transformOrigin: "center" }}
      >
        {items.map((_, i) => (
          <span
            key={i}
            className="text-[12px] font-medium text-foreground/15 sm:text-[13px]"
            style={{ whiteSpace: "nowrap" }}
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
