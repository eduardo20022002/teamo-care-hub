import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  professionalSchema,
  TEA_SPECIALTIES,
  type ProfessionalInput,
} from "@/lib/validation";
import type { Professional } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProfessionalInput) => Promise<void> | void;
  submitting?: boolean;
  initial?: Professional | null;
}

type FieldErrors = Partial<Record<keyof ProfessionalInput, string>>;

const PREDEFINED = TEA_SPECIALTIES.filter((s) => s !== "Outro");

function deriveSpecialtyState(value: string | undefined) {
  const v = (value ?? "").trim();
  if (!v) return { select: "", custom: "" };
  if (PREDEFINED.includes(v as (typeof PREDEFINED)[number])) {
    return { select: v, custom: "" };
  }
  return { select: "Outro", custom: v };
}

export function ProfessionalFormDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
  initial,
}: Props) {
  const [name, setName] = useState("");
  const [specialtySelect, setSpecialtySelect] = useState("");
  const [specialtyCustom, setSpecialtyCustom] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (open) {
      const sp = deriveSpecialtyState(initial?.specialty);
      setName(initial?.name ?? "");
      setSpecialtySelect(sp.select);
      setSpecialtyCustom(sp.custom);
      setEmail(initial?.email ?? "");
      setPhone(initial?.phone ?? "");
      setErrors({});
    }
  }, [open, initial]);

  const isEdit = !!initial;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const specialty =
      specialtySelect === "Outro" ? specialtyCustom : specialtySelect;
    const parsed = professionalSchema.safeParse({
      name,
      specialty,
      email,
      phone,
    });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ProfessionalInput;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setErrors({});
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar profissional" : "Cadastrar profissional"}
          </DialogTitle>
          <DialogDescription>
            Informe os dados do profissional que faz parte do cuidado da criança.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prof-name">Nome</Label>
            <Input
              id="prof-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Dra. Mariana Silva"
              autoFocus
              maxLength={120}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prof-specialty">Especialidade / função</Label>
            <Select
              value={specialtySelect}
              onValueChange={(v) => {
                setSpecialtySelect(v);
                if (v !== "Outro") setSpecialtyCustom("");
              }}
            >
              <SelectTrigger id="prof-specialty">
                <SelectValue placeholder="Selecione uma especialidade" />
              </SelectTrigger>
              <SelectContent>
                {TEA_SPECIALTIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {specialtySelect === "Outro" && (
              <Input
                value={specialtyCustom}
                onChange={(e) => setSpecialtyCustom(e.target.value)}
                placeholder="Descreva a especialidade"
                maxLength={120}
                className="mt-2"
              />
            )}
            {errors.specialty && (
              <p className="text-xs text-destructive">{errors.specialty}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prof-email">E-mail</Label>
            <Input
              id="prof-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="profissional@exemplo.com"
              maxLength={255}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prof-phone">
              Telefone <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={20}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
