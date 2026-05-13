export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight ${className}`}
      aria-label="TEAmo"
    >
      <span style={{ color: "var(--primary)" }}>TEA</span>
      <span style={{ color: "var(--accent)" }}>mo</span>
    </span>
  );
}
