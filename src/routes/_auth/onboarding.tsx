import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Baby, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChildCard } from "@/components/children/ChildCard";
import { ChildFormDialog } from "@/components/children/ChildFormDialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { createChild, deleteChild, listChildren } from "@/services/children.service";
import type { Child } from "@/types/database";
import type { ChildInput } from "@/lib/validation";

export const Route = createFileRoute("/_auth/onboarding")({
  head: () => ({
    meta: [{ title: "Cadastrar criança — TEAmo" }],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: children, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (input: ChildInput) => createChild(user!.id, input),
    onSuccess: () => {
      toast.success("Criança cadastrada.");
      qc.invalidateQueries({ queryKey: ["children"] });
      setDialogOpen(false);
    },
    onError: (e: Error) =>
      toast.error(e.message || "Não foi possível cadastrar agora."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteChild(id),
    onSuccess: () => {
      toast.success("Criança removida.");
      qc.invalidateQueries({ queryKey: ["children"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao remover."),
  });

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const hasChildren = (children?.length ?? 0) > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Baby className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">
                Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}!
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vamos começar cadastrando a(s) criança(s) sob seus cuidados.
              </p>
            </div>
          </div>

          {hasChildren && (
            <ul className="mt-6 space-y-2">
              {children!.map((child: Child) => (
                <li key={child.id}>
                  <ChildCard
                    child={child}
                    variant="row"
                    onDelete={() => deleteMutation.mutate(child.id)}
                  />
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-4 py-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {hasChildren ? "Adicionar outra criança" : "Adicionar criança"}
          </button>

          {hasChildren && (
            <Button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="mt-6 h-12 w-full bg-success text-success-foreground hover:bg-success/90"
            >
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
            </Button>
          )}
        </section>
      </div>

      <ChildFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        submitting={createMutation.isPending}
      />

      {createMutation.isPending && (
        <div className="sr-only">
          <Loader2 />
        </div>
      )}
    </AppShell>
  );
}
