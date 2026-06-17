/**
 * PremiumPreview — tela de preview de feature bloqueada (Cenário B da spec).
 * O módulo é visível e acessível; em vez de erro, mostra o que a feature faz e
 * convida ao upgrade. Mostrar (e não esconder) aumenta a percepção de valor.
 */
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumBadge } from "@/components/premium/PremiumBadge";
import { UPSELL } from "@/components/premium/copy";
import { useUpgrade } from "@/components/premium/PremiumGate";
import { FEATURE_SCOPE, type PremiumFeature } from "@/lib/plan-limits";

const ACCENT = { therapist: "#0D9488", parent: "#7C3AED", clinic: "#2563EB" } as const;
const ACCENT_SOFT = { therapist: "#F0FDFA", parent: "#F5F3FF", clinic: "#DBEAFE" } as const;

interface PremiumPreviewProps {
  feature: PremiumFeature;
  /** Substitui o título padrão da copy (ex.: nome da criança no contexto). */
  title?: string;
  subtitle?: string;
}

export function PremiumPreview({ feature, title, subtitle }: PremiumPreviewProps) {
  const { openUpgrade } = useUpgrade();
  const copy = UPSELL[feature];
  const scope = FEATURE_SCOPE[feature];
  const accent = ACCENT[scope];
  const accentSoft = ACCENT_SOFT[scope];

  return (
    <div className="mx-auto w-full max-w-md px-5 py-8 text-center">
      <div className="relative mb-5 inline-flex">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: accentSoft }}
        >
          <Sparkles className="h-8 w-8" style={{ color: accent }} />
        </div>
        <PremiumBadge className="absolute -right-2 -top-2" scope={scope} />
      </div>

      <h1 className="text-xl font-semibold text-foreground">{title ?? copy.title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {subtitle ?? copy.body}
      </p>

      <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left">
        {copy.bullets.map((b) => (
          <li key={b} className="flex items-center gap-2.5 text-sm text-foreground">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{ background: accentSoft }}
            >
              <Check className="h-3.5 w-3.5" style={{ color: accent }} />
            </span>
            {b}
          </li>
        ))}
      </ul>

      <Button
        className="mt-7 h-12 w-full rounded-xl text-base font-semibold text-white"
        style={{ background: accent }}
        onClick={() => openUpgrade(feature)}
      >
        Desbloquear com Premium
      </Button>
    </div>
  );
}
