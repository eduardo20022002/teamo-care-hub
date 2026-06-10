import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronDown, Building2, LogOut, Settings, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getProfile } from "@/services/profile.service";
import { getMyClinicServer } from "@/lib/clinic.functions";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { signOut } from "@/services/auth.service";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

const HEADER_GRADIENT = "linear-gradient(to right, #4F46E5, #7C3AED, #EC4899)";

export const Route = createFileRoute("/_auth/clinica")({
  head: () => ({
    meta: [{ title: "Clínica — TEAmo" }],
  }),
  component: ClinicLayout,
});

const NAV_ITEMS = [
  { label: "Home",         to: "/clinica"          as const },
  { label: "Fila de Espera", to: "/clinica/fila"   as const },
  { label: "Avaliações",   to: "/clinica/avaliacoes" as const },
  { label: "Agenda",       to: "/clinica/agenda"   as const },
  { label: "Financeiro",   to: "/clinica/financeiro" as const },
  { label: "Grupos",       to: "/clinica/grupos"   as const },
] as const;

// Nav items disabled until their respective phases are implemented
const DISABLED_ITEMS = new Set<string>([]);

function ClinicLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const getClinic = useServerFn(getMyClinicServer);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  const clinicQuery = useQuery({
    queryKey: ["myClinic"],
    queryFn: () => getClinic({}),
    enabled: !!user,
    staleTime: 30_000,
  });

  // Guard: not a clinic coordinator → redirect to dashboard
  useEffect(() => {
    if (loading || profileQuery.isLoading) return;
    if (profileQuery.data && profileQuery.data.user_type !== "clinic_coordinator") {
      navigate({ to: "/dashboard" });
    }
  }, [loading, profileQuery.isLoading, profileQuery.data, navigate]);

  // Guard: coordinator without clinic → redirect to onboarding
  useEffect(() => {
    if (clinicQuery.isLoading || clinicQuery.data === undefined) return;
    const currentPath = routerState.location.pathname;
    if (!clinicQuery.data.clinic && currentPath !== "/clinica/onboarding") {
      navigate({ to: "/clinica/onboarding" });
    }
  }, [clinicQuery.isLoading, clinicQuery.data, routerState.location.pathname, navigate]);

  if (loading || profileQuery.isLoading) {
    return <LoadingSpinner label="Carregando clínica..." />;
  }

  if (profileQuery.data?.user_type !== "clinic_coordinator") {
    return null;
  }

  const displayName = (() => {
    const meta = user?.user_metadata as { display_name?: string } | undefined;
    if (meta?.display_name?.trim()) return meta.display_name.trim();
    return profileQuery.data?.full_name ?? user?.email?.split("@")[0] ?? "Coordenador";
  })();

  const clinicName = clinicQuery.data?.clinic?.name ?? "Minha Clínica";
  const initials = displayName.slice(0, 2).toUpperCase();
  const currentPath = routerState.location.pathname;

  const handleSignOut = async () => {
    await signOut("manual");
    toast.success("Sessão encerrada.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen" style={{ background: "#F6F7FB" }}>
      {/* Fixed gradient header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 gap-4"
        style={{ height: 56, background: HEADER_GRADIENT }}
      >
        {/* Logo + label */}
        <Link to="/clinica" className="flex items-center gap-2 shrink-0">
          <span className="text-white font-extrabold text-lg tracking-tight">TEAmo</span>
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.9)" }}
          >
            Clínica
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 mx-4">
          {NAV_ITEMS.map(({ label, to }) => {
            const isActive = to === "/clinica" ? currentPath === "/clinica" : currentPath.startsWith(to);
            const isDisabled = DISABLED_ITEMS.has(label);
            return (
              <Link
                key={to}
                to={to}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  isDisabled ? "opacity-40 pointer-events-none" : "",
                  isActive
                    ? "bg-white/20 text-white"
                    : "text-white/80 hover:text-white hover:bg-white/10",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: bell + avatar */}
        <div className="flex items-center gap-3">
          {/* Notification bell — placeholder */}
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/20 transition-colors"
            aria-label="Notificações"
          >
            <Bell size={18} color="white" />
          </button>

          {/* Avatar dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/20 transition-colors"
            >
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                {initials}
              </div>
              <span className="text-white text-sm font-medium hidden md:block">{displayName}</span>
              <ChevronDown size={14} color="rgba(255,255,255,0.8)" />
            </button>

            {avatarMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setAvatarMenuOpen(false)}
                />
                {/* Menu */}
                <div
                  className="absolute right-0 top-10 z-20 w-56 rounded-xl bg-white py-1 shadow-xl"
                  style={{ border: "0.5px solid #E5E7EB" }}
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{clinicName}</p>
                  </div>
                  <Link
                    to="/clinica/equipe"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Users size={15} className="text-gray-400" />
                    Equipe
                  </Link>
                  <Link
                    to="/clinica/configuracoes"
                    onClick={() => setAvatarMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} className="text-gray-400" />
                    Configurações
                  </Link>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} />
                      Sair
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content with top offset for fixed header */}
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  );
}
