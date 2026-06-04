import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  Stethoscope,
  TimerReset,
  TrendingUp,
  Users,
  HandHeart,
  ShieldAlert,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { uploadRecordAttachment } from "@/services/attachments.service";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ChildFormSheet } from "@/components/children/ChildFormSheet";
import { ChildDocumentsDialog } from "@/components/attachments/ChildDocumentsDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceFormDialog } from "@/components/attendance/AttendanceFormDialog";
import { useAuth } from "@/hooks/useAuth";
import { createChild, listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import { createAttendanceRecord } from "@/services/attendance.service";
import { getProfile } from "@/services/profile.service";
import { usePatients, useMyTherapistAccesses } from "@/services/therapist.service";
import { getRole } from "@/lib/roles";
import {
  formatAge,
  formatBirthDate,
  formatTodayHero,
  getInitial,
} from "@/lib/formatters";
import type { ChildInput, AttendanceRecordInput } from "@/lib/validation";
import type { Child } from "@/types/database";
import { track } from "@/lib/analytics";
import { listMyCareAccessServer } from "@/lib/care-sharing.functions";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({
    meta: [{ title: "Início — TEAmo" }],
  }),
  component: DashboardPage,
});

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-5 p-4">
      {/* Hero card — simula saudação + avatar de filho */}
      <div className="rounded-[22px] p-5 flex items-center gap-4 bg-muted/40">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {/* Grid de ações rápidas (4 tiles) */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border p-4 flex flex-col gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      {/* Seção de profissionais */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}

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

const TEAL_CARE = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

// ─── SharedChildCard (co-cuidador) ────────────────────────────────────────────

function SharedChildCard({
  access,
  onNavigate,
}: {
  access: { id: string; child: { id: string; name: string; birth_date: string }; owner: any; role: "admin" | "viewer"; alias: string };
  onNavigate: (childId: string) => void;
}) {
  const child = access.child;
  const ownerName = access.owner?.raw_user_meta_data?.display_name ||
    access.owner?.email?.split("@")[0] || "Responsável";

  return (
    <div
      className="relative overflow-hidden rounded-[18px] border p-4"
      style={{ borderColor: "#CCFBF1", background: "linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)", boxShadow: "0 2px 8px rgba(13,148,136,0.08)" }}
    >
      {/* Ribbon compartilhado */}
      <div
        className="absolute right-0 top-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ background: TEAL_CARE, color: "#fff", borderRadius: "0 18px 0 12px" }}
      >
        Compartilhado
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full font-bold text-xl flex-shrink-0"
          style={{ background: "#CCFBF1", color: TEAL_CARE }}
        >
          {child.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-[#0F172A] text-[16px]">{child.name}</p>
          {child.birth_date && (
            <p className="text-xs text-[#6B7280]">{formatAge(child.birth_date)}</p>
          )}
          <p className="text-xs text-[#6B7280] mt-0.5">Responsável: {ownerName}</p>
        </div>
      </div>

      {/* Banner de acesso */}
      <div
        className="rounded-lg px-3 py-2 mb-3 text-xs leading-relaxed"
        style={{ background: "rgba(13,148,136,0.08)", color: "#0F766E" }}
      >
        {access.role === "admin"
          ? "Acesso de administrador: registros, agenda, documentos e profissionais."
          : "Acesso de visualizador: registros, agenda e profissionais (sem documentos clínicos)."}
      </div>

      {/* Atalhos */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onNavigate(access.child.id)}
          className="flex-1 h-9 rounded-lg text-xs font-bold text-white flex items-center justify-center"
          style={{ background: TEAL_CARE }}
        >
          Ver registros
        </button>
        <button
          type="button"
          onClick={() => onNavigate(access.child.id)}
          className="flex-1 h-9 rounded-lg text-xs font-semibold border flex items-center justify-center"
          style={{ borderColor: TEAL_CARE, color: TEAL_CARE }}
        >
          Agenda
        </button>
      </div>
    </div>
  );
}

// ─── AccessRevokedOverlay (Tela 13) ──────────────────────────────────────────

function AccessRevokedOverlay({ childName, onDismiss }: { childName: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.7)" }}>
      <div className="bg-white rounded-2xl p-6 max-w-[360px] w-full text-center shadow-2xl">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "#FEF2F2" }}
        >
          <ShieldAlert size={28} color="#DC2626" strokeWidth={1.7} />
        </div>
        <h2 className="text-[18px] font-bold text-[#0F172A] mb-2">Acesso removido</h2>
        <p className="text-sm text-[#6B7280] mb-5 leading-relaxed">
          Você não tem mais acesso ao perfil de <strong>{childName}</strong>. Entre em contato com o responsável para mais informações.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full h-11 rounded-xl text-white text-[14px] font-bold"
          style={{ background: "#DC2626" }}
        >
          Voltar ao início
        </button>
      </div>
    </div>
  );
}

// ─── PatientCard (terapeuta) ──────────────────────────────────────────────────

function PatientCard({
  patient,
  onOpen,
}: {
  patient: Child;
  onOpen: (patientId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(patient.id)}
      className="flex items-center gap-3.5 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md w-full"
      style={{
        borderColor: TEAL_BORDER,
        background: "linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)",
        boxShadow: "0 1px 2px rgba(13,148,136,0.04), 0 4px 12px rgba(13,148,136,0.06)",
      }}
    >
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold"
        style={{ background: TEAL_BORDER, color: TEAL_CARE }}
      >
        {getInitial(patient.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[16px] font-bold leading-tight"
          style={{ color: "#0F172A", letterSpacing: "-0.015em" }}
        >
          {patient.name}
        </div>
        <div className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>
          {formatAge(patient.birth_date)} · {formatBirthDate(patient.birth_date)}
        </div>
      </div>
      <ChevronRight size={18} strokeWidth={1.8} color={TEAL_CARE} className="flex-shrink-0" />
    </button>
  );
}

// ─── TherapistAccessCard (pai com acesso via terapeuta) ───────────────────────

function TherapistAccessCard({
  access,
}: {
  access: {
    id: string;
    child: { id: string; name: string; birth_date: string } | null;
    therapistName: string;
    therapistSpecialty: string;
  };
}) {
  const navigate = useNavigate();
  const child = access.child;
  if (!child) return null;

  return (
    <button
      type="button"
      onClick={() => navigate({ to: "/meu-terapeuta/$accessId" as any, params: { accessId: access.id } as any })}
      className="w-full rounded-[18px] border p-4 text-left transition-all hover:shadow-md active:scale-[0.99]"
      style={{
        borderColor: TEAL_BORDER,
        background: "linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)",
        boxShadow: "0 2px 8px rgba(13,148,136,0.08)",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full font-bold text-[18px] flex-shrink-0"
          style={{ background: TEAL_BORDER, color: TEAL_CARE }}
        >
          {child.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[#0F172A] text-[16px] leading-tight">{child.name}</p>
          {child.birth_date && (
            <p className="text-xs text-[#6B7280] mt-0.5">{formatAge(child.birth_date)}</p>
          )}
        </div>
        <ChevronRight size={16} strokeWidth={2} color="#9CA3AF" className="flex-shrink-0" />
      </div>
      <div
        className="rounded-lg px-3 py-2 text-xs leading-relaxed"
        style={{ background: "rgba(13,148,136,0.08)", color: "#0F766E" }}
      >
        <span className="font-semibold">{access.therapistName}</span>
        {access.therapistSpecialty ? ` · ${access.therapistSpecialty}` : ""}
        {" — toque para ver o acompanhamento"}
      </div>
    </button>
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
  const [revokedAccess, setRevokedAccess] = useState<{ childName: string } | null>(null);
  const realtimeRef = useRef<ReturnType<typeof supabaseClient.channel> | null>(null);

  // ─── Perfil do usuário (determina terapeuta vs responsável) ──────────────────
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  // Papel do usuário — sempre user_type (1 e-mail = 1 perfil)
  const isTherapist = profileQuery.data
    ? getRole(profileQuery.data) === "therapist"
    : false;

  // ─── Dados do terapeuta ───────────────────────────────────────────────────────
  const { data: patientsData, isLoading: patientsLoading } = usePatients();
  const patients = (patientsData?.patients ?? []) as Child[];

  // ─── Dados do responsável: acessos via terapeuta ──────────────────────────────
  const { data: therapistAccessData } = useMyTherapistAccesses();
  const therapistAccesses = (therapistAccessData?.accesses ?? []) as Array<{
    id: string;
    child: { id: string; name: string; birth_date: string } | null;
    therapistName: string;
    therapistSpecialty: string;
  }>;

  const { data: children, isLoading } = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });

  // Co-cuidador: busca acessos ativos
  const listMyCareAccessFn = useServerFn(listMyCareAccessServer);
  const careAccessQuery = useQuery({
    queryKey: ["my-care-access"],
    queryFn: async () => {
      const { data: session } = await supabaseClient.auth.getSession();
      const token = session.session?.access_token;
      const h: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      return listMyCareAccessFn({ data: undefined, headers: h } as any);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  const careAccesses = careAccessQuery.data?.accesses ?? [];

  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });

  // Analytics: início de sessão (uma vez por montagem do dashboard)
  useEffect(() => {
    track("session.start", { route: "/dashboard" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: detecta revogação de acesso de co-cuidador em tempo real
  useEffect(() => {
    if (!user || careAccesses.length === 0) return;

    const accessIds = careAccesses.map((a: any) => a.id);
    const channel = supabaseClient
      .channel("care-access-revoke")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "care_access",
          filter: `caregiver_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; child_id: string };
          if (updated.status === "revoked" && accessIds.includes(updated.id)) {
            const access = careAccesses.find((a: any) => a.id === updated.id);
            const childName = (access as any)?.child?.name ?? "Criança";
            setRevokedAccess({ childName });
            void qc.invalidateQueries({ queryKey: ["my-care-access"] });
          }
        },
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [user, careAccesses, qc]);

  // Redireciona responsável sem filhos para o onboarding.
  // Só quando o papel ativo é explicitamente 'parent' (não dispara enquanto
  // um usuário dual ainda não escolheu o perfil).
  useEffect(() => {
    if (profileQuery.isLoading || isLoading) return;
    if (!profileQuery.data) return; // perfil ainda não carregou (evita redirect prematuro)
    if (!isTherapist && children && children.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [profileQuery.isLoading, profileQuery.data, isLoading, isTherapist, children, navigate]);

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

  // Mostra skeleton enquanto carrega tipo de usuário
  if (isLoading || profileQuery.isLoading) {
    return (
      <AppShell>
        <DashboardSkeleton />
      </AppShell>
    );
  }

  const displayName = getDisplayName(user);
  const handleQuickRegister = (child: Child) => {
    void navigate({ to: "/registros" as const, href: `/registros?new=1&childId=${child.id}` });
  };

  // ─── DASHBOARD DO TERAPEUTA ───────────────────────────────────────────────────
  if (isTherapist) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          {/* HERO teal */}
          <section
            className="relative overflow-hidden rounded-[22px] px-[22px] pb-[26px] pt-6"
            style={{
              background: "linear-gradient(140deg, #E6FFFA 0%, #F0FDF9 50%, #E0F2FE 100%)",
              border: `1px solid ${TEAL_BORDER}`,
            }}
          >
            <div className="relative">
              <div className="text-[12.5px] font-semibold" style={{ color: "#6B7280" }}>
                {formatTodayHero()}
              </div>
              <h1
                className="mt-2 text-[26px] font-extrabold leading-tight"
                style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
              >
                Olá{displayName ? `, ${displayName}` : ""}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#4B5563" }}>
                {patientsLoading
                  ? "Carregando seus pacientes…"
                  : patients.length === 0
                  ? "Adicione seu primeiro paciente para começar."
                  : `Você tem ${patients.length} paciente${patients.length !== 1 ? "s" : ""} cadastrado${patients.length !== 1 ? "s" : ""}.`}
              </p>
            </div>
          </section>

          {/* PACIENTES */}
          <div className="mt-7">
            <SectionHeader
              tint={TEAL_SOFT}
              iconColor={TEAL_CARE}
              icon={Stethoscope}
              title="Meus pacientes"
              action={
                <button
                  type="button"
                  onClick={() => navigate({ to: "/pacientes/novo" as any })}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-bold transition-colors"
                  style={{ background: TEAL_SOFT, color: TEAL_CARE, border: `1px solid ${TEAL_BORDER}` }}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  Adicionar
                </button>
              }
            />

            {patientsLoading ? (
              <div className="flex flex-col gap-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-[72px] w-full rounded-[18px]" />
                ))}
              </div>
            ) : patients.length === 0 ? (
              <div
                className="rounded-[18px] border p-6 text-center"
                style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
              >
                <div
                  className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: TEAL_BORDER }}
                >
                  <UserPlus size={22} strokeWidth={1.7} color={TEAL_CARE} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                  Nenhum paciente ainda
                </p>
                <p className="mt-1 text-xs" style={{ color: "#6B7280" }}>
                  Adicione seu primeiro paciente pelo botão acima.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {patients.map((p) => (
                  <PatientCard
                    key={p.id}
                    patient={p}
                    onOpen={(id) => navigate({ to: "/paciente/$childId", params: { childId: id } })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* EXPLORAR (tiles terapeuta) */}
          <div className="mt-7">
            <SectionHeader
              tint="#F3E8FF"
              iconColor="#7C3AED"
              icon={Compass}
              title="Explorar"
            />
            <div className="grid grid-cols-2 gap-3">
              {[
                { to: "/agenda" as const, tint: "#F3E8FF", color: "#7C3AED", icon: Calendar, title: "Agenda", desc: "Sessões e compromissos." },
                { to: "/evolucao" as any, tint: "#F0FDF4", color: "#10B981", icon: TrendingUp, title: "Evolução", desc: "Marcos de desenvolvimento e metas." },
              ].map(({ to, tint, color, icon: Icon, title, desc }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => navigate({ to })}
                  className="flex flex-col gap-3 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md"
                  style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: tint }}>
                    <Icon size={20} strokeWidth={1.7} color={color} />
                  </div>
                  <div>
                    <div className="mb-1 text-[15px] font-bold" style={{ color: "#0F172A", letterSpacing: "-0.01em" }}>{title}</div>
                    <div className="text-[12.5px] leading-snug" style={{ color: "#6B7280" }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="h-8" />
        </div>
      </AppShell>
    );
  }

  // ─── DASHBOARD DO RESPONSÁVEL ─────────────────────────────────────────────────
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

        {/* CO-CUIDADOR: filhos compartilhados */}
        {careAccesses.length > 0 && (
          <div className="mt-7">
            <SectionHeader
              tint="#F0FDFA"
              iconColor={TEAL_CARE}
              icon={HandHeart}
              title="Cuidados compartilhados"
            />
            <div className="flex flex-col gap-3">
              {careAccesses.map((a: any) => (
                <SharedChildCard
                  key={a.id}
                  access={a}
                  onNavigate={() => navigate({ to: "/registros" })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ACOMPANHAMENTO TERAPÊUTICO: filhos acompanhados por terapeuta */}
        {therapistAccesses.length > 0 && (
          <div className="mt-7">
            <SectionHeader
              tint={TEAL_SOFT}
              iconColor={TEAL_CARE}
              icon={Stethoscope}
              title="Acompanhamento terapêutico"
            />
            <div className="flex flex-col gap-3">
              {therapistAccesses.map((a) => (
                <TherapistAccessCard key={a.id} access={a} />
              ))}
            </div>
          </div>
        )}

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
            {/* Tile: Meu Terapeuta (apenas para pais) */}
            {!isTherapist && (
              <button
                type="button"
                onClick={() => navigate({ to: "/meu-terapeuta" as any })}
                className="flex flex-col gap-3 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md"
                style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: "#F0FDFA" }}
                >
                  <Stethoscope size={20} strokeWidth={1.7} color={TEAL_CARE} />
                </div>
                <div>
                  <div className="mb-1 text-[15px] font-bold" style={{ color: "#0F172A", letterSpacing: "-0.01em" }}>
                    Meu Terapeuta
                  </div>
                  <div className="text-[12.5px] leading-snug" style={{ color: "#6B7280" }}>
                    Sessões e evolução compartilhados.
                  </div>
                </div>
              </button>
            )}

            {/* Tile dinâmico: Cuidado compartilhado (apenas para owners com filhos) */}
            {(children ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => navigate({ to: "/cuidado-compartilhado/$childId", params: { childId: children![0]!.id } })}
                className="flex flex-col gap-3 rounded-[18px] border bg-white p-4 text-left transition-shadow hover:shadow-md"
                style={{ borderColor: "#EEF0F4", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: "#F0FDFA" }}
                >
                  <HandHeart size={20} strokeWidth={1.7} color={TEAL_CARE} />
                </div>
                <div>
                  <div
                    className="mb-1 text-[15px] font-bold"
                    style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
                  >
                    Cuidado compartilhado
                  </div>
                  <div
                    className="text-[12.5px] leading-snug"
                    style={{ color: "#6B7280" }}
                  >
                    Convide co-cuidadores.
                  </div>
                </div>
              </button>
            )}
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

      {revokedAccess && (
        <AccessRevokedOverlay
          childName={revokedAccess.childName}
          onDismiss={() => setRevokedAccess(null)}
        />
      )}
    </AppShell>
  );
}
