import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useSaveTherapistProfileQuestions } from "@/services/therapist.service";
import {
  ATTENDANCE_SETTINGS,
  ATTENDANCE_SETTING_LABELS,
  ATTENDANCE_MODALITIES,
  ATTENDANCE_MODALITY_LABELS,
  PATIENT_COUNT_RANGES,
  PATIENT_COUNT_RANGE_LABELS,
  WEEKLY_HOURS_RANGES,
  WEEKLY_HOURS_RANGE_LABELS,
} from "@/lib/validation";

const TEAL = "#0D9488";
const TEAL_SOFT = "#F0FDFA";
const TEAL_BORDER = "#CCFBF1";

export const Route = createFileRoute("/_auth/onboarding/terapeuta/perfil")({
  head: () => ({
    meta: [{ title: "Configurando seu perfil — TEAmo" }],
  }),
  component: TherapistPerfilPage,
});

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition-all duration-300"
          style={{ background: i < step ? TEAL : "#E5E7EB" }}
        />
      ))}
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-7">
      <p className="text-[14px] font-semibold text-[#374151] mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className="rounded-full px-4 py-2 text-[13.5px] font-medium border transition-all"
              style={
                selected
                  ? {
                      background: TEAL,
                      color: "#fff",
                      borderColor: TEAL,
                      boxShadow: `0 0 0 2px ${TEAL}22`,
                    }
                  : {
                      background: TEAL_SOFT,
                      color: "#374151",
                      borderColor: TEAL_BORDER,
                    }
              }
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TherapistPerfilPage() {
  const navigate = useNavigate();
  const saveQuestions = useSaveTherapistProfileQuestions();

  const [attendanceSetting, setAttendanceSetting] =
    useState<(typeof ATTENDANCE_SETTINGS)[number] | undefined>();
  const [attendanceModality, setAttendanceModality] =
    useState<(typeof ATTENDANCE_MODALITIES)[number] | undefined>();
  const [patientCountRange, setPatientCountRange] =
    useState<(typeof PATIENT_COUNT_RANGES)[number] | undefined>();
  const [weeklyHoursRange, setWeeklyHoursRange] =
    useState<(typeof WEEKLY_HOURS_RANGES)[number] | undefined>();

  const handleContinue = async () => {
    try {
      await saveQuestions.mutateAsync({
        attendanceSetting,
        attendanceModality,
        patientCountRange,
        weeklyHoursRange,
      });
    } catch {
      // Não bloqueia a navegação — as respostas são opcionais
    }
    navigate({ to: "/onboarding/terapeuta/pacientes" });
  };

  const handleSkip = () => {
    navigate({ to: "/onboarding/terapeuta/pacientes" });
  };

  return (
    <AppShell hideMenu>
      <div className="mx-auto max-w-[480px] px-4 py-6">
        <ProgressBar step={1} total={3} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-[24px] font-extrabold text-[#0F172A] leading-tight mb-2">
            Conte um pouco sobre sua prática
          </h1>
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Essas informações nos ajudam a personalizar o TEAmo para você. Todas as respostas são opcionais.
          </p>
        </div>

        {/* Perguntas */}
        <ChipGroup
          label="Onde você atende?"
          options={ATTENDANCE_SETTINGS}
          labels={ATTENDANCE_SETTING_LABELS}
          value={attendanceSetting}
          onChange={setAttendanceSetting}
        />

        <ChipGroup
          label="Modalidade de atendimento"
          options={ATTENDANCE_MODALITIES}
          labels={ATTENDANCE_MODALITY_LABELS}
          value={attendanceModality}
          onChange={setAttendanceModality}
        />

        <ChipGroup
          label="Quantos pacientes você atende atualmente?"
          options={PATIENT_COUNT_RANGES}
          labels={PATIENT_COUNT_RANGE_LABELS}
          value={patientCountRange}
          onChange={setPatientCountRange}
        />

        <ChipGroup
          label="Quantas horas de sessão por semana?"
          options={WEEKLY_HOURS_RANGES}
          labels={WEEKLY_HOURS_RANGE_LABELS}
          value={weeklyHoursRange}
          onChange={setWeeklyHoursRange}
        />

        {/* Ações */}
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={saveQuestions.isPending}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-white text-[15px] font-bold transition-all hover:-translate-y-px disabled:opacity-60"
          style={{ background: TEAL }}
        >
          Continuar
          <ArrowRight size={16} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="mt-3 h-10 w-full text-center text-sm text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
        >
          Pular esta etapa
        </button>
      </div>
    </AppShell>
  );
}
