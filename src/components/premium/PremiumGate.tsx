/**
 * PremiumGate — provider global do paywall do terapeuta.
 * Monte uma vez no layout autenticado (_auth.tsx). Em qualquer componente:
 *
 *   const { openUpgrade } = useUpgrade();
 *   onClick={() => openUpgrade("patients")}
 *
 * Renderiza um único UpgradeModal compartilhado.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { UpgradeModal } from "@/components/premium/UpgradeModal";
import type { PremiumFeature } from "@/lib/plan-limits";

interface UpgradeContextValue {
  openUpgrade: (feature: PremiumFeature) => void;
}

const UpgradeContext = createContext<UpgradeContextValue>({ openUpgrade: () => {} });

export function PremiumGateProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<PremiumFeature | null>(null);
  const [open, setOpen] = useState(false);

  const openUpgrade = useCallback((f: PremiumFeature) => {
    setFeature(f);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openUpgrade }), [openUpgrade]);

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <UpgradeModal open={open} feature={feature} onClose={() => setOpen(false)} />
    </UpgradeContext.Provider>
  );
}

export function useUpgrade(): UpgradeContextValue {
  return useContext(UpgradeContext);
}
