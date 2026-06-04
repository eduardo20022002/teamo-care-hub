import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, TrendingUp, ChevronRight, UserPlus, Flag } from "lucide-react";
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
                onOpen={() =>
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
  onOpen,
}: {
  patient: Child;
  onOpen: () => void;
}) {
  const { col } = getPatientColor(patient.id);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3.5 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md w-full"
      style={{
        borderColor: "#EEF0F4",
        boxShadow: "0 1px 2px rgba(15,23,42,0.03), 0 4px 12px rgba(15,23,42,0.04)",
      }}
    >
      {/* Avatar */}
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
        style={{ background: col }}
      >
        {patient.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight" style={{ color: "#0F172A" }}>
          {patient.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px]" style={{ color: "#6B7280" }}>
          <span>{formatAge(patient.birth_date)}</span>
          <span className="inline-flex items-center gap-1" style={{ color: TEAL }}>
            <Flag size={11} strokeWidth={2} />
            <span className="font-semibold text-[11px]">Ver marcos</span>
          </span>
        </div>
      </div>

      <ChevronRight size={18} strokeWidth={1.8} color="#9CA3AF" className="flex-shrink-0" />
    </button>
  );
}
