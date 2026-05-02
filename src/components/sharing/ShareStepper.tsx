interface ShareStepperProps {
  step: 1 | 2 | 3 | 4;
}

const LABELS = ["Conteúdo", "Profissional", "Prazo", "Confirmação"];

export function ShareStepper({ step }: ShareStepperProps) {
  return (
    <ol className="mb-4 flex items-center justify-between gap-1 text-[11px] sm:text-xs">
      {LABELS.map((label, i) => {
        const idx = (i + 1) as 1 | 2 | 3 | 4;
        const active = step === idx;
        const done = step > idx;
        return (
          <li key={label} className="flex flex-1 items-center gap-1">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-muted-foreground",
              ].join(" ")}
              aria-current={active ? "step" : undefined}
            >
              {idx}
            </span>
            <span
              className={[
                "truncate",
                active
                  ? "font-semibold text-foreground"
                  : done
                    ? "text-foreground"
                    : "text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </span>
            {i < LABELS.length - 1 && (
              <span className="ml-1 hidden h-px flex-1 bg-border sm:block" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
