import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Clock } from "lucide-react";

export const Route = createFileRoute("/_auth/clinica/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Clínica TEAmo" }] }),
  component: ClinicFinanceiroPage,
});

function ClinicFinanceiroPage() {
  return (
    <div className="px-6 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Financeiro e Convênios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Autorizações, cotas e controle de pagamentos</p>
      </div>
      <div
        className="bg-white rounded-xl p-12 flex flex-col items-center gap-4 text-center"
        style={{ border: "0.5px solid #E5E7EB" }}
      >
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
          <CreditCard size={28} color="#D97706" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Módulo em desenvolvimento</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            O módulo Financeiro com painel de autorizações (RN ANS 539/2022), controle de cotas,
            alertas de vencimento e workflow de renovação será implementado na Fase 5.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-amber-700"
          style={{ background: "#FEF9C3", border: "0.5px solid #FDE68A" }}
        >
          <Clock size={14} />
          Disponível em breve — Fase 5
        </div>
      </div>
    </div>
  );
}
