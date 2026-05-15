import { ShieldCheck } from "lucide-react";

export function TrustBadge() {
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mt-6">
      <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
      <span>Protegido pela LGPD · Dados criptografados</span>
    </div>
  );
}
