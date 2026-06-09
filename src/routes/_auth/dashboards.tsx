import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BarChart2, ChevronRight, UserPlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { usePatients } from "@/services/therapist.service";
import { formatAge } from "@/lib/formatters";
import { getPatientColor } from "@/lib/agenda/tokens";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/dashboards")({
  head: () => ({
    meta: [{ title: "Dashboard — TEAmo" }],
  }),
  component: DashboardsPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

function DashboardsPage() {
  const navigate = useNavigate();
  const patientsQuery = usePatients();
  const patients = ((patientsQuery.data as any)?.patients ?? []) as Child[];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Voltar */}
        <button
          type="button"
          onClick={() => navigate({ to: "/dashboard" })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Voltar ao início
        </button>

        {/* Título */}
        <div className="mt-1.5 mb-6 flex items-center gap-3">
          <div
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: TEAL_SOFT }}
          >
            <BarChart2 size={20} strokeWidth={1.7} color={TEAL} />
          </div>
          <div>
            <h1
              className="text-2xl font-extrabold leading-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
            >
              Dashboard
            </h1>
            <p className="text-[12.5px]" style={{ color: "#6B7280" }}>
              Selecione um paciente para ver seus gráficos de evolução.
            </p>
          </div>
        </div>

        {/* Lista */}
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
              Adicione pacientes para visualizar o dashboard.
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
              <DashboardPatientCard
                key={patient.id}
                patient={patient}
                onClick={() =>
                  navigate({
                    to: "/evolucao/$childId" as any,
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

function DashboardPatientCard({
  patient,
  onClick,
}: {
  patient: Child;
  onClick: () => void;
}) {
  const { col } = getPatientColor(patient.id);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md active:scale-[0.99]"
      style={{
        borderColor: "#EEF0F4",
        boxShadow: "0 1px 2px rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.04)",
      }}
    >
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
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: TEAL_SOFT }}
      >
        <ChevronRight size={15} strokeWidth={2.2} color={TEAL} />
      </div>
    </button>
  );
}
