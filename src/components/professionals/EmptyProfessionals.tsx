import { Users } from "lucide-react";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
const PASTEL_GRADIENT =
  "linear-gradient(140deg, #E5E9FF 0%, #ECE5FE 45%, #FDE8F3 100%)";

interface Props {
  onAdd: () => void;
}

export function EmptyProfessionals({ onAdd }: Props) {
  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center rounded-[20px] p-8 text-center"
        style={{ background: PASTEL_GRADIENT }}
      >
        <div
          className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[22px]"
          style={{ background: "#EEF1FF" }}
        >
          <Users className="h-8 w-8" style={{ color: "#4F46E5" }} strokeWidth={1.75} />
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Comece sua rede de cuidado
        </h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          Reúna em um só lugar todos os profissionais que acompanham a criança.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-6 h-[50px] rounded-[12px] px-8 text-sm font-semibold text-white"
          style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
        >
          + Cadastrar profissional
        </button>
      </div>

      <div className="rounded-[16px] border border-[#EEF0F4] bg-white p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Para que serve
        </p>
        <div className="space-y-3">
          {[
            { n: "1", t: "Vincule à Agenda", d: "Associe cada profissional aos compromissos da criança." },
            { n: "2", t: "Compartilhe com segurança", d: "Envie registros e documentos via link com código de acesso." },
            { n: "3", t: "Histórico centralizado", d: "Todos os atendimentos ficam organizados por profissional." },
          ].map(({ n, t, d }) => (
            <div key={n} className="flex items-start gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: BRAND_GRADIENT }}
              >
                {n}
              </span>
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
