import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Search, Users, Stethoscope, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ProfessionalCard } from "@/components/professionals/ProfessionalCard";
import { ProfessionalFormDialog } from "@/components/professionals/ProfessionalFormDialog";
import { DeleteProfessionalDialog } from "@/components/professionals/DeleteProfessionalDialog";
import { EmptyProfessionals } from "@/components/professionals/EmptyProfessionals";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";
import { useAuth } from "@/hooks/useAuth";
import {
  useMyPendingTherapistInvites,
  useAcceptTherapistInviteById,
} from "@/services/therapist.service";
import {
  createProfessional,
  deleteProfessional,
  listProfessionals,
  updateProfessional,
} from "@/services/professionals.service";
import type { ProfessionalInput } from "@/lib/validation";
import type { Professional } from "@/types/database";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/_auth/profissionais")({
  head: () => ({
    meta: [{ title: "Profissionais — TEAmo" }],
  }),
  component: ProfessionalsPage,
});

function ProfessionalsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [dismissedInvites, setDismissedInvites] = useState<Set<string>>(new Set());

  const pendingInvitesQuery = useMyPendingTherapistInvites();
  const pendingInvites = (pendingInvitesQuery.data?.invites ?? []).filter(
    (inv: any) => !dismissedInvites.has(inv.inviteId),
  );
  const acceptInviteById = useAcceptTherapistInviteById();

  useEffect(() => {
    track("module.open", { module: "profissionais", route: "/profissionais" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState<Professional | null>(null);
  const [deleting, setDeleting] = useState<Professional | null>(null);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState<string>("all");

  const { data: professionals, isLoading } = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (input: ProfessionalInput) => createProfessional(user!.id, input),
    onSuccess: () => {
      track("professional.invite", { module: "profissionais" });
      toast.success("Profissional cadastrado com sucesso.");
      qc.invalidateQueries({ queryKey: ["professionals"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: ProfessionalInput }) =>
      updateProfessional(vars.id, vars.input),
    onSuccess: () => {
      toast.success("Profissional atualizado.");
      qc.invalidateQueries({ queryKey: ["professionals"] });
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProfessional(id),
    onSuccess: () => {
      toast.success("Profissional excluído.");
      qc.invalidateQueries({ queryKey: ["professionals"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const specialties = useMemo(() => {
    const set = new Set<string>();
    for (const p of professionals ?? []) {
      if (p.specialty?.trim()) set.add(p.specialty.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [professionals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (professionals ?? []).filter((p) => {
      if (specialty !== "all" && p.specialty !== specialty) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.specialty.toLowerCase().includes(q)
      );
    });
  }, [professionals, search, specialty]);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (p: Professional) => {
    setEditing(p);
    setFormOpen(true);
  };

  const handleSubmit = async (data: ProfessionalInput) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, input: data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const handleAcceptInvite = async (inviteId: string, therapistName: string) => {
    try {
      const res = await acceptInviteById.mutateAsync(inviteId);
      toast.success(`Vínculo estabelecido com ${therapistName}!`);
      void navigate({ to: "/meu-terapeuta" as any });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aceitar convite.");
    }
  };

  const total = professionals?.length ?? 0;
  const hasAny = total > 0;

  return (
    <AppShell>
      <div className="mb-5">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Voltar ao início
        </Link>
      </div>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: "#EEF1FF" }}
          >
            <Users className="h-5 w-5" style={{ color: "#4F46E5" }} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-foreground leading-tight">
              Profissionais
            </h1>
            <p className="text-xs text-muted-foreground">
              Médicos, terapeutas e equipe escolar que acompanham a criança.
            </p>
          </div>
        </div>
        {hasAny && (
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold text-white"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Cadastrar</span>
          </button>
        )}
      </header>

      {/* Banners de convites pendentes do terapeuta */}
      {pendingInvites.length > 0 && (
        <div className="mb-5 flex flex-col gap-3">
          {pendingInvites.map((inv: any) => (
            <div
              key={inv.inviteId}
              className="rounded-[14px] border p-4"
              style={{ borderColor: "#CCFBF1", background: "linear-gradient(135deg, #F0FDFA 0%, #ECFDF5 100%)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl mt-0.5"
                  style={{ background: "#CCFBF1" }}
                >
                  <Stethoscope size={16} strokeWidth={1.8} color="#0D9488" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#0F172A] leading-tight">
                    Convite de acompanhamento
                  </p>
                  <p className="text-[12.5px] text-[#374151] mt-0.5 leading-relaxed">
                    <span className="font-semibold">{inv.therapistName}</span>
                    {inv.therapistSpecialty ? ` (${inv.therapistSpecialty})` : ""} convidou você
                    para acompanhar <span className="font-semibold">{inv.childName}</span>.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      disabled={acceptInviteById.isPending}
                      onClick={() => void handleAcceptInvite(inv.inviteId, inv.therapistName)}
                      className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity disabled:opacity-60"
                      style={{ background: "#0D9488" }}
                    >
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      Aceitar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedInvites((prev) => new Set([...prev, inv.inviteId]))}
                      className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
                    >
                      <X size={12} strokeWidth={2.5} />
                      Ignorar por ora
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasAny && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_240px]">
          <div className="relative">
            <Label htmlFor="prof-search" className="sr-only">
              Buscar
            </Label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              id="prof-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou especialidade"
              className="pl-9"
            />
          </div>
          {specialties.length > 0 && (
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger>
                <SelectValue placeholder="Especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as especialidades</SelectItem>
                {specialties.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {!hasAny ? (
        <EmptyProfessionals onAdd={handleOpenCreate} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum profissional encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProfessionalCard
              key={p.id}
              professional={p}
              onEdit={handleOpenEdit}
              onDelete={(prof) => setDeleting(prof)}
            />
          ))}
        </div>
      )}

      <ProfessionalFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
        initial={editing}
      />

      <DeleteProfessionalDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
        professionalName={deleting?.name}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </AppShell>
  );
}
