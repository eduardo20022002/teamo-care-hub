export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--primary) 0%, var(--primary) 60%, var(--accent) 100%)",
        color: "var(--primary)",
      }}
      aria-label="TEAmo"
    >
      TEAmo
    </span>
  );
}
