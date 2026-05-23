import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby,
  Calendar,
  ClipboardList,
  Compass,
  FolderOpen,
  Heart,
  Plus,
  Search,
  Share2,
  TimerReset,
  Users,
} from "lucide-react";
import { uploadRecordAttachment } from "@/services/attachments.service";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ChildFormSheet } from "@/components/children/ChildFormSheet";
import { ChildDocumentsDialog } from "@/components/attachments/ChildDocumentsDialog";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { AttendanceFormDialog } from "@/components/attendance/AttendanceFormDialog";
import { useAuth } from "@/hooks/useAuth";
import { createChild, listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import { createAttendanceRecord } from "@/services/attendance.service";
import {
  formatAge,
  formatBirthDate,
  formatTodayHero,
  getInitial,
} from "@/lib/formatters";
import type { ChildInput, AttendanceRecordInput } from "@/lib/validation";
import type { Child } from "@/types/database";

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Início — TEAmo" }],
  }),
  component: DashboardPage,
});

const PASTEL_GRADIENT =
  "linear-gradient(140deg, #E5E9FF 0%, #ECE5FE 45%, #FDE8F3 100%)";
const AVATAR_GRADIENT =
  "linear-gradient(135deg, #DDE3FF 0%, #FBD9EC 100%)";
const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.4), 0 3px 8px -3px rgba(236,72,153,0.22)";

const EXPLORE_TILES = [
  {
    to: "/agenda" as const,
    tint: "#F3E8FF",
    color: "#7C3AED",
    icon: Calendar,
    title: "Agenda",
    desc: "Compromissos, terapias e medicações.",
  },
  {
    to: "/profissionais" as const,
    tint: "#EEF1FF",
    color: "#4F46E5",
    icon: Users,
    title: "Profissionais",
    desc: "Médicos, terapeutas e equipe escolar.",
  },
  {
    to: "/registros" as const,
    tint: "#FDF2F8",
    color: "#EC4899",
    icon: ClipboardList,
    title: "Registros",
    desc: "Histórico diário — comportamentos, conquistas e mais.",
  },
  {
    to: "/documentos" as const,
    tint: "#F3E8FF",
    color: "#7C3AED",
    icon: FolderOpen,
    title: "Documentos",
    desc: "Laudos, relatórios e anexos.",
  },
  {
    to: "/compartilhamentos" as const,
    tint: "#FFF4ED",
    color: "#EA7B3D",
    icon: Share2,
    title: "Compartilhamentos",
    desc: "Envie informações / documentos.",
  },
] as const;

const COMING_SOON = [
  {
    icon: TimerReset,
    title: "Linha do tempo",
    description: "Acompanhe a evolução da criança ao longo do tempo.",
  },
] as const;

function getDisplayName(user: ReturnType<typeof useAuth>["user"]): string {
  const meta = user?.user_metadata as { display_name?: string } | undefined;
  if (meta?.display_name && meta.display_name.trim()) {
    return meta.display_name.trim();
  }
  const local = user?.email?.split("@")[0] ?? "";
  if (!local) return "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function SectionHeader({
  tint,
  iconColor,
  icon: Icon,
  title,
  action,
}: {
  tint: string;
  iconColor: string;
  icon: typeof Users;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[9px]"
          style={{ background: tint }}
        >
          <Icon size={18} strokeWidth={1.7} color={iconColor} />
        </div>
        <h2
          className="text-[18px] font-bold"
          style={{ color: "#0F172A", letterSpacing: "-0.015em" }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function ChildRow({
  child,
  onQuickRegister,
  onOpenDocs,
}: {
  child: Child;
  onQuickRegister: (child: Child) => void;
  onOpenDocs: (child: Child) => void;
}) {
  return (
    <div
      className="rounded-[18px] border bg-white p-4.5"
      style={{
        borderColor: "#EEF0F4",
        padding: 18,
        boxShadow:
          "0 1px 2px rgba(15,23,42,0.03), 0 6px 18px rgba(15,23,42,0.04)",
      }}
    >
      <div className="mb-3.5 flex items-center gap-3.5">
        <div
          className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-full text-[24px] font-extrabold"
          style={{
            background: AVATAR_GRADIENT,
            color: "#4F46E5",
            boxShadow:
              "inset 0 0 0 2px rgba(255,255,255,0.7), 0 4px 12px -4px rgba(79,70,229,0.2)",
          }}
        >
          {getInitial(child.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[22px] font-extrabold leading-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
          >
            {child.name}
          </div>
          <div
            className="mt-1 flex items-center gap-2 text-[13px]"
            style={{ color: "#6B7280" }}
          >
            <span>{formatAge(child.birth_date)}</span>
            <span
              className="h-[3px] w-[3px] rounded-full"
              style={{ background: "#D1D5DB" }}
            />
            <span>{formatBirthDate(child.birth_date)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => onQuickRegister(child)}
          className="flex h-[46px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold text-white transition-all hover:-translate-y-px"
          style={{
            background: BRAND_GRADIENT,
            boxShadow: BRAND_SHADOW,
            letterSpacing: "-0.005em",
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
          Registrar
        </button>
        <button
          type="button"
          onClick={() => onOpenDocs(child)}
          aria-label={`Documentos de ${child.name}`}
          className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[#E5E7EB]"
          style={{ background: "#F4F5FA" }}
        >
          <FolderOpen size={20} strokeWidth={1.7} color="#4F46E5" />
        </button>
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [childDialogOpen, setChildDialogOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [quickChildId, setQuickChildId] = useState<string | undefined>();
  const [docsChild, setDocsChild] = useState<Child | null>(null);

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
    mutationFn: async (vars: {
      input: AttendanceRecordInput;
      pendingFiles?: File[];
    }) => {
      const record = await createAttendanceRecord(user!.id, vars.input);
      const files = vars.pendingFiles ?? [];
      let success = 0;
      const failed: string[] = [];
      for (const file of files) {
        try {
          await uploadRecordAttachment(user!.id, record.id, file);
          success++;
        } catch (e) {
          failed.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      return { record, attachmentSuccess: success, attachmentFailed: failed };
    },
    onSuccess: ({ attachmentSuccess, attachmentFailed }) => {
      toast.success("Registro criado.");
      if (attachmentSuccess > 0) {
        toast.success(
          attachmentSuccess === 1
            ? "Anexo enviado."
            : `${attachmentSuccess} anexos enviados.`,
        );
      }
      for (const msg of attachmentFailed) toast.error(msg);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["documents-all"] });
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

  const displayName = getDisplayName(user);
  const handleQuickRegister = (child: Child) => {
    setQuickChildId(child.id);
    setAttendanceOpen(true);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* HERO pastel */}
        <section
          className="relative overflow-hidden rounded-[22px] px-[22px] pb-[26px] pt-6"
          style={{ background: PASTEL_GRADIENT }}
        >
          <svg
            viewBox="0 0 300 300"
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{ top: "-45%", right: "-30%", width: "85%", opacity: 0.5 }}
          >
            <defs>
              <radialGradient id="dash-blob" cx="50%" cy="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="150" cy="150" r="140" fill="url(#dash-blob)" />
          </svg>
          <div className="relative">
            <div
              className="text-[12.5px] font-semibold"
              style={{ color: "#6B7280" }}
            >
              {formatTodayHero()}
            </div>
            <h1
              className="mt-2 text-[26px] font-extrabold leading-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
            >
              Olá{displayName ? `, ${displayName}` : ""}
            </h1>
            <p
              className="mt-1.5 text-sm leading-relaxed"
              style={{ color: "#4B5563" }}
            >
              Aqui você acompanha o cuidado da sua família.
            </p>

            <button
              type="button"
              onClick={() => navigate({ to: "/busca" })}
              className="mt-[18px] flex w-full items-center gap-2.5 rounded-xl bg-white px-3.5 py-[11px] text-left transition-shadow hover:shadow-md"
              style={{
                border: "1px solid rgba(79,70,229,0.12)",
                boxShadow: "0 6px 18px -8px rgba(79,70,229,0.18)",
              }}
            >
              <Search size={20} strokeWidth={1.8} color="#4F46E5" />
              <span className="flex-1 text-sm" style={{ color: "#9CA3AF" }}>
                Buscar no histórico…
              </span>
            </button>
          </div>
        </section>

        {/* CRIANÇAS CADASTRADAS */}
        <div className="mt-7">
          <SectionHeader
            tint="#EEF1FF"
            iconColor="#4F46E5"
            icon={Baby}
            title="Crianças cadastradas"
            action={
              <button
                type="button"
                onClick={() => setChildDialogOpen(true)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors hover:bg-[#DDE3FF]"
                style={{ background: "#EEF1FF", color: "#4F46E5" }}
              >
                <Plus size={13} strokeWidth={2.5} />
                Adicionar
              </button>
            }
          />
          <div className="flex flex-col gap-3">
            {(children ?? []).map((c) => (
              <ChildRow
                key={c.id}
                child={c}
                onQuickRegister={handleQuickRegister}
                onOpenDocs={(child) => setDocsChild(child)}
              />
            ))}
          </div>
        </div>

        {/* EXPLORAR */}
        <div className="mt-7">
          <SectionHeader
            tint="#F3E8FF"
            iconColor="#7C3AED"
            icon={Compass}
            title="Explorar"
          />
          <div className="grid grid-cols-2 gap-3">
            {EXPLORE_TILES.map(({ to, tint, color, icon: Icon, title, desc }) => (
              <button
                key={title}
                type="button"
                onClick={() => navigate({ to })}
                className="flex flex-col gap-3 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md"
                style={{
                  borderColor: "#EEF0F4",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
                }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: tint }}
                >
                  <Icon size={20} strokeWidth={1.7} color={color} />
                </div>
                <div>
                  <div
                    className="mb-1 text-[15px] font-bold"
                    style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
                  >
                    {title}
                  </div>
                  <div
                    className="text-[12.5px] leading-snug"
                    style={{ color: "#6B7280" }}
                  >
                    {desc}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* EM BREVE NO TEAMO */}
        <div className="mt-7">
          <SectionHeader
            tint="#FDF2F8"
            iconColor="#EC4899"
            icon={Heart}
            title="Em breve no TEAmo"
          />
          <div className="flex flex-col gap-3">
            {COMING_SOON.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-3.5 rounded-2xl border bg-white p-4"
                style={{ borderColor: "#EEF0F4" }}
              >
                <div
                  className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-[11px]"
                  style={{ background: "#F4F5FA" }}
                >
                  <Icon size={20} strokeWidth={1.7} color="#7C3AED" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <div
                      className="text-[15px] font-bold"
                      style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
                    >
                      {title}
                    </div>
                    <span
                      className="flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.02em]"
                      style={{
                        color: "#EC4899",
                        background: "#FDF2F8",
                        border: "1px solid #FBCFE8",
                      }}
                    >
                      Em breve
                    </span>
                  </div>
                  <div
                    className="text-[13px] leading-snug"
                    style={{ color: "#6B7280" }}
                  >
                    {description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-8" />
      </div>

      <ChildFormSheet
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
        onSubmit={async (data, pendingFiles) => {
          await createAttendanceMutation.mutateAsync({ input: data, pendingFiles });
        }}
        submitting={createAttendanceMutation.isPending}
        childrenList={children ?? []}
        professionals={professionalsQuery.data ?? []}
        defaultChildId={quickChildId}
      />

      <ChildDocumentsDialog
        open={!!docsChild}
        onOpenChange={(o) => !o && setDocsChild(null)}
        child={docsChild ?? ({ id: "", name: "" } as Child)}
      />
    </AppShell>
  );
}
