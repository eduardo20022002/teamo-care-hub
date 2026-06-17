/**
 * UsageBar — indicador de uso para limites do plano gratuito (registros, documentos).
 * Cinza até ~80%, âmbar perto do limite, vermelho no limite. Some no Premium.
 */
interface UsageBarProps {
  used: number;
  total: number;
  /** Texto do recurso no singular/plural, ex.: "registro" / "registros". */
  noun: [singular: string, plural: string];
  /** Ação ao tocar no banner de limite atingido (abre o paywall). */
  onUpgrade?: () => void;
  /** Cor de destaque do escopo (padrão: roxo para pais). */
  accentColor?: string;
}

const PURPLE = "#7C3AED";

export function UsageBar({ used, total, noun, onUpgrade, accentColor = PURPLE }: UsageBarProps) {
  const pct = Math.min(100, Math.round((used / total) * 100));
  const atLimit = used >= total;
  const near = !atLimit && used >= Math.ceil(total * 0.8);

  const color = atLimit ? "#DC2626" : near ? "#D97706" : "#94A3B8";
  const label = total === 1 ? noun[0] : noun[1];

  if (atLimit) {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        className="mb-4 flex w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left"
        style={{ borderColor: `${accentColor}44`, background: `${accentColor}11` }}
      >
        <span className="text-xs font-medium" style={{ color: accentColor }}>
          Limite atingido · faça upgrade para adicionar mais
        </span>
        <span className="text-xs font-semibold" style={{ color: accentColor }}>→</span>
      </button>
    );
  }

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-[#6B7280]">
          {used} de {total} {label} {total === 1 ? "incluído" : "usados"}
        </span>
        {near && (
          <span className="text-[11px] font-medium" style={{ color }}>
            quase no limite
          </span>
        )}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F1F2F6]">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
