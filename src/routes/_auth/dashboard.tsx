import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby,
  CalendarDays,
  ClipboardList,
  Heart,
  Plus,
  Share2,
  TimerReset,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ChildCard } from "@/components/children/ChildCard";
import { ChildFormDialog } from "@/components/children/ChildFormDialog";
import { ComingSoonCard } from "@/components/common/ComingSoonCard";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { createChild, listChildren } from "@/services/children.service";
import type { ChildInput } from "@/lib/validation";

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Início — TEAmo" }],
  }),
  component: DashboardPage,
});

const COMING_SOON = [
  {
    icon: ClipboardList,
    title: "Registros de atendimento",
    description: "Anote o que aconteceu em cada consulta ou terapia.",
  },
  {
    icon: CalendarDays,
    title: "Agenda de compromissos",
    description: "Gerencie horários e nunca perca um atendimento.",
  },
  {
    icon: Share2,
    title: "Compartilhamento com profissionais",
    description: "Envie informações de forma segura e por tempo limitado.",
  },
  {
    icon: TimerReset,
    title: "Linha do tempo",
    description: "Acompanhe a evolução da criança ao longo do tempo.",
  },
] as const;

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: children, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  // Garante o passo de onboarding obrigatório
  useEffect(() => {
    if (!isLoading && children && children.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, children, navigate]);

  const createMutation = useMutation({
    mutationFn: (input: ChildInput) => createChild(user!.id, input),
    onSuccess: () => {
      toast.success("Criança cadastrada.");
      qc.invalidateQueries({ queryKey: ["children"] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível cadastrar."),
  });

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const greetingName = user?.email ? user.email.split("@")[0] : "";

  return (
    <AppShell>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
          Olá{greetingName ? `, ${greetingName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aqui você acompanha o cuidado da sua família.
        </p>
      </header>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Baby className="h-5 w-5 text-primary" strokeWidth={1.75} />
            Crianças cadastradas
          </h2>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Adicionar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {(children ?? []).map((c) => (
            <ChildCard key={c.id} child={c} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
          Acessos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            to="/profissionais"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Users className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Rede de profissionais
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre médicos, terapeutas e profissionais escolares.
            </p>
            <span className="mt-3 inline-block text-xs font-medium text-primary group-hover:underline">
              Acessar →
            </span>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Heart className="h-5 w-5 text-accent" strokeWidth={1.75} />
          Em breve no TEAmo
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON.map((c) => (
            <ComingSoonCard key={c.title} {...c} />
          ))}
        </div>
      </section>

      <ChildFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        submitting={createMutation.isPending}
      />
    </AppShell>
  );
}
