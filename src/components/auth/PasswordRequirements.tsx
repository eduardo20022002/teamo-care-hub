import { Check, X } from "lucide-react";
import { checkPassword } from "@/lib/validation";

const REQUIREMENTS: Array<{ key: keyof ReturnType<typeof checkPassword>; label: string }> = [
  { key: "length", label: "Mínimo de 8 caracteres" },
  { key: "letter", label: "Ao menos uma letra" },
  { key: "number", label: "Ao menos um número" },
  { key: "special", label: "Ao menos um caractere especial" },
];

export function PasswordRequirements({ password }: { password: string }) {
  const checks = checkPassword(password);
  return (
    <ul className="mt-2 space-y-1 text-xs">
      {REQUIREMENTS.map((req) => {
        const ok = checks[req.key];
        return (
          <li
            key={req.key}
            className={`flex items-center gap-2 ${
              ok ? "text-success" : "text-muted-foreground"
            }`}
          >
            {ok ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
            ) : (
              <X className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
            {req.label}
          </li>
        );
      })}
    </ul>
  );
}
