export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block font-bold tracking-tight ${className}`}
      aria-label="TEAmo"
      style={{
        color: "var(--primary)",
        backgroundImage:
          "linear-gradient(90deg, var(--primary) 0%, var(--primary) 60%, var(--accent) 100%)",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      TEAmo
    </span>
  );
}
