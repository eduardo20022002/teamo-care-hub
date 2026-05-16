import { useState, type FormEvent } from "react";
import { Loader2, X, Calendar } from "lucide-react";
import { childSchema, type ChildInput } from "@/lib/validation";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChildInput) => Promise<void> | void;
  submitting?: boolean;
}

export function ChildFormSheet({ open, onOpenChange, onSubmit, submitting }: Props) {
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

  const handleClose = () => {
    if (submitting) return;
    setErrors({});
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={handleClose}
        className="absolute inset-0 bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px] cursor-default"
      />

      {/* Sheet/Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="child-sheet-title"
        className="relative w-full sm:w-[420px] bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:shadow-[0_20px_60px_rgba(15,23,42,0.2)] rounded-t-3xl sm:rounded-3xl px-5 pt-3 pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in duration-200"
      >
        {/* Drag handle (only mobile) */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <h2
            id="child-sheet-title"
            className="text-xl font-extrabold tracking-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
          >
            Cadastrar criança
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[#9CA3AF] transition-colors hover:bg-[#E5E7EB] hover:text-[#6B7280] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <p
          className="mt-1 mb-5 text-[13.5px] leading-snug"
          style={{ color: "#6B7280", maxWidth: 300 }}
        >
          Informe o nome e a data de nascimento da criança sob seus cuidados.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Nome */}
          <div className="mb-3.5">
            <label
              htmlFor="child-name"
              className="mb-1.5 block text-[12.5px] font-semibold"
              style={{ color: "#374151", letterSpacing: "-0.005em" }}
            >
              Nome
            </label>
            <input
              id="child-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Lucas"
              autoFocus
              maxLength={80}
              disabled={submitting}
              className={`h-12 w-full rounded-xl border bg-[#F6F7FB] px-3.5 text-[15px] outline-none transition-all
                ${errors.name
                  ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                  : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
                }
                disabled:opacity-60`}
              style={{ color: "#0F172A" }}
            />
            {errors.name && <p className="mt-1.5 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Data de nascimento */}
          <div className="mb-4">
            <label
              htmlFor="child-birth"
              className="mb-1.5 block text-[12.5px] font-semibold"
              style={{ color: "#374151", letterSpacing: "-0.005em" }}
            >
              Data de nascimento
            </label>
            <div className="relative">
              <input
                id="child-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                disabled={submitting}
                className={`h-12 w-full rounded-xl border bg-[#F6F7FB] px-3.5 pr-10 text-[15px] outline-none transition-all
                  ${errors.birth_date
                    ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                    : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
                  }
                  disabled:opacity-60`}
                style={{ color: "#0F172A", colorScheme: "light" }}
              />
              <Calendar
                size={18}
                strokeWidth={1.6}
                className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              />
            </div>
            {errors.birth_date && (
              <p className="mt-1.5 text-xs text-red-500">{errors.birth_date}</p>
            )}
            <p className="mt-1.5 text-[11.5px]" style={{ color: "#9CA3AF" }}>
              Usaremos pra mostrar a idade nos registros.
            </p>
          </div>

          {/* Cadastrar */}
          <button
            type="submit"
            disabled={submitting}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: BRAND_SHADOW,
              letterSpacing: "-0.005em",
            }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Cadastrar
          </button>

          {/* Cancelar */}
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151] disabled:opacity-50"
            style={{ color: "#6B7280" }}
          >
            Cancelar
          </button>
        </form>
      </div>
    </div>
  );
}
