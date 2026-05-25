import type { ReactNode } from "react";

const BULLETS = [
  "Histórico completo do seu filho sempre com você",
  "Profissionais e registros em um só lugar",
  "Compartilhe com quem precisa, quando precisar",
];

function BrandPanel() {
  return (
    <div
      className="bg-brand-gradient relative overflow-hidden flex flex-col shrink-0
        lg:w-1/2 lg:min-h-screen
        rounded-b-[28px] lg:rounded-none"
    >
      {/* Blob superior direito — radial gradient branco suave */}
      <svg
        viewBox="0 0 600 600"
        className="pointer-events-none absolute"
        style={{ top: "-15%", right: "-25%", width: "85%", opacity: 0.18 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="blob1" cx="50%" cy="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.9" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="300" cy="300" r="280" fill="url(#blob1)" />
      </svg>
      {/* Blob inferior esquerdo — radial gradient rosa suave */}
      <svg
        viewBox="0 0 500 500"
        className="pointer-events-none absolute text-accent"
        style={{ bottom: "-20%", left: "-15%", width: "70%", opacity: 0.12 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="blob2" cx="50%" cy="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="250" r="240" fill="url(#blob2)" />
      </svg>

      {/* Badge do logo — fixo no topo esquerdo */}
      <div className="relative z-10 px-6 pt-5 lg:px-14 lg:pt-10">
        <div className="inline-flex items-center bg-white rounded-2xl px-5 py-2.5 shadow-sm">
          <span className="text-xl font-extrabold tracking-tight leading-none">
            <span className="text-primary">TEA</span>
            <span className="text-accent">mo</span>
          </span>
        </div>
      </div>

      {/* Conteúdo central — headline + bullets (bullets ocultos no mobile) */}
      <div className="relative z-10 lg:flex-1 flex flex-col justify-center px-6 py-5 lg:px-14 lg:py-12">
        <h1 className="text-xl lg:text-4xl font-extrabold text-white leading-tight tracking-tight">
          Cuidar é complexo.<br />
          O{" "}
          <span className="relative inline-block font-black tracking-tight">
            <span className="text-white">TEA</span>
            <span className="text-accent">mo</span>
            <svg
              viewBox="0 0 200 14"
              preserveAspectRatio="none"
              aria-hidden="true"
              className="text-accent"
              style={{ position: "absolute", left: 0, right: 0, bottom: -6, width: "100%", height: 9 }}
            >
              <path
                d="M2 8 Q 25 1, 50 7 T 100 7 T 150 7 T 198 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                opacity="0.95"
              />
            </svg>
          </span>
          {" "}simplifica.
        </h1>
        <p className="hidden lg:block mt-3 text-white/75 text-sm lg:text-base leading-relaxed">
          A plataforma que organiza, em um único lugar, o cuidado de quem você ama.
        </p>

        {/* Bullets — ocultos no mobile */}
        <ul className="hidden lg:flex flex-col gap-3 mt-8">
          {BULLETS.map((text) => (
            <li key={text} className="flex items-center gap-3">
              <span
                className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border"
                style={{ borderColor: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.15)" }}
              >
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6l3 3 6-6" />
                </svg>
              </span>
              <span className="text-white/90 text-sm">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Rodapé LGPD — canto inferior esquerdo */}
      <div className="relative z-10 px-6 pb-5 lg:px-14 lg:pb-10">
        <div className="flex items-center gap-2 text-white/50 text-xs">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 1.5l5 2.25v4.5c0 3-2.5 5.25-5 6.25C5.5 13.5 3 11.25 3 8.25v-4.5L8 1.5z" />
          </svg>
          <span>Seus dados protegidos · LGPD</span>
        </div>
      </div>
    </div>
  );
}

interface AuthShellProps {
  children: ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#FAFAFC]">
      <BrandPanel />

      {/* Painel do formulário — centralizado verticalmente */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 lg:px-16">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
