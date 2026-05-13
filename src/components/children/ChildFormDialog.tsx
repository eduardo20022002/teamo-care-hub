import { useState, type FormEvent } from "react";
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
import { childSchema, type ChildInput } from "@/lib/validation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChildInput) => Promise<void> | void;
  submitting?: boolean;
}

export function ChildFormDialog({ open, onOpenChange, onSubmit, submitting }: Props) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [errors, setErrors] = useState<{ name?: string; birth_date?: string }>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = childSchema.safeParse({ name, birth_date: birthDate });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof fieldErrors;
        if (k && !fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    await onSubmit(parsed.data);
    setName("");
    setBirthDate("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setErrors({});
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar criança</DialogTitle>
          <DialogDescription>
            Informe o nome e a data de nascimento da criança sob seus cuidados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="child-name">Nome</Label>
            <Input
              id="child-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Lucas"
              autoFocus
              maxLength={80}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="child-birth">Data de nascimento</Label>
            <Input
              id="child-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            {errors.birth_date && (
              <p className="text-xs text-destructive">{errors.birth_date}</p>
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
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
