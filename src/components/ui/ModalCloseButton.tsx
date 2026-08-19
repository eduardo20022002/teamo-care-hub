import { X } from "lucide-react";

interface Props {
  onClick: () => void;
  /** Rótulo acessível anunciado por leitores de tela. Padrão: "Fechar". */
  label?: string;
  className?: string;
}

/**
 * Botão de fechar modal padronizado e acessível (issue #6).
 * - `aria-label` para leitores de tela (o ícone sozinho não anuncia função).
 * - Área de toque de 44x44px (h-11 w-11), o mínimo recomendado para mobile —
 *   a coordenadora da clínica abre/fecha esses modais o dia todo no tablet.
 */
export function ModalCloseButton({ onClick, label = "Fechar", className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${className}`}
    >
      <X size={18} strokeWidth={2} />
    </button>
  );
}
