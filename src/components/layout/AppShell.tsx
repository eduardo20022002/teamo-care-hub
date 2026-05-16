import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, Share2, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOut } from "@/services/auth.service";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "./BrandLogo";

export function AppShell({ children, hideMenu }: { children: ReactNode; hideMenu?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut("manual");
      toast.success("Você saiu com segurança.");
      navigate({ to: "/login" });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <BrandLogo className="text-2xl" />
          {!hideMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="h-5 w-5" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user?.email && (
                  <>
                    <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem asChild className="text-foreground">
                  <Link to="/compartilhamentos">
                    <Share2 className="mr-2 h-4 w-4" strokeWidth={1.75} />
                    Compartilhamentos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-foreground">
                  <Link to="/seguranca">
                    <ShieldCheck className="mr-2 h-4 w-4" strokeWidth={1.75} />
                    Segurança
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="text-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" strokeWidth={1.75} />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-10">{children}</main>
    </div>
  );
}
