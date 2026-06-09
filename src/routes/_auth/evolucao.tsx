import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, TrendingUp, UserPlus, Flag, BarChart2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { usePatients } from "@/services/therapist.service";
import { formatAge } from "@/lib/formatters";
import { getPatientColor } from "@/lib/agenda/tokens";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/evolucao")({
  head: () => ({
    meta: [{ title: "Evolução — TEAmo" }],
  }),
  component: EvolucaoPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

function EvolucaoPage() {
  const navigate = useNavigate();
  const patientsQuery = usePatients();
  const patients = ((patientsQuery.data as any)?.patients ?? []) as Child[];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard" })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Voltar ao início
        </button>

        <div className="mt-1.5 mb-6 flex items-center gap-3">
          <div
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "#ECFDF5" }}
          >
            <TrendingUp size={20} strokeWidth={1.7} color={TEAL} />
          </div>
          <h1
            className="text-2xl font-extrabold leading-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
          >
            Evolução
          </h1>
        </div>

        {/* Lista de pacientes */}
        {patientsQuery.isLoading ? (
          <LoadingSpinner />
        ) : patients.length === 0 ? (
          <div
            className="rounded-[18px] border p-8 text-center"
            style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: TEAL_BORDER }}
            >
              <UserPlus size={24} strokeWidth={1.7} color={TEAL} />
            </div>
            <p className="font-semibold text-[#0F172A]">Nenhum paciente ainda</p>
            <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>
              Adicione pacientes para acompanhar sua evolução.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/pacientes/novo" as any })}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white"
              style={{ background: TEAL }}
            >
              Adicionar paciente
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p
              className="mb-1 text-[12px] font-bold uppercase tracking-wider"
              style={{ color: "#9CA3AF" }}
            >
              Meus pacientes
            </p>
            {patients.map((patient) => (
              <EvolutionPatientCard
                key={patient.id}
                patient={patient}
                onDashboard={() =>
                  navigate({
                    to: "/evolucao/$childId" as any,
                    params: { childId: patient.id } as any,
                  })
                }
                onMarcos={() =>
                  navigate({
                    to: "/paciente/$childId/marcos" as any,
                    params: { childId: patient.id } as any,
                  })
                }
              />
            ))}
          </div>
        )}

        <div className="h-8" />
      </div>
    </AppShell>
  );
}

function EvolutionPatientCard({
  patient,
  onDashboard,
  onMarcos,
}: {
  patient: Child;
  onDashboard: () => void;
  onMarcos: () => void;
}) {
  const { col } = getPatientColor(patient.id);

  return (
    <div
      className="overflow-hidden rounded-[18px] border bg-white"
      style={{
        borderColor: "#EEF0F4",
        boxShadow: "0 1px 2px rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Header do card */}
      <div className="flex items-center gap-3.5 p-4">
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
          style={{ background: col }}
        >
          {patient.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-tight" style={{ color: "#0F172A" }}>
            {patient.name}
          </div>
          <div className="mt-0.5 text-[12.5px]" style={{ color: "#6B7280" }}>
            {formatAge(patient.birth_date)}
          </div>
        </div>
      </div>

      {/* Ações */}
      <div
        className="grid grid-cols-2 divide-x border-t"
        style={{ borderColor: "#F3F4F6", divideColor: "#F3F4F6" }}
      >
        <button
          type="button"
          onClick={onDashboard}
          className="flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-bold transition-colors hover:bg-[#F0FDFA]"
          style={{ color: TEAL }}
        >
          <BarChart2 size={13} strokeWidth={2} />
          Dashboard
        </button>
        <button
          type="button"
          onClick={onMarcos}
          className="flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-semibold transition-colors hover:bg-[#F9FAFB]"
          style={{ color: "#374151", borderColor: "#F3F4F6" }}
        >
          <Flag size={13} strokeWidth={2} />
          Marcos
        </button>
      </div>
    </div>
  );
}
