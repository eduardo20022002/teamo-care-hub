export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-tight ${className}`}
      aria-label="TEAmo"
    >
      <span className="text-primary">TEA</span>
      <span className="text-accent">mo</span>
    </span>
  );
}
