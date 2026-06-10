import { createFileRoute } from "@tanstack/react-router";
import { Users, Clock } from "lucide-react";

export const Route = createFileRoute("/_auth/clinica/fila")({
  head: () => ({
    meta: [{ title: "Fila de Espera — Clínica TEAmo" }],
  }),
  component: ClinicFilaPage,
});

function ClinicFilaPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Fila de Espera</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestão da fila de pacientes aguardando atendimento</p>
      </div>

      <div
        className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
          <Users size={28} color="#4F46E5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Módulo em desenvolvimento</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            A Fila de Espera multi-serviço com priorização automática, Form 1 público e painel
            de gestão será implementada na Fase 2.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-700"
          style={{ background: "#FEF9C3", border: "0.5px solid #FDE68A" }}
        >
          <Clock size={14} />
          Disponível em breve — Fase 2
        </div>
      </div>
    </div>
  );
}
