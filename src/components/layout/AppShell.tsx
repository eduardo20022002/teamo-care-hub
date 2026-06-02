import { useNavigate } from "@tanstack/react-router";
import { Bell, Heart, Menu, Stethoscope } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotificationsDrawer } from "@/components/agenda/NotificationsDrawer";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { useAgendaNotifications } from "@/hooks/useAgendaNotifications";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "./BrandLogo";
import { AccountMenuDrawer } from "./AccountMenuDrawer";
import { initWebVitals } from "@/lib/analytics";

// ─── Constantes de identidade visual por área ─────────────────────────────────
const ROLE_THEME = {
  therapist: {
    accent:      "#0D9488",
    headerBg:    "#FAFFFE",
    headerBorder:"#CCFBF1",
    pillBg:      "#F0FDFA",
    pillText:    "#0D9488",
    label:       "Área do Terapeuta",
  },
  parent: {
    accent:      "#4F46E5",
    headerBg:    "#FAFAFF",
    headerBorder:"#E0E7FF",
    pillBg:      "#EEF1FF",
    pillText:    "#4F46E5",
    label:       "Área do Responsável",
  },
} as const;

export function AppShell({ children, hideMenu }: { children: ReactNode; hideMenu?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Inicializa coleta de Web Vitals uma vez por sessão (idempotente)
  if (typeof window !== "undefined") initWebVitals();
  const notifications = useAgendaNotifications();
  const hasUnread = notifications.length > 0;

  const { data: profile } = useQuery({
    queryKey: ["profile-shell", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, is_admin, user_type")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: firstChild } = useQuery({
    queryKey: ["first-child-shell", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("children")
        .select("id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const userType = (profile?.user_type ?? "parent") as "parent" | "therapist";
  const isTherapist = userType === "therapist";
  const theme = ROLE_THEME[userType];

  return (
    <div className="min-h-screen bg-background">
      {/* Barra de acento — 3 px no topo absoluto da tela, diferencia a área visualmente */}
      {!hideMenu && user && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] h-[3px]"
          style={{ background: theme.accent }}
        />
      )}

      <header
        className="sticky top-0 z-30 border-b backdrop-blur transition-colors"
        style={
          !hideMenu && user
            ? { background: theme.headerBg, borderColor: theme.headerBorder, top: "3px" }
            : { background: "hsl(var(--card) / 0.95)", borderColor: "hsl(var(--border))" }
        }
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <BrandLogo className="text-2xl" />

            {/* Role pill — visível apenas quando autenticado e não em páginas de onboarding */}
            {!hideMenu && user && (
              <span
                className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{ background: theme.pillBg, color: theme.pillText }}
              >
                {isTherapist
                  ? <Stethoscope size={12} strokeWidth={2} />
                  : <Heart size={12} strokeWidth={2} />
                }
                {theme.label}
              </span>
            )}
          </div>

          {!hideMenu && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Notificações"
                onClick={() => setNotifOpen(true)}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-foreground transition-colors hover:bg-muted"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.7} />
                {hasUnread && (
                  <span
                    className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#EC4899]"
                    style={{ boxShadow: "0 0 0 2px white" }}
                  />
                )}
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Menu"
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              </Button>
              <AccountMenuDrawer
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                fullName={profile?.full_name ?? null}
                email={user?.email ?? null}
                isAdmin={profile?.is_admin ?? false}
                firstChildId={firstChild?.id ?? null}
              />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">{children}</main>

      <NotificationsDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notifications.map((n) => ({
          ...n,
          onCta: n.deepLink
            ? () => { navigate({ to: n.deepLink }); }
            : undefined,
        }))}
      />

      {/* Botão de feedback — oculto em páginas de onboarding (hideMenu) */}
      {!hideMenu && <FeedbackButton />}
    </div>
  );
}
