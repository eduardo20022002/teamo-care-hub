import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Info,
  LogOut,
  Pencil,
  Settings,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
} from "@/components/ui/drawer";
import { signOut } from "@/services/auth.service";

interface AccountMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  fullName: string | null;
  email: string | null;
}

interface MenuRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  subtitle?: string;
  onClick: () => void;
}

function MenuRow({ icon, iconBg, label, subtitle, onClick }: MenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${iconBg}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 mt-4 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

export function AccountMenuDrawer({ open, onClose, fullName, email }: AccountMenuDrawerProps) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const initial = (fullName ?? email ?? "U").charAt(0).toUpperCase();

  const go = (to: string) => {
    onClose();
    void navigate({ to });
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    onClose();
    try {
      await signOut("manual");
      toast.success("Você saiu com segurança.");
      void navigate({ to: "/login" });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="bottom">
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-[24px] bg-background px-5 pb-8 pt-0 outline-none">
          {/* Drag handle */}
          <div className="flex justify-center py-3">
            <div className="h-1 w-10 rounded-full bg-border" />
          </div>

          {/* Close button */}
          <div className="flex justify-end">
            <DrawerClose asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
                aria-label="Fechar menu"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </DrawerClose>
          </div>

          {/* User identity */}
          <div className="mt-2 flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: "var(--brand-gradient)" }}
              aria-hidden="true"
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">
                {fullName ?? "Meu perfil"}
              </p>
              <div className="flex items-center gap-1">
                <p className="truncate text-sm text-muted-foreground">{email}</p>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2} />
              </div>
            </div>
          </div>

          {/* Edit profile button */}
          <button
            type="button"
            onClick={() => go("/perfil")}
            className="mt-3 flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            <Pencil className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            Editar perfil
          </button>

          {/* CONTA section */}
          <SectionLabel>Conta</SectionLabel>
          <MenuRow
            icon={<User className="h-5 w-5 text-primary" strokeWidth={1.75} />}
            iconBg="bg-primary/10"
            label="Meu perfil"
            subtitle="Nome, e-mail, telefone"
            onClick={() => go("/perfil")}
          />
          <MenuRow
            icon={<Settings className="h-5 w-5 text-primary" strokeWidth={1.75} />}
            iconBg="bg-primary/10"
            label="Configurações"
            subtitle="Notificações, aparência, segurança"
            onClick={() => go("/configuracoes")}
          />

          {/* SUPORTE section */}
          <SectionLabel>Suporte</SectionLabel>
          <MenuRow
            icon={<HelpCircle className="h-5 w-5 text-accent" strokeWidth={1.75} />}
            iconBg="bg-accent/10"
            label="Ajuda e dúvidas frequentes"
            onClick={() => go("/ajuda")}
          />
          <MenuRow
            icon={<Info className="h-5 w-5 text-accent" strokeWidth={1.75} />}
            iconBg="bg-accent/10"
            label="Sobre o TEAmo"
            onClick={() => go("/sobre")}
          />

          {/* Separator + logout */}
          <div className="my-4 h-px bg-border" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} />
            <span className="text-sm font-semibold">Sair da conta</span>
          </button>

          {/* Footer */}
          <p className="mt-5 text-center text-xs text-muted-foreground">TEAmo · versão 1.0.0</p>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
