/**
 * /pacientes/novo — Cadastro de novo paciente pelo terapeuta.
 * Rota independente do onboarding; acessada via "Adicionar" no dashboard.
 * Design: área do terapeuta (teal #0D9488).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useCreatePatientWithGuardians } from "@/services/therapist.service";

// ─── Design tokens ────────────────────────────────────────────────────────────
const TEAL        = "#0D9488";
const TEAL_SOFT   = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

// ─── Rota ─────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/_auth/pacientes/novo")({
  head: () => ({ meta: [{ title: "Novo paciente — TEAmo" }] }),
  component: NovoPackientePage,
});

// ─── Lista de diagnósticos ────────────────────────────────────────────────────
const DIAGNOSIS_OPTIONS = [
  "TEA (Transtorno do Espectro Autista)",
  "TDAH (Déficit de Atenção e Hiperatividade)",
  "Deficiência Intelectual (DI)",
  "Ansiedade",
  "Depressão",
  "TOD (Transtorno Opositivo Desafiador)",
  "TOC (Transtorno Obsessivo-Compulsivo)",
  "Transtorno do Sono",
  "Síndrome de Down",
  "Síndrome de Rett",
  "Epilepsia / Convulsões",
  "Transtorno do Processamento Sensorial",
  "Outro",
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface GuardianDraft {
  id: string;
  name: string;
  email: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputClasses(error?: boolean) {
  return [
    "h-11 w-full rounded-xl border bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF]",
    "focus:outline-none focus:ring-2 focus:ring-[#0D9488] transition-shadow",
    error ? "border-red-400" : "border-[#E5E7EB]",
  ].join(" ");
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em]"
      style={{ color: TEAL }}
    >
      {children}
    </p>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────
function NovoPackientePage() {
  const navigate = useNavigate();
  const createPatient = useCreatePatientWithGuardians();

  // Form state
  const [name, setName]           = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [diagnoses, setDiagnoses] = useState<string[]>([]);
  const [guardians, setGuardians] = useState<GuardianDraft[]>([
    { id: uid(), name: "", email: "" },
  ]);

  // Validation errors
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Diagnoses toggle
  const toggleDiagnosis = (d: string) => {
    setDiagnoses((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  };

  // Guardians management
  const updateGuardian = (id: string, field: "name" | "email", value: string) => {
    setGuardians((prev) =>
      prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)),
    );
  };
  const addGuardian = () => {
    if (guardians.length < 4) setGuardians((prev) => [...prev, { id: uid(), name: "", email: "" }]);
  };
  const removeGuardian = (id: string) => {
    setGuardians((prev) => prev.filter((g) => g.id !== id));
  };

  // Submit
  const handleSubmit = async () => {
    // Validate
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Informe o nome do paciente.");
      return;
    }
    setNameError("");

    // Build guardians list (only non-empty)
    const validGuardians = guardians
      .filter((g) => g.name.trim())
      .map((g) => ({ name: g.name.trim(), email: g.email.trim() || undefined }));

    setSubmitting(true);
    try {
      await createPatient.mutateAsync({
        name: trimmedName,
        birthDate: birthDate || undefined,
        diagnoses,
        guardians: validGuardians,
      });
      toast.success("Paciente cadastrado!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar paciente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell hideMenu onBack={() => navigate({ to: "/dashboard" })}>
      <div className="mx-auto max-w-[480px] px-4 pb-12 pt-2">

        {/* ── Cabeçalho ── */}
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: TEAL_SOFT }}
          >
            <UserRound size={20} strokeWidth={1.7} color={TEAL} />
          </div>
          <div>
            <h1
              className="text-[22px] font-extrabold leading-tight"
              style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
            >
              Novo paciente
            </h1>
            <p className="text-[13px]" style={{ color: "#6B7280" }}>
              Preencha os dados do paciente para começar.
            </p>
          </div>
        </div>

        {/* ── Card do formulário ── */}
        <div
          className="rounded-[20px] border bg-white px-5 py-6"
          style={{ borderColor: "#EEF0F4" }}
        >

          {/* Nome */}
          <div className="mb-5">
            <SectionLabel>Nome do paciente</SectionLabel>
            <input
              type="text"
              placeholder="Primeiro nome da criança"
              maxLength={60}
              value={name}
              onChange={(e) => { setName(e.target.value); setNameError(""); }}
              className={inputClasses(!!nameError)}
            />
            {nameError && (
              <p className="mt-1 text-[12px]" style={{ color: "#DC2626" }}>
                {nameError}
              </p>
            )}
          </div>

          {/* Data de nascimento */}
          <div className="mb-5">
            <SectionLabel>
              Data de nascimento{" "}
              <span className="normal-case text-[#9CA3AF] font-normal">(opcional)</span>
            </SectionLabel>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className={inputClasses()}
            />
          </div>

          {/* Diagnósticos */}
          <div className="mb-5">
            <SectionLabel>
              Diagnósticos{" "}
              <span className="normal-case text-[#9CA3AF] font-normal">(selecione todos que se aplicam)</span>
            </SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {DIAGNOSIS_OPTIONS.map((d) => {
                const selected = diagnoses.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDiagnosis(d)}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-medium transition-all"
                    style={
                      selected
                        ? { borderColor: TEAL, background: TEAL_SOFT, color: TEAL }
                        : { borderColor: "#E5E7EB", background: "#FAFAFA", color: "#374151" }
                    }
                  >
                    {/* Custom checkbox */}
                    <span
                      className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-all"
                      style={
                        selected
                          ? { borderColor: TEAL, background: TEAL }
                          : { borderColor: "#D1D5DB", background: "white" }
                      }
                    >
                      {selected && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="leading-tight">{d}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Responsáveis */}
          <div>
            <SectionLabel>
              Responsáveis{" "}
              <span className="normal-case text-[#9CA3AF] font-normal">(opcional)</span>
            </SectionLabel>
            <p className="mb-3 text-[12px]" style={{ color: "#6B7280" }}>
              Informe o e-mail para enviar um convite de acesso ao TEAmo.
            </p>
            <div className="flex flex-col gap-3">
              {guardians.map((g, idx) => (
                <div
                  key={g.id}
                  className="rounded-xl border p-3"
                  style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-bold" style={{ color: TEAL }}>
                      Responsável {idx + 1}
                    </span>
                    {guardians.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGuardian(g.id)}
                        className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white"
                      >
                        <X size={13} color={TEAL} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Nome do responsável"
                      maxLength={80}
                      value={g.name}
                      onChange={(e) => updateGuardian(g.id, "name", e.target.value)}
                      className="h-10 w-full rounded-xl border border-white/60 bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                    />
                    <input
                      type="email"
                      placeholder="email@exemplo.com (opcional)"
                      value={g.email}
                      onChange={(e) => updateGuardian(g.id, "email", e.target.value)}
                      className="h-10 w-full rounded-xl border border-white/60 bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                    />
                  </div>
                </div>
              ))}

              {guardians.length < 4 && (
                <button
                  type="button"
                  onClick={addGuardian}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed text-[13px] font-bold transition-colors hover:bg-[#F0FDFA]"
                  style={{ borderColor: TEAL_BORDER, color: TEAL }}
                >
                  <Plus size={15} strokeWidth={2.2} />
                  Adicionar responsável
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Botão de submit ── */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="mt-6 flex h-13 w-full items-center justify-center rounded-xl text-[15px] font-bold text-white transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-50"
          style={{ background: TEAL, height: "52px" }}
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            "Cadastrar paciente"
          )}
        </button>
      </div>
    </AppShell>
  );
}
