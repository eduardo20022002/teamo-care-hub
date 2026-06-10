import { createFileRoute } from "@tanstack/react-router";
import { Users2, Clock } from "lucide-react";

export const Route = createFileRoute("/_auth/clinica/grupos")({
  head: () => ({ meta: [{ title: "Grupos ABA — Clínica TEAmo" }] }),
  component: ClinicGruposPage,
});

function ClinicGruposPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Grupos ABA</h1>
        <p className="text-sm text-gray-500 mt-0.5">Composição de grupos, matching e gestão de vagas</p>
      </div>
      <div
        className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
          <Users2 size={28} color="#16A34A" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Módulo em desenvolvimento</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            O módulo de Grupos ABA com composição por critérios de matching (nível VB-MAPP,
            faixa etária, Fator B), sugestão automática de candidatos e gestão de vagas
            será implementado na Fase 7.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-700"
          style={{ background: "#FEF9C3", border: "0.5px solid #FDE68A" }}
        >
          <Clock size={14} />
          Disponível em breve — Fase 7
        </div>
      </div>
    </div>
  );
}
