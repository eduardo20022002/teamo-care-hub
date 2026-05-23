import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { OnboardingShell } from "@/components/agenda/OnboardingShell";
import { TypeIcon } from "@/components/agenda/icons";
import {
  AGENDA_BRAND,
  BRAND_GRADIENT,
  BRAND_SHADOW,
  PASTEL_GRADIENT,
  TYPE_STYLES,
} from "@/lib/agenda/tokens";
import type { AgendaEventType } from "@/types/agenda";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import { createAgendaEvent } from "@/services/agenda/events.service";
import { upsertNotificationPrefs } from "@/services/agenda/prefs.service";
import type { AgendaEventInput } from "@/lib/agenda/validation";
import { defaultTypeData } from "@/lib/agenda/defaults";

export const Route = createFileRoute("/_auth/agenda_/onboarding")({
  head: () => ({ meta: [{ title: "Agenda · Tutorial — TEAmo" }] }),
  component: AgendaOnboardingPage,
});

type Step = 1 | 2 | 3 | 4;

interface RoutineProfile {
  active: boolean;
  freq: "weekly" | "biweekly" | "monthly" | "daily" | null;
  daysOfWeek: number[];
  time: string; // HH:MM
  professionalId: string;
}

interface RoutineSuggestion {
  id: string;
  type: AgendaEventType;
  title: string;
}

const SUGGESTIONS: RoutineSuggestion[] = [
  { id: "s-aba", type: "terapia", title: "Terapia ABA" },
  { id: "s-med", type: "medicacao", title: "Medicação diária" },
  { id: "s-fono", type: "terapia", title: "Fonoaudiologia" },
  { id: "s-neuro", type: "consulta", title: "Consulta neuropediátrica" },
  { id: "s-aee", type: "escola", title: "Reunião AEE" },
];

function emptyProfile(): RoutineProfile {
  return {
    active: false,
    freq: null,
    daysOfWeek: [],
    time: "",
    professionalId: "",
  };
}

function AgendaOnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);

  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user,
  });
  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user,
  });

  const childName = childrenQuery.data?.[0]?.name ?? "seu filho";
  const childId = childrenQuery.data?.[0]?.id ?? null;

  // Estado das rotinas (persistido entre expand/collapse pelo brief)
  const [routines, setRoutines] = useState<Record<string, RoutineProfile>>(
    () => Object.fromEntries(SUGGESTIONS.map((s) => [s.id, emptyProfile()])),
  );

  const [reminderPrefs, setReminderPrefs] = useState({
    oneDayBefore: true,
    oneHourBefore: true,
    pendingObservations: true,
    postEventRegister: false,
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão.");
      const activeRoutines = SUGGESTIONS.filter((s) => routines[s.id].active);
      const createdAt: AgendaEventInput[] = [];
      for (const s of activeRoutines) {
        const r = routines[s.id];
        if (!r.freq || !r.time) continue;
        if (!childId) continue;
        const nextDate = nextOccurrenceForRoutine(r);
        createdAt.push({
          child_id: childId,
          type: s.type,
          title: s.title,
          professional_id: r.professionalId || null,
          professional_name_raw: null,
          date: nextDate,
          start_time: r.time,
          end_time: "",
          locale: "",
          recurrence:
            r.freq === "weekly" && r.daysOfWeek.length > 0
              ? { freq: "weekly", daysOfWeek: r.daysOfWeek }
              : { freq: r.freq },
          reminders: {
            oneDayBefore: reminderPrefs.oneDayBefore,
            oneHourBefore: reminderPrefs.oneHourBefore,
          },
          type_data: {
            kind: s.type,
            ...defaultTypeData(s.type),
          } as AgendaEventInput["type_data"],
        });
      }
      for (const input of createdAt) {
        await createAgendaEvent(user.id, input);
      }
      await upsertNotificationPrefs(user.id, {
        one_day_before: reminderPrefs.oneDayBefore,
        one_hour_before: reminderPrefs.oneHourBefore,
        pending_observations: reminderPrefs.pendingObservations,
        post_event_register: reminderPrefs.postEventRegister,
        onboarding_completed: true,
      });
      return createdAt.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      toast.success(
        count > 0
          ? `Tudo pronto. ${count} ${count === 1 ? "rotina cadastrada" : "rotinas cadastradas"}.`
          : "Pronto. Você pode adicionar compromissos quando quiser.",
      );
      navigate({ to: "/agenda" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skipToEmpty = async () => {
    if (user) {
      try {
        await upsertNotificationPrefs(user.id, {
          one_day_before: reminderPrefs.oneDayBefore,
          one_hour_before: reminderPrefs.oneHourBefore,
          pending_observations: reminderPrefs.pendingObservations,
          post_event_register: reminderPrefs.postEventRegister,
          onboarding_completed: true,
        });
        qc.invalidateQueries({ queryKey: ["agenda-prefs", user.id] });
      } catch {
        // Não conseguimos persistir — guardamos localmente pra não ficar em loop
        // de redirect com /agenda. O fluxo principal segue.
        try {
          window.localStorage.setItem(
            `agenda_onboarding_skipped:${user.id}`,
            "1",
          );
        } catch {
          /* localStorage indisponível — segue */
        }
      }
    }
    navigate({ to: "/agenda" });
  };

  const activeCount = SUGGESTIONS.filter(
    (s) => routines[s.id].active,
  ).length;

  return (
    <>
      {step === 1 && (
        <StepWelcome
          childName={childName}
          onContinue={() => setStep(2)}
          onSkip={skipToEmpty}
        />
      )}
      {step === 2 && (
        <StepTypes
          onContinue={() => setStep(3)}
          onSkip={skipToEmpty}
        />
      )}
      {step === 3 && (
        <StepRoutines
          childName={childName}
          routines={routines}
          setRoutines={setRoutines}
          activeCount={activeCount}
          professionals={professionalsQuery.data ?? []}
          onContinue={() => setStep(4)}
          onSkip={skipToEmpty}
        />
      )}
      {step === 4 && (
        <StepReminders
          prefs={reminderPrefs}
          setPrefs={setReminderPrefs}
          onFinish={() => finishMutation.mutate()}
          submitting={finishMutation.isPending}
          onSkip={skipToEmpty}
        />
      )}
    </>
  );
}

// ============================================================
// STEP 1 — Welcome
// ============================================================
function StepWelcome({
  childName,
  onContinue,
  onSkip,
}: {
  childName: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{
        background: PASTEL_GRADIENT,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div className="flex justify-end px-4 pt-4">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors"
          style={{ background: "rgba(255,255,255,0.6)", color: "#0F172A" }}
        >
          Pular tutorial
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
        <WelcomeIllustration />
        <div
          className="mb-3.5 inline-block rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{
            color: AGENDA_BRAND.col,
            boxShadow: "0 2px 6px -2px rgba(124,58,237,0.2)",
          }}
        >
          Bem-vinda à Agenda
        </div>
        <h1
          className="mb-3 text-[28px] font-extrabold leading-tight"
          style={{
            color: "#0F172A",
            letterSpacing: "-0.025em",
            maxWidth: 280,
          }}
        >
          Vamos organizar a rotina do {childName}
        </h1>
        <p
          className="text-[14.5px] leading-relaxed"
          style={{ color: "#475569", maxWidth: 290 }}
        >
          Em 3 passos rápidos a gente cadastra os compromissos que já fazem
          parte da semana — e você sai daqui pronta pra usar.
        </p>
      </div>
      <div className="px-5 pb-6 pt-3.5">
        <button
          type="button"
          onClick={onContinue}
          className="flex h-[50px] w-full items-center justify-center rounded-xl text-[15px] font-bold text-white transition-transform hover:-translate-y-px"
          style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
        >
          Vamos começar
        </button>
      </div>
    </div>
  );
}

function WelcomeIllustration() {
  return (
    <div className="relative mb-7 h-[200px] w-[200px]">
      <div
        className="absolute inset-0 rounded-[28px] bg-white"
        style={{
          boxShadow:
            "0 30px 60px -25px rgba(124,58,237,0.35), 0 12px 24px -12px rgba(124,58,237,0.25)",
        }}
      />
      <div
        className="absolute flex flex-col overflow-hidden rounded-[18px]"
        style={{ inset: 18, background: "#FAFBFD" }}
      >
        <div
          className="flex h-[38px] items-center justify-between px-3.5"
          style={{ background: AGENDA_BRAND.col }}
        >
          <span
            className="text-[13px] font-extrabold text-white"
            style={{ letterSpacing: "-0.01em" }}
          >
            Maio
          </span>
          <div className="flex gap-1">
            <span className="h-2 w-1.5 rounded-[2px] bg-white" />
            <span className="h-2 w-1.5 rounded-[2px] bg-white" />
          </div>
        </div>
        <div
          className="grid flex-1 grid-cols-7 gap-[3px] p-2"
          style={{ gridAutoRows: "1fr" }}
        >
          {Array.from({ length: 28 }).map((_, i) => {
            const filled = [4, 5, 11, 17, 22].includes(i);
            return (
              <div
                key={i}
                className="relative rounded-[4px]"
                style={{
                  background: filled ? AGENDA_BRAND.tint : "transparent",
                  aspectRatio: "1",
                }}
              >
                {i === 11 && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#EC4899]" />
                )}
                {i === 17 && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#4F46E5]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div
        className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-white"
        style={{
          top: -8,
          right: -8,
          boxShadow: "0 8px 20px -4px rgba(124,58,237,0.3)",
        }}
      >
        <Sparkles size={18} strokeWidth={1.6} color={AGENDA_BRAND.col} />
      </div>
    </div>
  );
}

// ============================================================
// STEP 2 — Types
// ============================================================
function StepTypes({
  onContinue,
  onSkip,
}: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  const items: Array<{ type: AgendaEventType; desc: string }> = [
    { type: "terapia", desc: "ABA, fonoaudiologia, psicomotricidade…" },
    { type: "consulta", desc: "Neuropediatra, retornos, exames…" },
    { type: "escola", desc: "Reunião AEE, conselho, eventos…" },
    { type: "medicacao", desc: "Doses recorrentes diárias." },
    { type: "outro", desc: "Passeio sensorial, terapia em casa…" },
  ];
  return (
    <OnboardingShell
      step={2}
      onSkip={onSkip}
      primary={
        <button
          type="button"
          onClick={onContinue}
          className="flex h-[50px] w-full items-center justify-center rounded-xl text-[15px] font-bold text-white transition-transform hover:-translate-y-px"
          style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
        >
          Entendi, continuar
        </button>
      }
    >
      <h1
        className="mb-2 mt-2 text-2xl font-extrabold leading-tight"
        style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
      >
        Cada compromisso tem um tipo
      </h1>
      <p
        className="mb-[22px] text-sm leading-relaxed"
        style={{ color: "#6B7280" }}
      >
        Isso ajuda você a enxergar a rotina com clareza — e a gente colore
        tudo pra ficar fácil de encontrar.
      </p>
      <div className="flex flex-col gap-2.5">
        {items.map(({ type, desc }) => {
          const t = TYPE_STYLES[type];
          return (
            <div
              key={type}
              className="flex items-center gap-3 rounded-[14px] border bg-white px-3.5 py-3"
              style={{ borderColor: "#EEF0F4" }}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: t.tint }}
              >
                <TypeIcon type={type} size={20} color={t.col} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[14.5px] font-bold"
                  style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
                >
                  {t.label}
                </div>
                <div
                  className="mt-0.5 text-[12.5px] leading-snug"
                  style={{ color: "#6B7280" }}
                >
                  {desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </OnboardingShell>
  );
}

// ============================================================
// STEP 3 — Routines (editáveis inline)
// ============================================================
function StepRoutines({
  childName,
  routines,
  setRoutines,
  activeCount,
  professionals,
  onContinue,
  onSkip,
}: {
  childName: string;
  routines: Record<string, RoutineProfile>;
  setRoutines: (
    setter: (
      r: Record<string, RoutineProfile>,
    ) => Record<string, RoutineProfile>,
  ) => void;
  activeCount: number;
  professionals: Array<{ id: string; name: string }>;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const toggleActive = (id: string) =>
    setRoutines((prev) => ({
      ...prev,
      [id]: { ...prev[id], active: !prev[id].active },
    }));
  const setField = <K extends keyof RoutineProfile>(
    id: string,
    key: K,
    value: RoutineProfile[K],
  ) =>
    setRoutines((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: value },
    }));
  return (
    <OnboardingShell
      step={3}
      onSkip={onSkip}
      primary={
        <div>
          <button
            type="button"
            onClick={onContinue}
            className="flex h-[50px] w-full items-center justify-center rounded-xl text-[15px] font-bold text-white transition-transform hover:-translate-y-px"
            style={{
              background: BRAND_GRADIENT,
              boxShadow: activeCount > 0 ? BRAND_SHADOW : "none",
              opacity: activeCount > 0 ? 1 : 0.55,
            }}
          >
            {activeCount > 0
              ? `Continuar com ${activeCount} ${activeCount === 1 ? "rotina" : "rotinas"}`
              : "Continuar"}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151]"
            style={{ color: "#6B7280" }}
          >
            Não tenho rotinas recorrentes ainda
          </button>
        </div>
      }
    >
      <h1
        className="mb-2 mt-2 text-2xl font-extrabold leading-tight"
        style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
      >
        Que rotinas o {childName} já tem?
      </h1>
      <p
        className="mb-[18px] text-sm leading-relaxed"
        style={{ color: "#6B7280" }}
      >
        São sugestões comuns. Toque pra ativar e preencher quando e com quem
        acontecem.
      </p>
      <div className="flex flex-col gap-2.5 pb-2">
        {SUGGESTIONS.map((s) =>
          routines[s.id].active ? (
            <RoutineExpandedCard
              key={s.id}
              suggestion={s}
              profile={routines[s.id]}
              professionals={professionals}
              onCollapse={() => toggleActive(s.id)}
              onChange={(k, v) => setField(s.id, k, v)}
            />
          ) : (
            <RoutineCollapsedCard
              key={s.id}
              suggestion={s}
              onExpand={() => toggleActive(s.id)}
            />
          ),
        )}
      </div>
    </OnboardingShell>
  );
}

function RoutineCollapsedCard({
  suggestion,
  onExpand,
}: {
  suggestion: RoutineSuggestion;
  onExpand: () => void;
}) {
  const t = TYPE_STYLES[suggestion.type];
  return (
    <button
      type="button"
      onClick={onExpand}
      className="flex items-center gap-3 rounded-[14px] border bg-white px-3.5 py-3 text-left transition-shadow hover:shadow-md"
      style={{
        borderColor: "#EEF0F4",
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      }}
    >
      <div
        className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
        style={{ background: t.tint }}
      >
        <TypeIcon type={suggestion.type} size={18} color={t.col} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[14.5px] font-bold"
          style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
        >
          {suggestion.title}
        </div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#9CA3AF" }}>
          Toque pra adicionar à rotina
        </div>
      </div>
      <div
        className="h-[26px] w-[26px] flex-shrink-0 rounded-full"
        style={{ border: "1.5px solid #D1D5DB" }}
      />
    </button>
  );
}

const FREQ_OPTIONS: Array<{
  value: NonNullable<RoutineProfile["freq"]>;
  label: string;
  showDays: boolean;
}> = [
  { value: "weekly", label: "Toda semana", showDays: true },
  { value: "biweekly", label: "Quinzenal", showDays: true },
  { value: "monthly", label: "Mensal", showDays: false },
  { value: "daily", label: "Diária", showDays: false },
];
const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

function RoutineExpandedCard({
  suggestion,
  profile,
  professionals,
  onCollapse,
  onChange,
}: {
  suggestion: RoutineSuggestion;
  profile: RoutineProfile;
  professionals: Array<{ id: string; name: string }>;
  onCollapse: () => void;
  onChange: <K extends keyof RoutineProfile>(
    key: K,
    value: RoutineProfile[K],
  ) => void;
}) {
  const t = TYPE_STYLES[suggestion.type];
  const showDays =
    profile.freq === "weekly" || profile.freq === "biweekly";

  const toggleDay = (idx: number) =>
    onChange(
      "daysOfWeek",
      profile.daysOfWeek.includes(idx)
        ? profile.daysOfWeek.filter((d) => d !== idx)
        : [...profile.daysOfWeek, idx],
    );

  return (
    <div
      className="rounded-[14px] bg-white px-3.5 pb-4 pt-3.5"
      style={{
        border: `1.5px solid ${AGENDA_BRAND.col}`,
        boxShadow: `0 0 0 4px ${AGENDA_BRAND.tint}`,
      }}
    >
      <div className="mb-3.5 flex items-center gap-3">
        <div
          className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[11px]"
          style={{ background: t.tint }}
        >
          <TypeIcon type={suggestion.type} size={18} color={t.col} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[14.5px] font-extrabold"
            style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
          >
            {suggestion.title}
          </div>
          <div
            className="mt-0.5 text-[11.5px] font-semibold"
            style={{ color: AGENDA_BRAND.col }}
          >
            Preencha os detalhes
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Desativar"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full"
          style={{ background: AGENDA_BRAND.col }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <path
              d="M5 12l4 4 10-10"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <div
            className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.02em]"
            style={{ color: "#6B7280" }}
          >
            Frequência
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FREQ_OPTIONS.map((opt) => {
              const active = profile.freq === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange("freq", opt.value)}
                  className="inline-flex h-8 items-center rounded-[9px] px-3 text-[12.5px] font-bold transition-colors"
                  style={{
                    background: active ? AGENDA_BRAND.tint : "#F6F7FB",
                    border: `1px solid ${active ? AGENDA_BRAND.col : "#E5E7EB"}`,
                    color: active ? AGENDA_BRAND.col : "#4B5563",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {showDays && (
          <div>
            <div
              className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.02em]"
              style={{ color: "#6B7280" }}
            >
              Dia da semana
            </div>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((label, i) => {
                const on = profile.daysOfWeek.includes(i);
                return (
                  <button
                    key={`day-${i}`}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className="flex h-[34px] flex-1 items-center justify-center rounded-[9px] text-[12px] font-extrabold transition-colors"
                    style={{
                      background: on ? AGENDA_BRAND.col : "#F6F7FB",
                      border: `1px solid ${on ? AGENDA_BRAND.col : "#E5E7EB"}`,
                      color: on ? "white" : "#6B7280",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div
            className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.02em]"
            style={{ color: "#6B7280" }}
          >
            Horário
          </div>
          <input
            type="time"
            value={profile.time}
            onChange={(e) => onChange("time", e.target.value)}
            className="h-10 w-full rounded-[10px] bg-[#F6F7FB] px-3 text-[13.5px] font-semibold outline-none"
            style={{
              border: profile.time
                ? `1.5px solid ${AGENDA_BRAND.col}`
                : "1px solid #E5E7EB",
              color: profile.time ? "#0F172A" : "#9CA3AF",
              boxShadow: profile.time
                ? `0 0 0 3px ${AGENDA_BRAND.tint}`
                : "none",
              colorScheme: "light",
            }}
          />
        </div>

        <div>
          <div
            className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.02em]"
            style={{ color: "#6B7280" }}
          >
            Profissional{" "}
            <span style={{ color: "#9CA3AF", fontWeight: 500 }}>(opcional)</span>
          </div>
          <div className="relative">
            <select
              value={profile.professionalId}
              onChange={(e) => onChange("professionalId", e.target.value)}
              className="h-10 w-full appearance-none rounded-[10px] border bg-[#F6F7FB] px-3 pr-9 text-[13.5px] outline-none"
              style={{
                borderColor: "#E5E7EB",
                color: profile.professionalId ? "#0F172A" : "#9CA3AF",
              }}
            >
              <option value="">Vincular ou digitar nome</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STEP 4 — Reminders
// ============================================================
function StepReminders({
  prefs,
  setPrefs,
  onFinish,
  submitting,
  onSkip,
}: {
  prefs: {
    oneDayBefore: boolean;
    oneHourBefore: boolean;
    pendingObservations: boolean;
    postEventRegister: boolean;
  };
  setPrefs: (
    setter: (p: typeof prefs) => typeof prefs,
  ) => void;
  onFinish: () => void;
  submitting?: boolean;
  onSkip: () => void;
}) {
  const items: Array<{
    key: keyof typeof prefs;
    title: string;
    desc: string;
  }> = [
    {
      key: "oneDayBefore",
      title: "Lembrete 1 dia antes",
      desc: "Você recebe um alerta 24h antes de cada compromisso.",
    },
    {
      key: "oneHourBefore",
      title: "Lembrete 1 hora antes",
      desc: "Útil pra organizar saída, transporte e materiais.",
    },
    {
      key: "pendingObservations",
      title: "Observações pendentes",
      desc: "No dia da consulta, te lembramos do que você anotou.",
    },
    {
      key: "postEventRegister",
      title: "Pós-atendimento",
      desc: "Pergunta se você quer registrar como foi.",
    },
  ];
  return (
    <OnboardingShell
      step={4}
      onSkip={onSkip}
      primary={
        <div>
          <button
            type="button"
            onClick={onFinish}
            disabled={submitting}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white transition-transform hover:-translate-y-px disabled:opacity-60"
            style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Concluir
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="mt-1 h-11 w-full text-sm font-semibold transition-colors hover:text-[#374151]"
            style={{ color: "#6B7280" }}
          >
            Configurar depois
          </button>
        </div>
      }
    >
      <div
        className="mb-3.5 mt-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: AGENDA_BRAND.tint }}
      >
        <Bell size={24} strokeWidth={1.6} color={AGENDA_BRAND.col} />
      </div>
      <h1
        className="mb-2 text-2xl font-extrabold leading-tight"
        style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
      >
        Como você quer ser lembrada?
      </h1>
      <p
        className="mb-[22px] text-sm leading-relaxed"
        style={{ color: "#6B7280" }}
      >
        Escolha quando o TEAmo te avisa. Dá pra mudar a qualquer momento.
      </p>
      <div
        className="overflow-hidden rounded-[14px] border bg-white"
        style={{ borderColor: "#EEF0F4" }}
      >
        {items.map((it, i) => {
          const on = prefs[it.key];
          return (
            <div
              key={it.key}
              className="flex items-center gap-3.5 px-4 py-3.5"
              style={{ borderTop: i > 0 ? "1px solid #F1F2F6" : "none" }}
            >
              <div className="min-w-0 flex-1">
                <div
                  className="text-sm font-bold"
                  style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
                >
                  {it.title}
                </div>
                <div
                  className="mt-1 text-[12.5px] leading-snug"
                  style={{ color: "#6B7280" }}
                >
                  {it.desc}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() =>
                  setPrefs((prev) => ({ ...prev, [it.key]: !prev[it.key] }))
                }
                className="relative h-6 w-10 flex-shrink-0 rounded-full transition-colors"
                style={{
                  background: on ? AGENDA_BRAND.col : "#E5E7EB",
                }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.2)] transition-all"
                  style={{ left: on ? 18 : 2 }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </OnboardingShell>
  );
}

// ============================================================
// Helpers
// ============================================================
function nextOccurrenceForRoutine(profile: RoutineProfile): string {
  const today = new Date();
  if (profile.freq === "daily") {
    return today.toISOString().slice(0, 10);
  }
  if (profile.freq === "weekly" || profile.freq === "biweekly") {
    if (profile.daysOfWeek.length === 0) {
      return today.toISOString().slice(0, 10);
    }
    // Próxima ocorrência a partir de hoje em qualquer dia da semana selecionado
    for (let offset = 0; offset < 14; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      if (profile.daysOfWeek.includes(d.getDay())) {
        return d.toISOString().slice(0, 10);
      }
    }
  }
  return today.toISOString().slice(0, 10);
}
