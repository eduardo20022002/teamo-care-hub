import { FolderOpen, Plus } from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
const PASTEL_GRADIENT =
  "linear-gradient(140deg, #E5E9FF 0%, #ECE5FE 45%, #FDE8F3 100%)";

interface Props {
  hasChildren: boolean;
  onAdd?: () => void;
}

export function EmptyDocuments({ hasChildren, onAdd }: Props) {
  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center rounded-[20px] p-8 text-center"
        style={{ background: PASTEL_GRADIENT }}
      >
        <div
          className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[22px]"
          style={{ background: "#F3E8FF" }}
        >
          <FolderOpen
            className="h-8 w-8"
            style={{ color: "#7C3AED" }}
            strokeWidth={1.75}
          />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Nenhum documento por aqui
        </h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Anexe laudos, relatórios e prescrições para encontrá-los facilmente
          depois. Também aparecem nos registros de atendimento.
        </p>
        {hasChildren && onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-6 flex h-[50px] items-center gap-2 rounded-[12px] px-8 text-sm font-semibold text-white"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Adicionar documento
          </button>
        )}
      </div>

      <div className="rounded-[16px] border border-[#EEF0F4] bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          O que você pode guardar aqui
        </p>
        <div className="space-y-3">
          {[
            { emoji: "📋", t: "Laudos e relatórios", d: "Neurologista, psicólogo, fonoaudiólogo e outros." },
            { emoji: "💊", t: "Prescrições médicas", d: "Com aviso automático antes de vencer." },
            { emoji: "🏫", t: "Documentos escolares", d: "AEE, relatórios pedagógicos e comunicados." },
          ].map(({ emoji, t, d }) => (
            <div key={t} className="flex items-start gap-3">
              <span className="text-lg">{emoji}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{t}</p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
