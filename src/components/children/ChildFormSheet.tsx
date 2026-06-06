import { useRef, useState } from "react";
import { Loader2, X, Calendar, ArrowLeft } from "lucide-react";
import { childSchema, type ChildInput, CARE_RELATIONS, CARE_RELATION_LABELS } from "@/lib/validation";

const BRAND_GRADIENT =
  "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)";
const BRAND_SHADOW =
  "0 8px 18px -8px rgba(79,70,229,0.45), 0 3px 8px -3px rgba(236,72,153,0.25)";

const COMORBIDITIES = [
  { value: "ansiedade",     label: "Ansiedade" },
  { value: "depressao",     label: "Depressão" },
  { value: "tdah",          label: "TDAH" },
  { value: "tod",           label: "TOD" },
  { value: "epilepsia",     label: "Epilepsia" },
  { value: "dif_linguagem", label: "Dificuldade de linguagem" },
] as const;

const COMORBIDITY_VALUES = COMORBIDITIES.map((c) => c.value);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ChildInput) => Promise<void> | void;
  submitting?: boolean;
}

export function ChildFormSheet({ open, onOpenChange, onSubmit, submitting }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relation, setRelation] = useState("");
  const [step1Errors, setStep1Errors] = useState<{ name?: string; birth_date?: string; relation?: string }>({});

  // Step 2
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [otherDiag, setOtherDiag] = useState("");
  const otherInputRef = useRef<HTMLInputElement>(null);

  const resetAll = () => {
    setStep(1);
    setName("");
    setBirthDate("");
    setRelation("");
    setStep1Errors({});
    setDiagnoses([]);
    setShowOther(false);
    setOtherDiag("");
  };

  const handleClose = () => {
    if (submitting) return;
    resetAll();
    onOpenChange(false);
  };

  const handleStep1Next = () => {
    const parsed = childSchema.pick({ name: true, birth_date: true }).safeParse({
      name,
      birth_date: birthDate,
    });
    const errs: typeof step1Errors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof errs;
        if (k && !errs[k]) errs[k] = issue.message;
      }
    }
    if (!relation) errs.relation = "Selecione sua relação com a criança.";
    if (Object.keys(errs).length > 0) {
      setStep1Errors(errs);
      return;
    }
    setStep1Errors({});
    setStep(2);
  };

  const toggleDiagnosis = (value: string) => {
    setDiagnoses((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  };

  const commitOther = () => {
    const trimmed = otherDiag.trim();
    if (trimmed && !diagnoses.includes(trimmed)) {
      setDiagnoses((prev) => [...prev, trimmed]);
    }
    setOtherDiag("");
    setShowOther(false);
  };

  const handleFinalSubmit = async (finalDiagnoses: string[]) => {
    await onSubmit({ name, birth_date: birthDate, diagnoses: finalDiagnoses, relation: relation || undefined });
    resetAll();
  };

  if (!open) return null;

  const customDiagnoses = diagnoses.filter((d) => !COMORBIDITY_VALUES.includes(d as (typeof COMORBIDITY_VALUES)[number]));

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
        className="relative w-full sm:w-[440px] bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.16)] sm:shadow-[0_20px_60px_rgba(15,23,42,0.2)] rounded-t-3xl sm:rounded-3xl px-5 pt-3 pb-6 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in duration-200"
      >
        {/* Drag handle (mobile only) */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E5E7EB] sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                aria-label="Voltar"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#F4F5FA] text-[#9CA3AF] transition-colors hover:bg-[#E5E7EB] hover:text-[#6B7280] disabled:opacity-50"
              >
                <ArrowLeft size={16} strokeWidth={2} />
              </button>
            )}
            <h2
              id="child-sheet-title"
              className="text-xl font-extrabold tracking-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              {step === 1 ? "Cadastrar criança" : "Informações de saúde"}
            </h2>
          </div>
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

        {/* Progress indicator */}
        <div className="mt-4 mb-5 flex items-center justify-center gap-0">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div className={`h-0.5 w-10 transition-colors duration-300 ${step === 2 ? "bg-primary" : "bg-[#E5E7EB]"}`} />
          <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${step === 2 ? "bg-primary" : "bg-[#E5E7EB]"}`} />
        </div>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div>
            <p className="mb-5 text-[13.5px] leading-snug" style={{ color: "#6B7280", maxWidth: 320 }}>
              Informe o nome, data de nascimento e sua relação com a criança.
            </p>

            {/* Nome */}
            <div className="mb-3.5">
              <label
                htmlFor="child-name"
                className="mb-1.5 block text-[12.5px] font-semibold"
                style={{ color: "#374151" }}
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
                className={`h-12 w-full rounded-xl border bg-[#F6F7FB] px-3.5 text-[15px] outline-none transition-all disabled:opacity-60 ${
                  step1Errors.name
                    ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                    : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
                }`}
                style={{ color: "#0F172A" }}
              />
              {step1Errors.name && (
                <p className="mt-1.5 text-xs text-red-500">{step1Errors.name}</p>
              )}
            </div>

            {/* Data de nascimento */}
            <div className="mb-4">
              <label
                htmlFor="child-birth"
                className="mb-1.5 block text-[12.5px] font-semibold"
                style={{ color: "#374151" }}
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
                  className={`h-12 w-full rounded-xl border bg-[#F6F7FB] px-3.5 pr-10 text-[15px] outline-none transition-all disabled:opacity-60 ${
                    step1Errors.birth_date
                      ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.10)]"
                      : "border-[#E5E7EB] focus:border-[#4F46E5] focus:shadow-[0_0_0_4px_rgba(79,70,229,0.10)]"
                  }`}
                  style={{ color: "#0F172A", colorScheme: "light" }}
                />
                <Calendar
                  size={18}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
              </div>
              {step1Errors.birth_date && (
                <p className="mt-1.5 text-xs text-red-500">{step1Errors.birth_date}</p>
              )}
              <p className="mt-1.5 text-[11.5px]" style={{ color: "#9CA3AF" }}>
                Usaremos para mostrar a idade nos registros.
              </p>
            </div>

            {/* Relação */}
            <div className="mb-5">
              <p className="mb-2 text-[12.5px] font-semibold" style={{ color: "#374151" }}>
                Você é...
              </p>
              <div className="flex flex-wrap gap-2">
                {CARE_RELATIONS.map((rel) => (
                  <button
                    key={rel}
                    type="button"
                    onClick={() => setRelation(rel)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      relation === rel
                        ? "bg-primary text-white shadow-sm"
                        : "bg-[#F4F5FA] text-[#374151] hover:bg-[#E9EBF4]"
                    }`}
                  >
                    {CARE_RELATION_LABELS[rel]}
                  </button>
                ))}
              </div>
              {step1Errors.relation && (
                <p className="mt-1.5 text-xs text-red-500">{step1Errors.relation}</p>
              )}
            </div>

            {/* Botão próximo */}
            <button
              type="button"
              onClick={handleStep1Next}
              className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px"
              style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW, letterSpacing: "-0.005em" }}
            >
              Próximo
            </button>

            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151] disabled:opacity-50"
              style={{ color: "#6B7280" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <p className="mb-1 text-[13.5px] font-semibold" style={{ color: "#0F172A" }}>
              Além do TEA, há outros diagnósticos?
            </p>
            <p className="mb-4 text-[12px]" style={{ color: "#9CA3AF" }}>
              Opcional — selecione quantos quiser ou pule esta etapa.
            </p>

            {/* Chips predefinidos */}
            <div className="flex flex-wrap gap-2 mb-3">
              {COMORBIDITIES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDiagnosis(value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    diagnoses.includes(value)
                      ? "bg-primary text-white shadow-sm"
                      : "bg-[#F4F5FA] text-[#374151] hover:bg-[#E9EBF4]"
                  }`}
                >
                  {label}
                </button>
              ))}

              {/* Chip "Outro" */}
              {!showOther ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowOther(true);
                    setTimeout(() => otherInputRef.current?.focus(), 50);
                  }}
                  className="rounded-full border border-dashed border-[#D1D5DB] px-3.5 py-1.5 text-xs font-semibold text-[#6B7280] transition-colors hover:border-primary hover:text-primary"
                >
                  + Outro
                </button>
              ) : (
                <input
                  ref={otherInputRef}
                  type="text"
                  value={otherDiag}
                  onChange={(e) => setOtherDiag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitOther(); }
                    if (e.key === "Escape") { setShowOther(false); setOtherDiag(""); }
                  }}
                  onBlur={commitOther}
                  placeholder="Digite e pressione Enter"
                  maxLength={80}
                  className="h-8 rounded-full border border-primary/50 bg-[#F6F7FB] px-3 text-xs outline-none focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,70,229,0.12)]"
                  style={{ minWidth: 180 }}
                />
              )}
            </div>

            {/* Diagnósticos customizados (digitados) */}
            {customDiagnoses.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {customDiagnoses.map((d) => (
                  <span
                    key={d}
                    className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => setDiagnoses((prev) => prev.filter((x) => x !== d))}
                      aria-label={`Remover ${d}`}
                    >
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Botão cadastrar (com diagnósticos) */}
            <button
              type="button"
              onClick={() => void handleFinalSubmit(diagnoses)}
              disabled={submitting}
              className="mt-3 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW, letterSpacing: "-0.005em" }}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar
            </button>

            {/* Pular */}
            <button
              type="button"
              onClick={() => void handleFinalSubmit([])}
              disabled={submitting}
              className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151] disabled:opacity-50"
              style={{ color: "#6B7280" }}
            >
              Pular esta etapa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
