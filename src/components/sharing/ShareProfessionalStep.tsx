import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { professionalSchema, TEA_SPECIALTIES } from "@/lib/validation";
import type { Professional } from "@/types/database";
import { normalizeForSearch } from "@/services/documents.service";

interface Props {
  professionals: Professional[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: { name: string; specialty: string; email: string }) => Promise<Professional>;
}

export function ShareProfessionalStep({
  professionals,
  selectedId,
  onSelect,
  onCreate,
}: Props) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const q = normalizeForSearch(query);
  const filtered = useMemo(
    () =>
      professionals.filter((p) =>
        !q ? true : normalizeForSearch(`${p.name} ${p.specialty} ${p.email}`).includes(q),
      ),
    [professionals, q],
  );

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = professionalSchema.safeParse({ name, specialty, email, phone: "" });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const created = await onCreate({
        name: parsed.data.name,
        specialty: parsed.data.specialty,
        email: parsed.data.email,
      });
      onSelect(created.id);
      setShowForm(false);
      setName("");
      setSpecialty("");
      setEmail("");
    } catch (err) {
      setErrors({ name: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar profissional…"
          className="pl-9"
        />
      </div>

      <ul className="max-h-[34vh] space-y-1.5 overflow-y-auto pr-1">
        {filtered.length === 0 && !showForm && (
          <li className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            Nenhum profissional encontrado.
          </li>
        )}
        {filtered.map((p) => {
          const active = p.id === selectedId;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id)}
                className={[
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary-soft/40"
                    : "border-border bg-card hover:bg-primary-soft/20",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-1 h-3 w-3 shrink-0 rounded-full border",
                    active ? "border-primary bg-primary" : "border-border",
                  ].join(" ")}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.specialty} · {p.email}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {!showForm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="w-full"
        >
          <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.75} />
          Cadastrar novo profissional
        </Button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="qprof-name">Nome</Label>
            <Input
              id="qprof-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qprof-specialty">Especialidade</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger id="qprof-specialty">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TEA_SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.specialty && (
              <p className="text-xs text-destructive">{errors.specialty}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qprof-email">E-mail</Label>
            <Input
              id="qprof-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setErrors({});
              }}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar e selecionar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
