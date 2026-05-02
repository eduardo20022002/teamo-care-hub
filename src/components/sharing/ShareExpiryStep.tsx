import { Label } from "@/components/ui/label";

export type ExpiryHours = 6 | 24 | 48;

interface Props {
  value: ExpiryHours;
  onChange: (v: ExpiryHours) => void;
}

const OPTIONS: { value: ExpiryHours; label: string; help: string }[] = [
  { value: 6, label: "6 horas", help: "Acesso curto, ideal para revisão pontual." },
  { value: 24, label: "24 horas", help: "Tempo confortável para o profissional acessar." },
  { value: 48, label: "48 horas", help: "Prazo máximo permitido pelo sistema." },
];

export function ShareExpiryStep({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <Label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Por quanto tempo o link ficará ativo?
      </Label>
      <div className="space-y-2">
        {OPTIONS.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={[
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary-soft/40"
                  : "border-border bg-card hover:bg-primary-soft/20",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-1 h-3 w-3 shrink-0 rounded-full border",
                  active ? "border-primary bg-primary" : "border-border",
                ].join(" ")}
                aria-hidden
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.help}</p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Após o prazo, o link deixa de funcionar mesmo com código correto.
      </p>
    </div>
  );
}
