import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/_auth/clinica/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Clínica TEAmo" }] }),
  component: ClinicAgendaPage,
});

function ClinicAgendaPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-500 mt-0.5">Grade semanal, pré-agendamento e reposições</p>
      </div>
      <div
        className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="w-16 h-16 rounded-full bg-pink-50 flex items-center justify-center">
          <Calendar size={28} color="#EC4899" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Módulo em desenvolvimento</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            A Agenda com grade semanal, pré-agendamento recorrente, reposições automáticas e
            integração com a fila de espera será implementada na Fase 3.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-700"
          style={{ background: "#FEF9C3", border: "0.5px solid #FDE68A" }}
        >
          <Clock size={14} />
          Disponível em breve — Fase 3
        </div>
      </div>
    </div>
  );
}
