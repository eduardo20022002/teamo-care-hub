import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ChevronRight,
  Loader2,
  Mail,
  Phone,
  Trash2,
  User,
  Heart,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ChildFormSheet } from "@/components/children/ChildFormSheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatAge, formatBirthDate, formatDateBR } from "@/lib/formatters";
import { createChild } from "@/services/children.service";
import {
  getChildrenWithCounts,
  getProfile,
  updateChildRelation,
  updateProfile,
  type ProfilePatch,
} from "@/services/profile.service";

export const Route = createFileRoute("/_auth/perfil")({
  head: () => ({
    meta: [{ title: "Meu perfil — TEAmo" }],
  }),
  component: PerfilPage,
});

const RELATIONS = ["Pai", "Mãe", "Avô", "Avó", "Cuidador(a)", "Responsável", "Outro"];

// ─── Field row ───────────────────────────────────────────────────────────────
interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  onEdit: () => void;
  emailVerified?: boolean;
}

function FieldRow({ icon, label, value, onEdit, emailVerified }: FieldRowProps) {
  const hasValue = !!value;
  return (
    <div className="flex items-center gap-3 border-b border-border py-3.5 last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <div className="flex items-center gap-1">
          <p
            className={`text-sm font-medium ${hasValue ? "text-foreground" : "text-muted-foreground"}`}
          >
            {hasValue ? value : "Adicionar"}
          </p>
          {emailVerified && <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-xs font-semibold text-primary hover:underline"
      >
        {hasValue ? "Editar" : "+ Adicionar"}
      </button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
function PerfilPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // ── Editing state ──────────────────────────────────────────────────────────
  const [editField, setEditField] = useState<
    "full_name" | "phone" | "birth_date" | "relation" | null
  >(null);
  const [editValue, setEditValue] = useState("");
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────────
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
  });

  const childrenQuery = useQuery({
    queryKey: ["children-counts", user?.id],
    queryFn: () => getChildrenWithCounts(user!.id),
    enabled: !!user,
  });

  const profile = profileQuery.data;
  const children = childrenQuery.data ?? [];
  const primaryChild = children[0] ?? null;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (patch: ProfilePatch) => updateProfile(user!.id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["profile-shell"] });
      toast.success("Perfil atualizado.");
      setEditField(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const relationMutation = useMutation({
    mutationFn: ({ childId, relation }: { childId: string; relation: string }) =>
      updateChildRelation(childId, relation),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["children-counts"] });
      toast.success("Relação atualizada.");
      setEditField(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addChildMutation = useMutation({
    mutationFn: (data: { name: string; birth_date: string }) => createChild(user!.id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["children-counts"] });
      void qc.invalidateQueries({ queryKey: ["children"] });
      toast.success("Criança adicionada.");
      setAddChildOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openEdit = (field: typeof editField, current?: string | null) => {
    setEditValue(current ?? "");
    setEditField(field);
  };

  const handleSave = () => {
    if (editField === "relation") {
      if (!primaryChild) {
        toast.error("Adicione uma criança primeiro para definir a relação.");
        setEditField(null);
        return;
      }
      relationMutation.mutate({ childId: primaryChild.id, relation: editValue });
      return;
    }
    if (!editField) return;
    // birth_date vazio deve virar null para evitar erro de tipo no DB
    const value: string | null = editField === "birth_date" && !editValue ? null : editValue;
    updateMutation.mutate({ [editField]: value });
  };

  const isSaving = updateMutation.isPending || relationMutation.isPending;
  const isLoading = profileQuery.isLoading || childrenQuery.isLoading;

  // ── Avatar ────────────────────────────────────────────────────────────────
  const initial = (profile?.full_name ?? user?.email ?? "U").charAt(0).toUpperCase();
  const roleBadge = primaryChild
    ? `${primaryChild.relation ?? "Cuidador(a)"} do ${primaryChild.name}`
    : null;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <div className="mb-5">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Voltar ao início
          </Link>
        </div>

        {/* Title */}
        <header className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <User className="h-6 w-6 text-primary" strokeWidth={1.75} />
            Meu perfil
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus dados como cuidador. Eles aparecem quando você compartilha informações.
          </p>
        </header>

        {/* Avatar card */}
        <div
          className="mb-6 flex items-center gap-4 rounded-[22px] p-5"
          style={{ background: "var(--brand-gradient)" }}
        >
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">
              {initial}
            </div>
            <button
              type="button"
              onClick={() => toast("Em breve: foto de perfil.")}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow"
              aria-label="Alterar foto"
            >
              <Camera className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold text-white">
              {profile?.full_name ?? "Sem nome"}
            </p>
            {roleBadge && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white">
                <Heart className="h-3 w-3" strokeWidth={2} />
                {roleBadge}
              </span>
            )}
          </div>
        </div>

        {/* SOBRE VOCÊ */}
        <section className="mb-6 rounded-2xl border border-border bg-card px-4 shadow-sm">
          <p className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sobre você
          </p>
          <FieldRow
            icon={<User className="h-4 w-4" strokeWidth={1.75} />}
            label="Nome completo"
            value={profile?.full_name}
            onEdit={() => openEdit("full_name", profile?.full_name)}
          />
          <FieldRow
            icon={<Mail className="h-4 w-4" strokeWidth={1.75} />}
            label="E-mail"
            value={profile?.email ?? user?.email}
            emailVerified
            onEdit={() =>
              toast("O e-mail é o seu identificador de login e não pode ser alterado por aqui.")
            }
          />
          <FieldRow
            icon={<Phone className="h-4 w-4" strokeWidth={1.75} />}
            label="Telefone"
            value={profile?.phone}
            onEdit={() => openEdit("phone", profile?.phone)}
          />
          <FieldRow
            icon={<Heart className="h-4 w-4" strokeWidth={1.75} />}
            label="Relação com a criança"
            value={primaryChild?.relation}
            onEdit={() => {
              if (!primaryChild) {
                toast.error("Adicione uma criança primeiro para definir a relação.");
                return;
              }
              openEdit("relation", primaryChild.relation);
            }}
          />
          <FieldRow
            icon={<CalendarDays className="h-4 w-4" strokeWidth={1.75} />}
            label="Data de nascimento"
            value={profile?.birth_date ? formatBirthDate(profile.birth_date) : null}
            onEdit={() => openEdit("birth_date", profile?.birth_date ?? "")}
          />
        </section>

        {/* CRIANÇAS */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Crianças sob seus cuidados
            </p>
            <button
              type="button"
              onClick={() => setAddChildOpen(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              + Adicionar
            </button>
          </div>
          <div className="space-y-2">
            {children.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
                Nenhuma criança cadastrada ainda.
              </div>
            )}
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => navigate({ to: "/profissionais" })}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm hover:bg-muted/40 transition-colors"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: "var(--brand-gradient)" }}
                >
                  {child.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{child.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAge(child.birth_date)} · {formatBirthDate(child.birth_date)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {child.registros_count} registros
                    </span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {child.profissionais_count} profissionais
                    </span>
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground/60"
                  strokeWidth={1.75}
                />
              </button>
            ))}
          </div>
        </section>

        {/* CONTA */}
        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <p className="px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Conta
          </p>
          <div className="border-b border-border px-4 py-3.5">
            <p className="text-xs text-muted-foreground">Membro desde</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {profile?.created_at ? formatDateBR(profile.created_at) : "—"}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="flex items-center gap-2 text-sm font-semibold text-destructive hover:underline"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              Excluir minha conta
            </button>
          </div>
        </section>
      </div>

      {/* ── Edit dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={editField !== null} onOpenChange={(o) => !o && setEditField(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editField === "full_name" && "Editar nome"}
              {editField === "phone" && "Editar telefone"}
              {editField === "birth_date" && "Data de nascimento"}
              {editField === "relation" && "Relação com a criança"}
            </DialogTitle>
          </DialogHeader>

          {editField === "relation" ? (
            <div className="space-y-2">
              <Label>Relação</Label>
              <Select value={editValue} onValueChange={setEditValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : editField === "birth_date" ? (
            <div className="space-y-2">
              <Label htmlFor="edit-birth-date">Data de nascimento</Label>
              <Input
                id="edit-birth-date"
                type="date"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="edit-field">
                {editField === "full_name" ? "Nome completo" : "Telefone"}
              </Label>
              <Input
                id="edit-field"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={editField === "phone" ? "(00) 00000-0000" : "Seu nome"}
                autoFocus
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditField(null)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isSaving ||
                // Nome e relação: obrigatórios. Telefone e data: permite limpar.
                ((editField === "full_name" || editField === "relation") && !editValue.trim())
              }
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add child sheet ──────────────────────────────────────────────────── */}
      <ChildFormSheet
        open={addChildOpen}
        onOpenChange={setAddChildOpen}
        onSubmit={async (data) => {
          await addChildMutation.mutateAsync(data);
        }}
        submitting={addChildMutation.isPending}
      />

      {/* ── Delete account dialog ────────────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os seus dados serão permanentemente removidos. Digite{" "}
              <strong>EXCLUIR</strong> para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="EXCLUIR"
            className="font-mono"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "EXCLUIR"}
              onClick={() => {
                toast.error(
                  "Para excluir sua conta, entre em contato com suporte@teamotech.online",
                );
                setDeleteDialogOpen(false);
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
