import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useParentPatientDashboard } from "@/services/therapist-dashboard.service";
import { PatientDashboard } from "@/components/dashboard/PatientDashboard";

export const Route = createFileRoute(
  "/_auth/meu-terapeuta_/$accessId_/evolucao",
)({
  head: () => ({
    meta: [{ title: "Evolução do tratamento — TEAmo" }],
  }),
  component: ParentPatientDashboardPage,
});

const TEAL = "#0D9488";

function ParentPatientDashboardPage() {
  const navigate = useNavigate();
  const { accessId } = Route.useParams();
  const { data, isLoading, error } = useParentPatientDashboard(accessId);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/meu-terapeuta/$accessId" as any,
              params: { accessId } as any,
            })
          }
          className="-ml-1 mb-4 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Voltar ao acompanhamento
        </button>

        {isLoading && (
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 size={28} className="animate-spin" color={TEAL} />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Erro ao carregar dados de evolução.
          </div>
        )}

        {data && (
          <PatientDashboard
            data={data}
            isParentView
          />
        )}
      </div>
    </AppShell>
  );
}
