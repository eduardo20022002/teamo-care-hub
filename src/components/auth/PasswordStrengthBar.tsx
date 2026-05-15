import { checkPassword } from "@/lib/validation";

const LEVELS = [
  { label: "", color: "#E5E7EB" },
  { label: "Fraca", color: "#FCA5A5" },
  { label: "Razoável", color: "#FCD34D" },
  { label: "Boa", color: "#86EFAC" },
  { label: "Forte", color: "#34D399" },
];

function getLevel(password: string): number {
  if (!password) return 0;
  const c = checkPassword(password);
  const passed = Object.values(c).filter(Boolean).length;
  if (passed <= 1) return 1;
  if (passed === 2) return 2;
  if (passed === 3) return 3;
  return 4;
}

export function PasswordStrengthBar({ password }: { password: string }) {
  const level = getLevel(password);
  if (!password) return null;
  const { label, color } = LEVELS[level];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= level ? color : "#E5E7EB" }}
          />
        ))}
      </div>
      {label && (
        <p className="text-xs font-medium" style={{ color }}>
          Força da senha: <span>{label}</span>
        </p>
      )}
    </div>
  );
}

const RULES: Array<{ key: keyof ReturnType<typeof checkPassword>; label: string }> = [
  { key: "length", label: "Mínimo de 8 caracteres" },
  { key: "letter", label: "Ao menos uma letra" },
  { key: "number", label: "Ao menos um número" },
  { key: "special", label: "Caractere especial" },
];

export function PasswordRules({ password }: { password: string }) {
  const checks = checkPassword(password);
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-[10px] p-3" style={{ background: "#F9FAFB" }}>
      {RULES.map((r) => {
        const ok = checks[r.key];
        return (
          <div key={r.key} className="flex items-center gap-1.5">
            <span
              className="flex-shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded-full transition-colors"
              style={{ background: ok ? "#059669" : "#E5E7EB" }}
            >
              {ok && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 5l2.5 2.5 4.5-5" />
                </svg>
              )}
            </span>
            <span className="text-xs" style={{ color: ok ? "#059669" : "#9CA3AF" }}>
              {r.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
