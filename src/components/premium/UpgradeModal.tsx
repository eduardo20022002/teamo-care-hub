/**
 * UpgradeModal — bottom sheet de paywall (Cenário A da spec).
 * Aparece sobre o contexto atual quando o usuário atinge um limite ou toca numa
 * feature Premium. Não redireciona — só abre e fecha. Escopo-aware: preço, cor e
 * destino do CTA mudam conforme a feature pertença ao terapeuta ou ao responsável.
 */
import { useNavigate } from "@tanstack/react-router";
import { Check, Sparkles, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { UPSELL } from "@/components/premium/copy";
import { FEATURE_SCOPE, featurePrice, type PremiumFeature } from "@/lib/plan-limits";

// Terapeuta = teal; Responsável = roxo; Clínica = azul.
const ACCENT = { therapist: "#0D9488", parent: "#7C3AED", clinic: "#2563EB" } as const;
const ACCENT_SOFT = { therapist: "#F0FDFA", parent: "#F5F3FF", clinic: "#DBEAFE" } as const;

function formatPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

interface UpgradeModalProps {
  open: boolean;
  feature: PremiumFeature | null;
  onClose: () => void;
}

export function UpgradeModal({ open, feature, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();
  const copy = feature ? UPSELL[feature] : null;
  const scope = feature ? FEATURE_SCOPE[feature] : "therapist";
  const price = feature ? featurePrice(feature) : null;
  const accent = ACCENT[scope];
  const accentSoft = ACCENT_SOFT[scope];

  const goToPlans = () => {
    onClose();
    navigate({ to: "/premium" as any, search: { scope } as any });
  };

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerPortal>
        <DrawerOverlay className="fixed inset-0 z-50 bg-black/40" />
        <DrawerContent className="z-50 rounded-t-3xl border-none p-0">
          {copy && price && (
            <div className="mx-auto w-full max-w-md px-6 pb-8 pt-2">
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-muted" />

              <div className="mb-4 flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: accentSoft }}
                >
                  <Sparkles className="h-6 w-6" style={{ color: accent }} />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{copy.body}</p>

              <ul className="mt-4 space-y-2.5">
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
                className="mt-6 h-12 w-full rounded-xl text-base font-semibold text-white"
                style={{ background: accent }}
                onClick={goToPlans}
              >
                Assinar TEAmo Premium — R$ {formatPrice(price.monthly)}/mês
              </Button>

              <button
                type="button"
                onClick={goToPlans}
                className="mt-3 w-full text-center text-sm font-medium"
                style={{ color: accent }}
              >
                Começar com {price.trialDays} dias grátis
              </button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Cancele quando quiser. Sem fidelidade.
              </p>
            </div>
          )}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
