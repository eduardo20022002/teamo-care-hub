export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--primary) 0%, var(--primary) 60%, var(--accent) 78%, var(--accent) 100%)",
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
