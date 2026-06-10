import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, Clock } from "lucide-react";

export const Route = createFileRoute("/_auth/clinica/avaliacoes")({
  head: () => ({ meta: [{ title: "Avaliações — Clínica TEAmo" }] }),
  component: ClinicAvaliacoesPage,
});

function ClinicAvaliacoesPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Avaliações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Relatórios VB-MAPP, ABLLS-R e FBA</p>
      </div>
      <div
        className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
          <ClipboardCheck size={28} color="#7C3AED" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Módulo em desenvolvimento</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            O módulo de Avaliações Iniciais com formulários VB-MAPP/ABLLS-R e geração de relatório
            para convênio será implementado na Fase 4.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-700"
          style={{ background: "#FEF9C3", border: "0.5px solid #FDE68A" }}
        >
          <Clock size={14} />
          Disponível em breve — Fase 4
        </div>
      </div>
    </div>
  );
}
