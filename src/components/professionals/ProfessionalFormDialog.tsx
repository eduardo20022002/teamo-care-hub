import { useEffect, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
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

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

function inputCls(hasError = false) {
  return [
    "block w-full rounded-[11px] border-[1.5px] bg-[#F6F7FB] px-3 py-2.5 text-sm text-foreground h-[44px]",
    "placeholder:text-[#9CA3AF] transition-[border-color,box-shadow,background-color] duration-150",
    "focus:outline-none focus:bg-[#FAFBFF] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]",
    hasError
      ? "border-red-400 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
      : "border-[#E5E7EB]",
  ].join(" ");
}

function selectTriggerCls(hasError = false) {
  return [
    "h-[44px] rounded-[11px] border-[1.5px] bg-[#F6F7FB] text-sm",
    "focus:outline-none focus:bg-[#FAFBFF] focus:border-[#4F46E5] focus:ring-[4px] focus:ring-[rgba(79,70,229,0.10)]",
    hasError ? "border-red-400" : "border-[#E5E7EB]",
  ].join(" ");
}

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
  if (PREDEFINED.includes(v as (typeof PREDEFINED)[number]))
    return { select: v, custom: "" };
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
    const parsed = professionalSchema.safeParse({ name, specialty, email, phone });
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
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[24px] px-0 pb-0 pt-0 max-h-[92vh] overflow-y-auto"
      >
        <SheetTitle className="sr-only">
          {isEdit ? "Editar profissional" : "Cadastrar profissional"}
        </SheetTitle>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pb-4 pt-3">
          <div>
            <h2 className="text-[17px] font-bold text-foreground">
              {isEdit ? "Editar profissional" : "Cadastrar profissional"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Informe os dados do profissional que faz parte do cuidado da criança.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6F7FB] text-muted-foreground hover:bg-[#EEF0F4]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="h-px bg-[#EEF0F4]" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Nome completo
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Dra. Mariana Silva"
              maxLength={120}
              autoFocus
              className={inputCls(!!errors.name)}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Especialidade */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Especialidade ou função
            </label>
            <Select
              value={specialtySelect}
              onValueChange={(v) => {
                setSpecialtySelect(v);
                if (v !== "Outro") setSpecialtyCustom("");
              }}
            >
              <SelectTrigger className={selectTriggerCls(!!errors.specialty)}>
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
              <input
                value={specialtyCustom}
                onChange={(e) => setSpecialtyCustom(e.target.value)}
                placeholder="Descreva a especialidade"
                maxLength={120}
                className={inputCls(false) + " mt-2"}
              />
            )}
            {errors.specialty && (
              <p className="text-xs text-red-500">{errors.specialty}</p>
            )}
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="profissional@exemplo.com"
              maxLength={255}
              className={inputCls(!!errors.email)}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Usado para enviar compartilhamentos seguros.
            </p>
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              Telefone{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={20}
              className={inputCls(!!errors.phone)}
            />
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone}</p>
            )}
          </div>

          {/* Botões */}
          <div className="space-y-3 pt-2 pb-6">
            <button
              type="submit"
              disabled={submitting}
              className="flex h-[50px] w-full items-center justify-center rounded-[12px] text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: BRAND_GRADIENT, boxShadow: submitting ? "none" : BRAND_SHADOW }}
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isEdit ? (
                "Salvar alterações"
              ) : (
                "Cadastrar"
              )}
            </button>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="w-full py-2 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
