import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Baby, Stethoscope, Loader2, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { getProfile } from "@/services/profile.service";
import { getUserRoles, setActiveRole, type Role } from "@/lib/roles";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";
const INDIGO = "#4F46E5";
const INDIGO_SOFT = "#EEF1FF";
const INDIGO_BORDER = "#DDE3FF";

export const Route = createFileRoute("/_auth/selecionar-perfil")({
  head: () => ({
    meta: [{ title: "Escolher perfil — TEAmo" }],
  }),
  component: SelectProfilePage,
});

const ROLE_META: Record<
  Role,
  { icon: typeof Baby; label: string; desc: string; color: string; soft: string; border: string }
> = {
  parent: {
    icon: Baby,
    label: "Responsável",
    desc: "Acompanhe o cuidado da sua família",
    color: INDIGO,
    soft: INDIGO_SOFT,
    border: INDIGO_BORDER,
  },
  therapist: {
    icon: Stethoscope,
    label: "Terapeuta",
    desc: "Acompanhe seus pacientes",
    color: TEAL,
    soft: TEAL_SOFT,
    border: TEAL_BORDER,
  },
};

function SelectProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  const roles = profile ? getUserRoles(profile) : [];

  // Se (por algum motivo) o usuário tem só um papel, não há o que escolher.
  useEffect(() => {
    if (!isLoading && profile && roles.length <= 1) {
      if (roles[0]) setActiveRole(roles[0]);
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, profile, roles, navigate]);

  const choose = (role: Role) => {
    setActiveRole(role);
    navigate({ to: "/dashboard" });
  };

  if (isLoading || !profile) {
    return (
      <AppShell hideMenu>
        <div className="mx-auto max-w-[440px] px-4 py-12 flex justify-center">
          <Loader2 size={28} className="animate-spin" color={TEAL} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-[440px] px-4 py-8">
        <h1 className="text-[24px] font-extrabold text-center text-[#0F172A] leading-tight mb-1">
          Como deseja entrar?
        </h1>
        <p className="text-sm text-center text-[#6B7280] mb-8">
          Sua conta tem mais de um perfil. Escolha com qual quer continuar.
        </p>

        <div className="flex flex-col gap-3">
          {roles.map((role) => {
            const m = ROLE_META[role];
            const Icon = m.icon;
            return (
              <button
                key={role}
                type="button"
                onClick={() => choose(role)}
                className="flex items-center gap-4 rounded-[18px] border-2 p-4 text-left transition-all hover:-translate-y-px"
                style={{ borderColor: m.border, background: m.soft }}
              >
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: "#fff", border: `1px solid ${m.border}` }}
                >
                  <Icon size={24} color={m.color} strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-extrabold leading-tight" style={{ color: m.color }}>
                    {m.label}
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: "#6B7280" }}>
                    {m.desc}
                  </p>
                </div>
                <ChevronRight size={20} color={m.color} strokeWidth={2} className="flex-shrink-0" />
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-[#9CA3AF]">
          Você pode trocar de perfil a qualquer momento pelo menu.
        </p>
      </div>
    </AppShell>
  );
}
