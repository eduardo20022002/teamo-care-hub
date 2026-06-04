import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, ChevronRight, UserPlus, Loader2, CheckCircle2, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { usePatientParentSummaries } from "@/services/therapist.service";
import { formatAge } from "@/lib/formatters";

export const Route = createFileRoute("/_auth/pais-responsaveis")({
  head: () => ({ meta: [{ title: "Pais e Responsáveis — TEAmo" }] }),
  component: PaisResponsaveisPage,
});

const PURPLE = "#7C3AED";
const PURPLE_SOFT = "#F5F3FF";
const PURPLE_BORDER = "#DDD6FE";

function PaisResponsaveisPage() {
  const navigate = useNavigate();
  const { data, isLoading } = usePatientParentSummaries();
  const patients = (data?.patients ?? []) as Array<{
    id: string;
    name: string;
    birth_date: string;
    activeAccessCount: number;
    pendingInviteCount: number;
  }>;

  return (
    <AppShell onBack={() => navigate({ to: "/dashboard" as any })}>
      <div className="mx-auto max-w-[520px] px-4 py-6">
        {/* Header */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-6 flex items-start gap-3"
          style={{ borderColor: PURPLE_BORDER, background: PURPLE_SOFT }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "#EDE9FE" }}
          >
            <Users size={20} strokeWidth={1.7} color={PURPLE} />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#0F172A] leading-tight">
              Pais e Responsáveis
            </h1>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Gerencie os vínculos com responsáveis e compartilhe o progresso dos seus pacientes.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin" color={PURPLE} />
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full mb-4"
              style={{ background: PURPLE_SOFT }}
            >
              <UserPlus size={28} strokeWidth={1.5} color={PURPLE} />
            </div>
            <p className="text-[15px] font-semibold text-[#0F172A] mb-1">
              Nenhum paciente cadastrado
            </p>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              Cadastre seu primeiro paciente para começar a gerenciar os vínculos com responsáveis.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {patients.map((patient) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onOpen={() =>
                  navigate({
                    to: "/pais-responsaveis/$childId" as any,
                    params: { childId: patient.id } as any,
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PatientCard({
  patient,
  onOpen,
}: {
  patient: {
    id: string;
    name: string;
    birth_date: string;
    activeAccessCount: number;
    pendingInviteCount: number;
  };
  onOpen: () => void;
}) {
  const hasActive  = patient.activeAccessCount > 0;
  const hasPending = patient.pendingInviteCount > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border bg-white p-4 text-left transition-all hover:shadow-md active:scale-[0.99]"
      style={{ borderColor: PURPLE_BORDER, boxShadow: "0 2px 8px rgba(124,58,237,0.06)" }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold"
          style={{ background: "#EDE9FE", color: PURPLE }}
        >
          {patient.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-extrabold text-[#0F172A] leading-tight truncate">
            {patient.name}
          </p>
          {patient.birth_date && (
            <p className="text-[12px] text-[#6B7280] mt-0.5">{formatAge(patient.birth_date)}</p>
          )}
        </div>

        <ChevronRight size={18} strokeWidth={2} color="#9CA3AF" className="flex-shrink-0" />
      </div>

      {/* Badges */}
      {(hasActive || hasPending) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {hasActive && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "#ECFDF5", color: "#16A34A" }}
            >
              <CheckCircle2 size={11} strokeWidth={2} />
              {patient.activeAccessCount} vínculo{patient.activeAccessCount !== 1 ? "s" : ""} ativo{patient.activeAccessCount !== 1 ? "s" : ""}
            </span>
          )}
          {hasPending && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "#FFFBEB", color: "#D97706" }}
            >
              <Clock size={11} strokeWidth={2} />
              {patient.pendingInviteCount} pendente{patient.pendingInviteCount !== 1 ? "s" : ""}
            </span>
          )}
          {!hasActive && !hasPending && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "#F3F4F6", color: "#9CA3AF" }}
            >
              Sem vínculo
            </span>
          )}
        </div>
      )}

      {!hasActive && !hasPending && (
        <div className="mt-3">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "#F3F4F6", color: "#9CA3AF" }}
          >
            Sem vínculo — toque para convidar responsáveis
          </span>
        </div>
      )}
    </button>
  );
}
