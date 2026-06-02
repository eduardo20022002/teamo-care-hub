import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowRight, ArrowLeft, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useUpsertTherapistProfile, useCreatePatient, useTherapistProfile } from "@/services/therapist.service";
import {
  THERAPIST_SPECIALTIES,
  COUNCIL_TYPES,
  BR_STATES,
  therapistProfileSchema,
  therapistPatientSchema,
} from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/onboarding/terapeuta")({
  head: () => ({
    meta: [{ title: "Cadastro profissional — TEAmo" }],
  }),
  component: TherapistOnboardingPage,
});

type Step = 1 | 2 | 3;

function StepIndicator({ step, total }: { step: Step; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition-colors"
          style={{ background: i < step ? TEAL : "#E5E7EB" }}
        />
      ))}
    </div>
  );
}

function TherapistOnboardingPage() {
  const navigate = useNavigate();
  const upsertProfile = useUpsertTherapistProfile();
  const createPatient = useCreatePatient();
  // Se o perfil de terapeuta já existe, o usuário está adicionando paciente via dashboard
  // e deve ter um botão de voltar.
  const therapistProfileQuery = useTherapistProfile();
  const hasExistingProfile = !!therapistProfileQuery.data?.profile;

  const [step, setStep] = useState<Step>(1);

  // Step 1 — Especialidade
  const [specialty, setSpecialty] = useState("");

  // Step 2 — Conselho
  const [councilType, setCouncilType] = useState("");
  const [councilNumber, setCouncilNumber] = useState("");
  const [councilState, setCouncilState] = useState("");
  const [bio, setBio] = useState("");
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Step 3 — Primeiro paciente (opcional)
  const [patientName, setPatientName] = useState("");
  const [patientBirthDate, setPatientBirthDate] = useState("");
  const [patientDiagnosis, setPatientDiagnosis] = useState("");
  const [step3Errors, setStep3Errors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // ─── Step 1: seleciona especialidade ────────────────────────────────────────

  const handleStep1Next = () => {
    if (!specialty) {
      toast.error("Selecione sua especialidade.");
      return;
    }
    setStep(2);
  };

  // ─── Step 2: conselho + bio ──────────────────────────────────────────────────

  const handleStep2Next = async () => {
    const parsed = therapistProfileSchema.safeParse({
      specialty,
      councilType,
      councilNumber,
      councilState,
      bio: bio || undefined,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setStep2Errors(errs);
      return;
    }
    setStep2Errors({});

    setSubmitting(true);
    try {
      await upsertProfile.mutateAsync(parsed.data);
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar perfil.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step 3: primeiro paciente (pode pular) ──────────────────────────────────

  const handleAddPatient = async () => {
    if (!patientName.trim() || !patientBirthDate) {
      setStep3Errors({
        ...(patientName.trim() ? {} : { name: "Informe o nome do paciente." }),
        ...(patientBirthDate ? {} : { birthDate: "Informe a data de nascimento." }),
      });
      return;
    }

    const parsed = therapistPatientSchema.safeParse({
      name:      patientName,
      birthDate: patientBirthDate,
      diagnosis: patientDiagnosis || undefined,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setStep3Errors(errs);
      return;
    }
    setStep3Errors({});

    setSubmitting(true);
    try {
      await createPatient.mutateAsync(parsed.data);
      toast.success("Paciente cadastrado com sucesso!");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar paciente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipPatient = () => {
    navigate({ to: "/dashboard" });
  };

  return (
    <AppShell
      hideMenu
      onBack={hasExistingProfile ? () => navigate({ to: "/dashboard" }) : undefined}
    >
      <div className="mx-auto max-w-[480px] px-4 py-6">
        <StepIndicator step={step} total={3} />

        {/* ─── STEP 1: Especialidade ─────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: TEAL_SOFT, border: `1px solid ${TEAL_BORDER}` }}
            >
              <Stethoscope size={26} color={TEAL} strokeWidth={1.7} />
            </div>
            <h1 className="text-[24px] font-extrabold text-center text-[#0F172A] leading-tight mb-1">
              Qual é a sua área?
            </h1>
            <p className="text-sm text-center text-[#6B7280] mb-6">
              Selecione a especialidade que melhor descreve sua atuação.
            </p>

            <div className="grid grid-cols-2 gap-2.5 mb-8">
              {THERAPIST_SPECIALTIES.map((s) => {
                const selected = specialty === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpecialty(s)}
                    className="flex items-center gap-2.5 rounded-xl border-2 px-3 py-3.5 text-left text-[13.5px] font-medium transition-all"
                    style={{
                      borderColor: selected ? TEAL : "#E5E7EB",
                      background:  selected ? TEAL_SOFT : "#FAFAFA",
                      color:       selected ? "#0F766E" : "#374151",
                      boxShadow:   selected ? `0 0 0 1px ${TEAL}` : "none",
                    }}
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ background: selected ? TEAL : "#D1D5DB" }}
                    />
                    {s}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleStep1Next}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-white text-[15px] font-bold transition-all hover:-translate-y-px"
              style={{ background: TEAL }}
            >
              Continuar
              <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* ─── STEP 2: Conselho + Bio ────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="text-[24px] font-extrabold text-[#0F172A] leading-tight mb-1">
              Registro profissional
            </h1>
            <p className="text-sm text-[#6B7280] mb-6">
              Essas informações aparecem para os responsáveis dos pacientes.
            </p>

            <div className="flex flex-col gap-4">
              {/* Tipo de conselho */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">Conselho</label>
                <select
                  value={councilType}
                  onChange={(e) => setCouncilType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                >
                  <option value="">Selecione…</option>
                  {COUNCIL_TYPES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {step2Errors.councilType && (
                  <p className="text-xs text-red-500">{step2Errors.councilType}</p>
                )}
              </div>

              {/* Número do conselho */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">Número do registro</label>
                <input
                  type="text"
                  placeholder="Ex: 06/123456"
                  value={councilNumber}
                  onChange={(e) => setCouncilNumber(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                {step2Errors.councilNumber && (
                  <p className="text-xs text-red-500">{step2Errors.councilNumber}</p>
                )}
              </div>

              {/* Estado */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">Estado (UF)</label>
                <select
                  value={councilState}
                  onChange={(e) => setCouncilState(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                >
                  <option value="">Selecione…</option>
                  {BR_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {step2Errors.councilState && (
                  <p className="text-xs text-red-500">{step2Errors.councilState}</p>
                )}
              </div>

              {/* Bio (opcional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">
                  Bio breve <span className="text-[#9CA3AF] font-normal">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Apresentação breve para os responsáveis…"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm text-[#374151] placeholder:text-[#9CA3AF] resize-none focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                <p className="text-xs text-[#9CA3AF] text-right">{bio.length}/500</p>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => void handleStep2Next()}
                disabled={submitting}
                className="flex flex-1 h-12 items-center justify-center gap-2 rounded-xl text-white text-[15px] font-bold disabled:opacity-60"
                style={{ background: TEAL }}
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Continuar
                    <ArrowRight size={16} strokeWidth={2} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Primeiro paciente ─────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 className="text-[24px] font-extrabold text-[#0F172A] leading-tight mb-1">
              Adicione seu primeiro paciente
            </h1>
            <p className="text-sm text-[#6B7280] mb-6">
              Você pode pular e adicionar pacientes depois pelo painel.
            </p>

            <div className="flex flex-col gap-4">
              {/* Nome */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">Nome do paciente</label>
                <input
                  type="text"
                  placeholder="Nome completo ou apelido"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                {step3Errors.name && (
                  <p className="text-xs text-red-500">{step3Errors.name}</p>
                )}
              </div>

              {/* Data de nascimento */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">Data de nascimento</label>
                <input
                  type="date"
                  value={patientBirthDate}
                  onChange={(e) => setPatientBirthDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
                {step3Errors.birthDate && (
                  <p className="text-xs text-red-500">{step3Errors.birthDate}</p>
                )}
              </div>

              {/* Diagnóstico (opcional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#374151]">
                  Diagnóstico <span className="text-[#9CA3AF] font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: TEA nível 2"
                  value={patientDiagnosis}
                  onChange={(e) => setPatientDiagnosis(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleAddPatient()}
              disabled={submitting}
              className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-white text-[15px] font-bold disabled:opacity-60"
              style={{ background: TEAL }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Adicionar paciente e continuar"
              )}
            </button>

            <button
              type="button"
              onClick={handleSkipPatient}
              disabled={submitting}
              className="mt-3 h-12 w-full rounded-xl text-[15px] font-semibold text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors"
            >
              Pular por agora
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
