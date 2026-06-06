import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, X, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useCreatePatientWithGuardians } from "@/services/therapist.service";
import type { TherapistPatientWithGuardiansInput, GuardianInput } from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/onboarding_/terapeuta_/pacientes")({
  head: () => ({
    meta: [{ title: "Adicione seus pacientes — TEAmo" }],
  }),
  component: TherapistPacientesPage,
});

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition-all"
          style={{ background: i < step ? TEAL : "#E5E7EB" }}
        />
      ))}
    </div>
  );
}

interface PatientDraft {
  id: string;
  name: string;
  guardians: GuardianInput[];
}

function TherapistPacientesPage() {
  const navigate = useNavigate();
  const createPatient = useCreatePatientWithGuardians();

  // Lista de pacientes já adicionados
  const [addedPatients, setAddedPatients] = useState<PatientDraft[]>([]);

  // Formulário do paciente atual
  const [patientName, setPatientName] = useState("");
  const [guardians, setGuardians] = useState<GuardianInput[]>([{ name: "", email: "" }]);
  const [nameError, setNameError] = useState("");
  const [guardianErrors, setGuardianErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addGuardian = () => {
    if (guardians.length >= 4) return;
    setGuardians([...guardians, { name: "", email: "" }]);
  };

  const removeGuardian = (i: number) => {
    if (guardians.length <= 1) return;
    setGuardians(guardians.filter((_, idx) => idx !== i));
    setGuardianErrors([]);
  };

  const updateGuardian = (i: number, field: keyof GuardianInput, value: string) => {
    const next = [...guardians];
    next[i] = { ...next[i], [field]: value };
    setGuardians(next);
  };

  const validateAndAdd = () => {
    let valid = true;
    if (!patientName.trim()) {
      setNameError("Informe o primeiro nome do paciente.");
      valid = false;
    } else {
      setNameError("");
    }

    const errs = guardians.map((g) => {
      if (!g.name.trim()) return "Informe o nome do responsável.";
      if (g.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email)) return "E-mail inválido.";
      return "";
    });
    setGuardianErrors(errs);
    if (errs.some(Boolean)) valid = false;

    if (!valid) return;

    const draft: PatientDraft = {
      id: crypto.randomUUID(),
      name: patientName.trim(),
      guardians: guardians.map((g) => ({ name: g.name.trim(), email: g.email?.trim() || undefined })),
    };

    setAddedPatients((prev) => [...prev, draft]);
    // Limpa formulário
    setPatientName("");
    setGuardians([{ name: "", email: "" }]);
    setNameError("");
    setGuardianErrors([]);
  };

  const removePatient = (id: string) => {
    setAddedPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const handleConclude = async () => {
    setSubmitting(true);
    try {
      let hasEmails = false;

      // Salva todos os pacientes adicionados
      for (const p of addedPatients) {
        const hasEmail = p.guardians.some((g) => g.email);
        if (hasEmail) hasEmails = true;
        await createPatient.mutateAsync({ name: p.name, guardians: p.guardians, diagnoses: [] });
      }

      // Guarda estado para a tela de conclusão
      const result =
        addedPatients.length === 0
          ? "semPacientes"
          : hasEmails
          ? "comEmails"
          : "semEmails";

      sessionStorage.setItem("teamo:onboarding:therapist:result", result);
      navigate({ to: "/onboarding/terapeuta/conclusao" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar pacientes.");
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    sessionStorage.setItem("teamo:onboarding:therapist:result", "semPacientes");
    navigate({ to: "/onboarding/terapeuta/conclusao" });
  };

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-[480px] px-4 py-6">
        <ProgressBar step={2} total={3} />

        <div className="mb-6">
          <h1 className="text-[24px] font-extrabold text-[#0F172A] leading-tight mb-2">
            Adicione seus pacientes
          </h1>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Adicione seus pacientes para começar a usar o TEAmo. Esta é a primeira etapa para organizar os atendimentos e conectar as famílias. Você pode adicionar mais pacientes a qualquer momento.
          </p>
        </div>

        {/* Lista de pacientes já adicionados */}
        {addedPatients.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {addedPatients.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
                style={{ borderColor: TEAL_BORDER, background: TEAL_SOFT }}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[14px] font-bold"
                  style={{ background: TEAL_BORDER, color: TEAL }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-[#0F172A] truncate">{p.name}</p>
                  <p className="text-[12px] text-[#6B7280] truncate">
                    {p.guardians.map((g) => g.name).join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removePatient(p.id)}
                  aria-label="Remover paciente"
                  className="flex-shrink-0 p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulário do próximo paciente */}
        <div
          className="rounded-[18px] border p-5"
          style={{ borderColor: "#E5E7EB", background: "#FAFAFA" }}
        >
          <p className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide mb-4">
            {addedPatients.length === 0 ? "Primeiro paciente" : "Adicionar outro paciente"}
          </p>

          {/* Nome do paciente */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              Primeiro nome da criança
            </label>
            <input
              type="text"
              placeholder="Como você chama seu paciente?"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value.slice(0, 60))}
              className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            />
            {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
          </div>

          {/* Responsáveis */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              Responsáveis
            </label>
            <div className="flex flex-col gap-3">
              {guardians.map((g, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome do responsável"
                      value={g.name}
                      onChange={(e) => updateGuardian(i, "name", e.target.value.slice(0, 80))}
                      className="h-11 flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                    />
                    {guardians.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeGuardian(i)}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#DC2626] hover:border-red-200 transition-colors"
                      >
                        <Trash2 size={15} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                  <input
                    type="email"
                    placeholder="E-mail para convite (opcional)"
                    value={g.email ?? ""}
                    onChange={(e) => updateGuardian(i, "email", e.target.value)}
                    className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                  {guardianErrors[i] && (
                    <p className="text-xs text-red-500">{guardianErrors[i]}</p>
                  )}
                </div>
              ))}

              {guardians.length < 4 && (
                <button
                  type="button"
                  onClick={addGuardian}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors"
                  style={{ color: TEAL }}
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Adicionar outro responsável
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Se preenchido, o convite será enviado automaticamente ao concluir o onboarding.
            </p>
          </div>

          {/* Botão adicionar paciente */}
          <button
            type="button"
            onClick={validateAndAdd}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-sm font-semibold transition-colors"
            style={{ borderColor: TEAL_BORDER, color: TEAL, background: "white" }}
          >
            <UserRound size={15} strokeWidth={2} />
            Adicionar paciente
          </button>
        </div>

        {/* Rodapé */}
        <button
          type="button"
          onClick={() => void handleConclude()}
          disabled={submitting}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl text-white text-[15px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
          style={{ background: TEAL }}
        >
          {submitting ? "Salvando…" : "Concluir"}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          className="mt-3 h-10 w-full text-center text-sm text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
        >
          Adicionar depois
        </button>
      </div>
    </AppShell>
  );
}
