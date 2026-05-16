import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, ClipboardList, FolderOpen, Users, Baby } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChildCard } from "@/components/children/ChildCard";
import { ChildFormSheet } from "@/components/children/ChildFormSheet";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useAuth } from "@/hooks/useAuth";
import { createChild, deleteChild, listChildren } from "@/services/children.service";
import type { Child } from "@/types/database";
import type { ChildInput } from "@/lib/validation";

const PASTEL_GRADIENT =
  "linear-gradient(140deg, #E5E9FF 0%, #ECE5FE 45%, #FDE8F3 100%)";
const AVATAR_GRADIENT =
  "linear-gradient(135deg, #DDE3FF 0%, #FBD9EC 100%)";
const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

export const Route = createFileRoute("/_auth/onboarding")({
  head: () => ({
    meta: [{ title: "Cadastrar criança — TEAmo" }],
  }),
  component: OnboardingPage,
});

function getDisplayName(user: ReturnType<typeof useAuth>["user"]): string {
  const meta = user?.user_metadata as { display_name?: string } | undefined;
  if (meta?.display_name && meta.display_name.trim()) {
    return meta.display_name.trim();
  }
  const local = user?.email?.split("@")[0] ?? "";
  if (!local) return "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const PREVIEW_FEATURES = [
  {
    icon: ClipboardList,
    title: "Registros",
    desc: "Acompanhe o histórico completo com filtros por data, profissional ou tipo.",
    tint: "#FDF2F8",
    color: "#EC4899",
  },
  {
    icon: FolderOpen,
    title: "Documentos",
    desc: "Armazene e consulte documentos clínicos com facilidade.",
    tint: "#F3E8FF",
    color: "#7C3AED",
  },
  {
    icon: Users,
    title: "Profissionais",
    desc: "Gerencie médicos, terapeutas e equipe escolar em um só lugar.",
    tint: "#EEF1FF",
    color: "#4F46E5",
  },
] as const;


function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

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
      setSheetOpen(false);
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
  const displayName = getDisplayName(user);

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-2xl">
        {/* HERO pastel */}
        <section
          className="relative overflow-hidden rounded-[22px] px-6 py-5"
          style={{ background: PASTEL_GRADIENT }}
        >
          <svg
            viewBox="0 0 300 300"
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ top: "-45%", right: "-30%", width: "85%", opacity: 0.5 }}
          >
            <defs>
              <radialGradient id="hero-blob" cx="50%" cy="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="150" cy="150" r="140" fill="url(#hero-blob)" />
          </svg>
          <div className="relative">
            <h1
              className="text-[26px] font-extrabold leading-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
            >
              Olá{displayName ? `, ${displayName}` : ""}
            </h1>
            <p
              className="mt-1.5 text-sm leading-relaxed"
              style={{ color: "#4B5563" }}
            >
              {hasChildren
                ? "Tudo pronto. Você pode adicionar outra criança ou continuar."
                : "Pra começar, cadastre a primeira criança que está sob seus cuidados."}
            </p>
          </div>
        </section>

        {/* Quando há crianças, lista normal */}
        {hasChildren ? (
          <>
            <ul className="mt-5 space-y-2">
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

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary-soft/40 px-4 py-4 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Adicionar outra criança
            </button>

            <Button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="mt-5 h-12 w-full bg-success text-success-foreground hover:bg-success/90"
            >
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" strokeWidth={2} />
            </Button>
          </>
        ) : (
          <>
            {/* CARD CTA principal (empty state) */}
            <section
              className="mt-5 rounded-[18px] border bg-white px-6 py-7 text-center"
              style={{
                borderColor: "#EEF0F4",
                boxShadow:
                  "0 1px 2px rgba(15,23,42,0.03), 0 6px 18px rgba(15,23,42,0.04)",
              }}
            >
              <div
                className="mx-auto mb-4 inline-flex h-[76px] w-[76px] items-center justify-center rounded-full"
                style={{
                  background: AVATAR_GRADIENT,
                  boxShadow:
                    "inset 0 0 0 2px rgba(255,255,255,0.7), 0 6px 16px -6px rgba(79,70,229,0.25)",
                }}
              >
                <Baby size={36} strokeWidth={1.5} color="#4F46E5" />
              </div>

              <h2
                className="mb-1.5 text-[19px] font-extrabold"
                style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
              >
                Cadastre sua primeira criança
              </h2>
              <p
                className="mx-auto mb-5 text-[13.5px] leading-snug"
                style={{ color: "#6B7280", maxWidth: 280 }}
              >
                Cada criança tem seu próprio espaço — registros, profissionais
                e documentos organizados por perfil.
              </p>

              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-bold text-white transition-all hover:-translate-y-px"
                style={{
                  background: BRAND_GRADIENT,
                  boxShadow: BRAND_SHADOW,
                  letterSpacing: "-0.005em",
                }}
              >
                <Plus className="h-[17px] w-[17px]" strokeWidth={2.2} />
                Adicionar criança
              </button>

              <div className="mt-3 text-xs" style={{ color: "#9CA3AF" }}>
                Você pode adicionar mais de uma depois.
              </div>
            </section>

            {/* PREVIEW — o que você poderá fazer */}
            <div className="mt-7 mb-2.5 px-1">
              <div
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ color: "#9CA3AF" }}
              >
                O que você poderá fazer
              </div>
            </div>

            <div className="flex flex-col gap-2 opacity-[0.85]">
              {PREVIEW_FEATURES.map(({ icon: Icon, title, desc, tint, color }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-[14px] border bg-white px-3.5 py-3"
                  style={{ borderColor: "#EEF0F4" }}
                >
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: tint }}
                  >
                    <Icon size={18} strokeWidth={1.6} color={color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-bold"
                      style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
                    >
                      {title}
                    </div>
                    <div
                      className="mt-0.5 text-xs leading-snug"
                      style={{ color: "#6B7280" }}
                    >
                      {desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ChildFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        submitting={createMutation.isPending}
      />
    </AppShell>
  );
}
