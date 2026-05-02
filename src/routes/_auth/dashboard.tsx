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
import { AttendanceFormDialog } from "@/components/attendance/AttendanceFormDialog";
import { useAuth } from "@/hooks/useAuth";
import { createChild, listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import { createAttendanceRecord } from "@/services/attendance.service";
import type { ChildInput, AttendanceRecordInput } from "@/lib/validation";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Início — TEAmo" }],
  }),
  component: DashboardPage,
});

const COMING_SOON = [
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
  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [quickChildId, setQuickChildId] = useState<string | undefined>();

  const { data: children, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });

  // Garante o passo de onboarding obrigatório
  useEffect(() => {
    if (!isLoading && children && children.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [isLoading, children, navigate]);

  const createChildMutation = useMutation({
    mutationFn: (input: ChildInput) => createChild(user!.id, input),
    onSuccess: () => {
      toast.success("Criança cadastrada.");
      qc.invalidateQueries({ queryKey: ["children"] });
      setChildDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível cadastrar."),
  });

  const createAttendanceMutation = useMutation({
    mutationFn: (input: AttendanceRecordInput) =>
      createAttendanceRecord(user!.id, input),
    onSuccess: () => {
      toast.success("Registro criado.");
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setAttendanceOpen(false);
      setQuickChildId(undefined);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const greetingName = user?.email ? user.email.split("@")[0] : "";

  const handleQuickRegister = (child: Child) => {
    setQuickChildId(child.id);
    setAttendanceOpen(true);
  };

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
            onClick={() => setChildDialogOpen(true)}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Adicionar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {(children ?? []).map((c) => (
            <ChildCard
              key={c.id}
              child={c}
              onQuickRegister={handleQuickRegister}
            />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
          <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
          Acessos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/profissionais"
            className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Users className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-semibold leading-tight text-foreground">
              Profissionais
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Médicos, terapeutas e equipe escolar.
            </p>
          </Link>

          <Link
            to="/registros"
            className="group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm font-semibold leading-tight text-foreground">
              Registros
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Orientações, observações e evoluções.
            </p>
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
        open={childDialogOpen}
        onOpenChange={setChildDialogOpen}
        onSubmit={async (data) => {
          await createChildMutation.mutateAsync(data);
        }}
        submitting={createChildMutation.isPending}
      />

      <AttendanceFormDialog
        open={attendanceOpen}
        onOpenChange={(o) => {
          setAttendanceOpen(o);
          if (!o) setQuickChildId(undefined);
        }}
        onSubmit={async (data) => {
          await createAttendanceMutation.mutateAsync(data);
        }}
        submitting={createAttendanceMutation.isPending}
        childrenList={children ?? []}
        professionals={professionalsQuery.data ?? []}
        defaultChildId={quickChildId}
      />
    </AppShell>
  );
}
