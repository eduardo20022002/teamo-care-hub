import { useNavigate } from "@tanstack/react-router";
import { Bell, Menu } from "lucide-react";
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
        .select("full_name, is_admin")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <BrandLogo className="text-2xl" />
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
            ? () => {
                navigate({ to: n.deepLink });
              }
            : undefined,
        }))}
      />

      {/* Botão de feedback — oculto em páginas de onboarding (hideMenu) */}
      {!hideMenu && <FeedbackButton />}
    </div>
  );
}
