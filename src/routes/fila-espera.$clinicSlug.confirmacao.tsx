import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Heart, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/fila-espera/$clinicSlug/confirmacao")({
  head: () => ({
    meta: [{ title: "Solicitação enviada — TEAmo" }],
  }),
  component: ConfirmacaoPage,
});

function ConfirmacaoPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F6F7FB" }}>
      {/* Header */}
      <header
        className="h-14 flex items-center px-4"
        style={{ background: "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)" }}
      >
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">TEAmo</span>
        </div>
      </header>

      <main className="px-4 py-12 max-w-md mx-auto flex flex-col items-center text-center">
        {/* Ícone de sucesso */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "#F0FDF4" }}
        >
          <CheckCircle2 size={40} className="text-green-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Solicitação enviada!
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Recebemos as informações e sua criança está na fila de espera da clínica.
          A equipe entrará em contato pelo e-mail informado para confirmar a vaga
          e combinar os próximos passos.
        </p>

        <div
          className="w-full rounded-xl p-5 text-left mb-8"
          style={{ background: "#EEF2FF", border: "1.5px solid #C7D2FE" }}
        >
          <p className="text-sm font-semibold text-indigo-700 mb-2">O que acontece agora?</p>
          <ol className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
              A clínica analisará as informações e definirá a prioridade do caso.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
              Você receberá um e-mail de confirmação com o número de protocolo.
            </li>
            <li className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
              Quando surgir uma vaga, a equipe entrará em contato para agendar a avaliação.
            </li>
          </ol>
        </div>

        <div
          className="w-full rounded-xl p-4 text-sm text-gray-600 mb-8"
          style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
        >
          <p className="font-medium text-amber-800 mb-1">Dúvidas?</p>
          <p className="text-xs">
            Se precisar atualizar as informações ou tiver perguntas, entre em contato
            diretamente com a clínica informando seu e-mail de cadastro.
          </p>
        </div>

        <a
          href="https://teamotech.online"
          className="flex items-center gap-2 text-sm font-medium text-indigo-600"
        >
          Conheça o TEAmo <ArrowRight size={14} />
        </a>
      </main>
    </div>
  );
}
