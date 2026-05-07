export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--primary) 0%, var(--primary) 55%, var(--accent) 95%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }}
      aria-label="TEAmo"
    >
      TEAmo
    </span>
  );
}
