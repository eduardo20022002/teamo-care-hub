import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Stethoscope, ChevronRight, Loader2, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useMyTherapistAccesses } from "@/services/therapist.service";

export const Route = createFileRoute("/_auth/meu-terapeuta")({
  head: () => ({ meta: [{ title: "Meu Terapeuta — TEAmo" }] }),
  component: MeuTerapeutaPage,
});

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

function calcAge(birthDate: string): string {
  const today = new Date();
  const bd = new Date(birthDate);
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return `${age} ano${age !== 1 ? "s" : ""}`;
}

function MeuTerapeutaPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useMyTherapistAccesses();
  const accesses = (data?.accesses ?? []) as Array<{
    id: string;
    therapistName: string;
    therapistSpecialty: string;
    grantedAt?: string;
    child: { id: string; name: string; birth_date: string } | null;
  }>;

  return (
    <AppShell
      onBack={() => navigate({ to: "/dashboard" as any })}
    >
      <div className="mx-auto max-w-[520px] px-4 py-6">
        {/* Header */}
        <div
          className="rounded-[16px] border px-4 py-4 mb-6 flex items-start gap-3"
          style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: "#CCFBF1" }}
          >
            <Stethoscope size={20} strokeWidth={1.7} color={TEAL} />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-[#0F172A] leading-tight">
              Meu Terapeuta
            </h1>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Acompanhe o progresso compartilhado pelo terapeuta do seu filho.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin" color={TEAL} />
          </div>
        ) : accesses.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full mb-4"
              style={{ background: TEAL_SOFT }}
            >
              <Stethoscope size={28} strokeWidth={1.5} color={TEAL} />
            </div>
            <p className="text-[15px] font-semibold text-[#0F172A] mb-1">
              Nenhum terapeuta vinculado
            </p>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              Quando um terapeuta enviar um convite e você aceitar, o acompanhamento aparecerá aqui.
              Verifique também a aba{" "}
              <button
                type="button"
                className="font-semibold underline"
                style={{ color: TEAL }}
                onClick={() => navigate({ to: "/profissionais" as any })}
              >
                Profissionais
              </button>{" "}
              para convites pendentes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {accesses.map((access) => (
              <button
                key={access.id}
                type="button"
                onClick={() =>
                  navigate({
                    to: "/meu-terapeuta/$accessId" as any,
                    params: { accessId: access.id } as any,
                  })
                }
                className="w-full rounded-[18px] border bg-white p-4 text-left transition-all hover:shadow-md active:scale-[0.99]"
                style={{ borderColor: TEAL_BORDER, boxShadow: "0 2px 8px rgba(13,148,136,0.07)" }}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar da criança */}
                  <div
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[18px] font-bold"
                    style={{ background: TEAL_BORDER, color: TEAL }}
                  >
                    {access.child?.name.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-extrabold text-[#0F172A] leading-tight truncate">
                      {access.child?.name ?? "Paciente"}
                    </p>
                    {access.child?.birth_date && (
                      <p className="text-[12px] text-[#6B7280]">{calcAge(access.child.birth_date)}</p>
                    )}
                  </div>
                  <ChevronRight size={18} strokeWidth={2} color="#9CA3AF" className="flex-shrink-0" />
                </div>

                {/* Info do terapeuta */}
                <div
                  className="mt-3 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed"
                  style={{ background: "rgba(13,148,136,0.08)", color: "#0F766E" }}
                >
                  <span className="font-semibold">{access.therapistName}</span>
                  {access.therapistSpecialty ? ` · ${access.therapistSpecialty}` : ""}
                </div>

                {/* Data de vínculo */}
                {(access as any).granted_at && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Calendar size={11} strokeWidth={1.8} color="#9CA3AF" />
                    <span className="text-[11px] text-[#9CA3AF]">
                      Vinculado em{" "}
                      {new Date((access as any).granted_at).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
