import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EventCard } from "@/components/agenda/EventCard";
import { EventFormSheet } from "@/components/agenda/EventFormSheet";
import { MonthGrid, MonthLegend, TherapistMonthLegend, type SessionDayStatus } from "@/components/agenda/MonthGrid";
import { WeekGrid } from "@/components/agenda/WeekGrid";
import { TherapistEventFormSheet } from "@/components/agenda/TherapistEventFormSheet";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import {
  createAgendaEvent,
  createTherapistSession,
  extendAgendaSeries,
  listAgendaEvents,
} from "@/services/agenda/events.service";
import { isIndefinite } from "@/lib/agenda/occurrences";
import { getNotificationPrefs } from "@/services/agenda/prefs.service";
import { getProfile } from "@/services/profile.service";
import { getRole } from "@/lib/roles";
import { usePatients } from "@/services/therapist.service";
import {
  formatHeroDate,
  formatTodaySummary,
  groupEventsByDay,
} from "@/lib/agenda/format";
import {
  AGENDA_BRAND,
  BRAND_GRADIENT,
  BRAND_SHADOW,
  PASTEL_GRADIENT,
  PATIENT_COLORS,
  getPatientColor,
} from "@/lib/agenda/tokens";
import type { AgendaEventInput } from "@/lib/agenda/validation";
import type { AgendaEventWithRelations } from "@/types/agenda";
import { track } from "@/lib/analytics";

// ─── Tipos de filtro ─────────────────────────────────────────────────────────

type AgendaFilters = {
  patientIds: string[];
  shifts: ("morning" | "afternoon" | "evening")[];
  hasReminder: boolean | null;
};

const SHIFT_LABELS: Record<"morning" | "afternoon" | "evening", string> = {
  morning: "Manhã (6h–12h)",
  afternoon: "Tarde (12h–18h)",
  evening: "Noite (18h+)",
};

function getShift(startAt: string): "morning" | "afternoon" | "evening" {
  const h = new Date(startAt).getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

// ─── Helpers de status de sessão (terapeuta) ─────────────────────────────────

function computeSessionStatus(ev: AgendaEventWithRelations): SessionDayStatus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evAny = ev as any;
  const now = new Date();
  const startAt = new Date(ev.start_at);
  if (evAny.session_attendance === "missed_justified" || evAny.session_attendance === "missed_no_show") {
    return "missed";
  }
  if (evAny.session_attendance === "happened") {
    return "complete";
  }
  if (startAt < now) {
    return "pending";
  }
  return "upcoming";
}

function buildSessionStatusMap(events: AgendaEventWithRelations[]): Map<string, SessionDayStatus> {
  const map = new Map<string, SessionDayStatus>();
  const priority: Record<SessionDayStatus, number> = { missed: 3, pending: 2, complete: 1, upcoming: 0 };
  for (const ev of events) {
    const d = new Date(ev.start_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const status = computeSessionStatus(ev);
    const existing = map.get(key);
    if (!existing || priority[status] > priority[existing]) {
      map.set(key, status);
    }
  }
  return map;
}

const STATUS_LABELS: Record<SessionDayStatus, { label: string; color: string; bg: string }> = {
  complete: { label: "Registro feito",     color: "#0D9488", bg: "#F0FDFA" },
  pending:  { label: "Registro pendente",  color: "#D97706", bg: "#FEF3C7" },
  missed:   { label: "Falta registrada",   color: "#DC2626", bg: "#FEF2F2" },
  upcoming: { label: "Agendada",           color: "#6B7280", bg: "#F4F5FA" },
};

export const Route = createFileRoute("/_auth/agenda")({
  head: () => ({
    meta: [{ title: "Agenda — TEAmo" }],
  }),
  component: AgendaPage,
});

type ViewMode = "hoje" | "semana" | "mes";

const WEEKDAYS_PT = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const MONTHS_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function AgendaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("hoje");
  const [viewInitialized, setViewInitialized] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<AgendaFilters>({ patientIds: [], shifts: [], hasReminder: null });

  useEffect(() => {
    track("module.open", { module: "agenda", route: "/agenda" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // Detecta papel do usuário
  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => getProfile(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
  const isTherapist = profileQuery.data
    ? getRole(profileQuery.data) === "therapist"
    : false;

  // Define view padrão conforme o papel do usuário, apenas na montagem
  useEffect(() => {
    if (viewInitialized || !profileQuery.data) return;
    if (getRole(profileQuery.data) === "therapist") {
      setView("semana");
    }
    setViewInitialized(true);
  }, [profileQuery.data, viewInitialized]);

  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: () => listAgendaEvents(),
    enabled: !!user,
  });

  // Top-up de séries indefinidas: se a última ocorrência materializada de uma
  // série recorrente sem fim está a < 30 dias, estende mais ~90 dias. Best-effort.
  const toppedUpRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    const events = eventsQuery.data ?? [];
    if (events.length === 0) return;
    const horizon = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const lastBySeries = new Map<string, number>();
    for (const e of events) {
      if (!e.series_id || !isIndefinite(e.recurrence)) continue;
      const t = new Date(e.start_at).getTime();
      if (t > (lastBySeries.get(e.series_id) ?? 0)) lastBySeries.set(e.series_id, t);
    }
    const toExtend = [...lastBySeries.entries()]
      .filter(([sid, last]) => last < horizon && !toppedUpRef.current.has(sid))
      .map(([sid]) => sid);
    if (toExtend.length === 0) return;
    toExtend.forEach((sid) => toppedUpRef.current.add(sid));
    void (async () => {
      let total = 0;
      for (const sid of toExtend) {
        try {
          total += await extendAgendaSeries(sid);
        } catch {
          /* best-effort — não bloqueia a agenda */
        }
      }
      if (total > 0) qc.invalidateQueries({ queryKey: ["agenda-events"] });
    })();
  }, [eventsQuery.data, user, qc]);

  const prefsQuery = useQuery({
    queryKey: ["agenda-prefs", user?.id],
    queryFn: () => getNotificationPrefs(user!.id),
    enabled: !!user && !isTherapist, // terapeuta não usa prefs de onboarding do pai
  });

  // Auto-redirect ao tutorial APENAS para pais sem eventos
  useEffect(() => {
    if (isTherapist) return;
    if (eventsQuery.isLoading || prefsQuery.isLoading) return;
    const events = eventsQuery.data ?? [];
    const completed = prefsQuery.data?.onboarding_completed ?? false;
    let locallySkipped = false;
    try {
      locallySkipped =
        !!user &&
        typeof window !== "undefined" &&
        window.localStorage.getItem(`agenda_onboarding_skipped:${user.id}`) === "1";
    } catch {
      /* localStorage indisponível */
    }
    if (events.length === 0 && !completed && !locallySkipped) {
      navigate({ to: "/agenda/onboarding" });
    }
  }, [
    isTherapist,
    eventsQuery.data,
    eventsQuery.isLoading,
    prefsQuery.data,
    prefsQuery.isLoading,
    navigate,
    user,
  ]);

  // Dados de filhos/profissionais para pais
  const childrenQuery = useQuery({
    queryKey: ["children"],
    queryFn: listChildren,
    enabled: !!user && !isTherapist,
  });
  const professionalsQuery = useQuery({
    queryKey: ["professionals"],
    queryFn: listProfessionals,
    enabled: !!user && !isTherapist,
  });

  // Pacientes para terapeuta
  const patientsQuery = usePatients();
  const patients = useMemo(
    () => ((patientsQuery.data as any)?.patients ?? []).map((p: any) => ({ id: p.id as string, name: p.name as string })),
    [patientsQuery.data],
  );

  // Mutation — terapeuta cria sessão
  const createSessionMutation = useMutation({
    mutationFn: (input: Parameters<typeof createTherapistSession>[1]) =>
      createTherapistSession(user!.id, input),
    onSuccess: () => {
      toast.success("Sessão agendada.");
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation — pai cria compromisso
  const createMutation = useMutation({
    mutationFn: (input: AgendaEventInput) => createAgendaEvent(user!.id, input),
    onSuccess: (_data, input) => {
      track("event.create", { module: "agenda", properties: { event_type: input.type } });
      toast.success("Compromisso cadastrado.");
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (eventsQuery.isLoading || profileQuery.isLoading) {
    return (
      <AppShell hideMenu>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const events = eventsQuery.data ?? [];

  const filtersActive =
    filters.patientIds.length > 0 ||
    filters.shifts.length > 0 ||
    filters.hasReminder !== null;

  const filteredEvents = filtersActive
    ? events.filter((e) => {
        if (
          filters.patientIds.length > 0 &&
          e.child_id &&
          !filters.patientIds.includes(e.child_id)
        )
          return false;
        if (
          filters.shifts.length > 0 &&
          !filters.shifts.includes(getShift(e.start_at))
        )
          return false;
        if (filters.hasReminder === true) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = (e as any).reminders;
          if (!r?.oneDayBefore && !r?.oneHourBefore) return false;
        }
        return true;
      })
    : events;

  // ── TEAL brand para terapeuta ────────────────────────────────────────────────
  const TEAL = "#0D9488";
  const TEAL_TINT = "#F0FDFA";

  // ── Cabeçalho compartilhado ─────────────────────────────────────────────────
  const headerSection = (
    <div className="px-1">
      <button
        type="button"
        onClick={() => navigate({ to: "/dashboard" })}
        className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
        style={{ color: "#6B7280" }}
      >
        <ArrowLeft size={18} strokeWidth={1.8} />
        Voltar ao início
      </button>
      <div className="mt-1.5 mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: isTherapist ? TEAL_TINT : AGENDA_BRAND.tint }}
          >
            <Calendar size={20} strokeWidth={1.7} color={isTherapist ? TEAL : AGENDA_BRAND.col} />
          </div>
          <h1
            className="text-2xl font-extrabold leading-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.025em" }}
          >
            Agenda
          </h1>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Filtrar"
            onClick={() => setFilterSheetOpen(true)}
            className="relative flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-colors hover:bg-[#E5E7EB]"
            style={{ background: "#F4F5FA" }}
          >
            <SlidersHorizontal
              size={18}
              strokeWidth={1.7}
              color={filtersActive ? TEAL : "#6B7280"}
            />
            {filtersActive && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          <button
            type="button"
            aria-label={isTherapist ? "Nova sessão" : "Novo compromisso"}
            onClick={() => setSheetOpen(true)}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-xl"
            style={{
              background: isTherapist ? TEAL : BRAND_GRADIENT,
              boxShadow: isTherapist
                ? "0 4px 12px rgba(13,148,136,0.35)"
                : BRAND_SHADOW,
            }}
          >
            <Plus size={18} strokeWidth={2.2} color="white" />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Visão do TERAPEUTA ───────────────────────────────────────────────────────
  if (isTherapist) {
    const sessionStatusMap = buildSessionStatusMap(filteredEvents);

    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          {headerSection}
          <TherapistAgendaView
            events={filteredEvents}
            patients={patients}
            view={view}
            onChangeView={setView}
            sessionStatusMap={sessionStatusMap}
            onSelectEvent={(id) =>
              navigate({ to: "/agenda/$eventId", params: { eventId: id } })
            }
          />
          <div className="h-24" />
        </div>

        <TherapistEventFormSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onSubmit={async (data) => {
            await createSessionMutation.mutateAsync(data);
            setSheetOpen(false);
          }}
          submitting={createSessionMutation.isPending}
          patients={patients}
        />
        <AgendaFilterSheet
          open={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          filters={filters}
          onChange={setFilters}
          patients={patients}
          isTherapist
          viewMode={view}
          onViewMode={setView}
        />
      </AppShell>
    );
  }

  // ── Visão do PAI (inalterada) ────────────────────────────────────────────────
  const hasEvents = events.length > 0;
  const childrenList = childrenQuery.data ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {headerSection}

        {hasEvents ? (
          <AgendaTodayView
            events={filteredEvents}
            view={view}
            onChangeView={setView}
          />
        ) : (
          <AgendaEmptyState
            onAdd={() => setSheetOpen(true)}
            onOpenTutorial={() => navigate({ to: "/agenda/onboarding" })}
          />
        )}

        <div className="h-8" />
      </div>

      <AgendaFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        filters={filters}
        onChange={setFilters}
        patients={[]}
        isTherapist={false}
        viewMode={view}
        onViewMode={setView}
      />

      <EventFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        submitting={createMutation.isPending}
        childrenList={childrenList}
        professionals={professionalsQuery.data ?? []}
      />
    </AppShell>
  );
}

function ViewToggle({
  active,
  onChange,
  isTherapist,
}: {
  active: ViewMode;
  onChange: (v: ViewMode) => void;
  isTherapist?: boolean;
}) {
  const TEAL = "#0D9488";
  const items: Array<{ key: ViewMode; label: string }> = [
    { key: "hoje", label: "Hoje" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
  ];
  return (
    <div
      className="mt-3 flex gap-1 rounded-xl p-1"
      style={{ background: "#F4F5FA" }}
    >
      {items.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onChange(v.key)}
          className="flex h-8 flex-1 items-center justify-center rounded-[9px] text-[13px] font-bold transition-all"
          style={{
            background: v.key === active ? "white" : "transparent",
            boxShadow:
              v.key === active ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
            color: v.key === active
              ? (isTherapist ? TEAL : "#0F172A")
              : "#6B7280",
            letterSpacing: "-0.005em",
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function AgendaTodayView({
  events,
  view,
  onChangeView,
}: {
  events: AgendaEventWithRelations[];
  view: ViewMode;
  onChangeView: (v: ViewMode) => void;
}) {
  const navigate = useNavigate();
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const today = new Date();
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  if (view === "mes") {
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const dayEvents = events.filter((e) =>
      sameDay(new Date(e.start_at), selectedDate),
    );
    const selectedTitle = `${WEEKDAYS_PT[selectedDate.getDay()]}, ${selectedDate.getDate()} de ${MONTHS_PT[selectedDate.getMonth()]}`;
    return (
      <>
        <ViewToggle active={view} onChange={onChangeView} />
        <div className="mt-4">
          <MonthGrid
            monthYear={monthYear}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() =>
              setMonthYear(({ year, month }) => {
                const m = month - 1;
                return m < 0
                  ? { year: year - 1, month: 11 }
                  : { year, month: m };
              })
            }
            onNextMonth={() =>
              setMonthYear(({ year, month }) => {
                const m = month + 1;
                return m > 11
                  ? { year: year + 1, month: 0 }
                  : { year, month: m };
              })
            }
            events={events}
          />
        </div>
        <div className="mt-3.5">
          <MonthLegend />
        </div>
        <div className="mt-4 mb-2">
          <div
            className="text-[12px] font-bold uppercase tracking-[0.05em]"
            style={{ color: "#0F172A" }}
          >
            {selectedTitle}
          </div>
        </div>
        {dayEvents.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm"
            style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
          >
            Sem compromissos neste dia.
          </div>
        ) : (
          <div className="-mx-5 flex flex-col gap-2">
            {dayEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onClick={() =>
                  navigate({
                    to: "/agenda/$eventId",
                    params: { eventId: ev.id },
                  })
                }
              />
            ))}
          </div>
        )}
      </>
    );
  }

  if (view === "semana") {
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    const today = new Date();
    const todayEvents = events.filter((e) =>
      sameDay(new Date(e.start_at), today),
    );
    return (
      <>
        <ViewToggle active={view} onChange={onChangeView} />
        <div className="mt-4">
          <WeekGrid
            weekStart={weekStart}
            onPrev={() => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() - 7);
              setWeekStart(d);
            }}
            onNext={() => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + 7);
              setWeekStart(d);
            }}
            events={events}
            onSelectEvent={(eventId) =>
              navigate({
                to: "/agenda/$eventId",
                params: { eventId },
              })
            }
          />
        </div>
        <div className="mt-5 mb-2 flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: AGENDA_BRAND.col }}
          />
          <div
            className="text-[12px] font-bold uppercase tracking-[0.05em]"
            style={{ color: "#0F172A" }}
          >
            Hoje · {WEEKDAYS_PT[today.getDay()].toLowerCase()} {today.getDate()}
          </div>
        </div>
        {todayEvents.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm"
            style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
          >
            Sem compromissos hoje.
          </div>
        ) : (
          <div className="-mx-5 flex flex-col gap-2">
            {todayEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                onClick={() =>
                  navigate({
                    to: "/agenda/$eventId",
                    params: { eventId: ev.id },
                  })
                }
              />
            ))}
          </div>
        )}
      </>
    );
  }

  const groups = groupEventsByDay(events);
  return (
    <>
      <ViewToggle active={view} onChange={onChangeView} />

      {/* Hero pastel */}
      <section
        className="relative mt-4 overflow-hidden rounded-[22px] px-[22px] py-5"
        style={{ background: PASTEL_GRADIENT }}
      >
        <svg
          viewBox="0 0 300 300"
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ top: "-45%", right: "-30%", width: "85%", opacity: 0.5 }}
        >
          <defs>
            <radialGradient id="ag-hero" cx="50%" cy="50%">
              <stop offset="0%" stopColor="white" stopOpacity="0.9" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="150" r="140" fill="url(#ag-hero)" />
        </svg>
        <div className="relative">
          <div
            className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: AGENDA_BRAND.col }}
          >
            Hoje
          </div>
          <div
            className="text-xl font-extrabold leading-tight"
            style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
          >
            {formatHeroDate()}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#475569" }}>
            {formatTodaySummary(events)}
          </div>
        </div>
      </section>

      {/* Day groups */}
      <div className="mt-2 -mx-5">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="mt-[18px] mb-2.5 flex items-center gap-2.5 px-5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: group.isToday ? AGENDA_BRAND.col : "#D1D5DB",
                }}
              />
              <div
                className="text-[12px] font-bold uppercase tracking-[0.05em]"
                style={{ color: "#0F172A" }}
              >
                {group.label}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {group.events.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  onClick={() =>
                    navigate({
                      to: "/agenda/$eventId",
                      params: { eventId: ev.id },
                    })
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── TherapistAgendaView ──────────────────────────────────────────────────────

interface TherapistPatient { id: string; name: string; }

function TherapistAgendaView({
  events,
  patients,
  view,
  onChangeView,
  sessionStatusMap,
  onSelectEvent,
}: {
  events: AgendaEventWithRelations[];
  patients: TherapistPatient[];
  view: ViewMode;
  onChangeView: (v: ViewMode) => void;
  sessionStatusMap: Map<string, SessionDayStatus>;
  onSelectEvent: (id: string) => void;
}) {
  const TEAL = "#0D9488";
  const today = new Date();

  // WeekGrid state
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // MonthGrid state
  const [monthYear, setMonthYear] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // getEventColor para WeekGrid — usa cor do paciente
  const getEventColor = (ev: AgendaEventWithRelations) => {
    const childId = ev.child_id;
    const color = getPatientColor(childId ?? "");
    const patientName = patients.find((p) => p.id === childId)?.name ?? ev.child?.name ?? "?";
    return { col: color.col, label: patientName.charAt(0).toUpperCase() };
  };

  // Legenda de pacientes presentes nos eventos
  const patientIdsInEvents = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of events) {
      if (ev.child_id) ids.add(ev.child_id);
    }
    return ids;
  }, [events]);

  const legendPatients = useMemo(() =>
    patients.filter((p) => patientIdsInEvents.has(p.id)),
    [patients, patientIdsInEvents],
  );

  // Today's sessions
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const todayEvents = events
    .filter((e) => isSameDay(new Date(e.start_at), today))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  // Selected day events (mês)
  const dayEvents = events
    .filter((e) => isSameDay(new Date(e.start_at), selectedDate))
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const selectedTitle = `${WEEKDAYS_PT[selectedDate.getDay()]}, ${selectedDate.getDate()} de ${MONTHS_PT[selectedDate.getMonth()]}`;

  // ── Patient color legend ────────────────────────────────────────────────────
  const patientLegend = legendPatients.length > 0 ? (
    <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {legendPatients.map((p) => {
        const { col } = getPatientColor(p.id);
        return (
          <span
            key={p.id}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
            style={{ background: col + "22", color: col }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: col }} />
            {p.name}
          </span>
        );
      })}
    </div>
  ) : null;

  // ── SEMANA ──────────────────────────────────────────────────────────────────
  if (view === "semana") {
    return (
      <>
        <ViewToggle active={view} onChange={onChangeView} isTherapist />
        {patientLegend}
        <div className="mt-4">
          <WeekGrid
            weekStart={weekStart}
            onPrev={() => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() - 7);
              setWeekStart(d);
            }}
            onNext={() => {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + 7);
              setWeekStart(d);
            }}
            events={events}
            onSelectEvent={onSelectEvent}
            getEventColor={getEventColor}
          />
        </div>
        {/* Hoje no rodapé da semana */}
        <div className="mt-5 mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: TEAL }} />
          <div className="text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: "#0F172A" }}>
            Hoje · {WEEKDAYS_PT[today.getDay()].toLowerCase()} {today.getDate()}
          </div>
        </div>
        {todayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}>
            Sem sessões hoje.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayEvents.map((ev) => (
              <TherapistSessionCard key={ev.id} event={ev} patients={patients} onClick={() => onSelectEvent(ev.id)} />
            ))}
          </div>
        )}
        {/* Legenda de semana */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
          {(["upcoming", "complete", "pending"] as SessionDayStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "#6B7280" }}>
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_LABELS[s].color }} />
              {STATUS_LABELS[s].label}
            </span>
          ))}
        </div>
      </>
    );
  }

  // ── MÊS ────────────────────────────────────────────────────────────────────
  if (view === "mes") {
    return (
      <>
        <ViewToggle active={view} onChange={onChangeView} isTherapist />
        <div className="mt-4">
          <MonthGrid
            monthYear={monthYear}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() =>
              setMonthYear(({ year, month }) => {
                const m = month - 1;
                return m < 0 ? { year: year - 1, month: 11 } : { year, month: m };
              })
            }
            onNextMonth={() =>
              setMonthYear(({ year, month }) => {
                const m = month + 1;
                return m > 11 ? { year: year + 1, month: 0 } : { year, month: m };
              })
            }
            events={events}
            sessionStatusMap={sessionStatusMap}
          />
        </div>
        <div className="mt-3.5">
          <TherapistMonthLegend />
        </div>
        <div className="mt-4 mb-2">
          <div className="text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: "#0F172A" }}>
            {selectedTitle}
          </div>
        </div>
        {dayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}>
            Sem sessões neste dia.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {dayEvents.map((ev) => (
              <TherapistSessionCard key={ev.id} event={ev} patients={patients} onClick={() => onSelectEvent(ev.id)} />
            ))}
          </div>
        )}
      </>
    );
  }

  // ── HOJE (padrão) ───────────────────────────────────────────────────────────
  const todayLabel = `${WEEKDAYS_PT[today.getDay()]}, ${today.getDate()} de ${MONTHS_PT[today.getMonth()]}`;
  return (
    <>
      <ViewToggle active={view} onChange={onChangeView} isTherapist />

      {/* Hero teal terapeuta */}
      <section
        className="relative mt-4 overflow-hidden rounded-[22px] px-[22px] py-5"
        style={{ background: "linear-gradient(140deg, #E6FFFA 0%, #F0FDF9 55%, #E0F2FE 100%)", border: "1px solid #CCFBF1" }}
      >
        <div className="relative">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: TEAL }}>
            Hoje
          </div>
          <div className="text-xl font-extrabold leading-tight" style={{ color: "#0F172A", letterSpacing: "-0.02em" }}>
            {todayLabel}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#475569" }}>
            {todayEvents.length === 0
              ? "Nenhuma sessão hoje."
              : `${todayEvents.length} sessão${todayEvents.length !== 1 ? "ões" : ""} hoje`}
          </div>
        </div>
      </section>

      {/* Sessões de hoje */}
      <div className="mt-4 flex flex-col gap-2">
        {todayEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm" style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}>
            Nenhuma sessão agendada para hoje.
          </div>
        ) : (
          todayEvents.map((ev) => (
            <TherapistSessionCard key={ev.id} event={ev} patients={patients} onClick={() => onSelectEvent(ev.id)} />
          ))
        )}
      </div>

      {/* Próximas sessões (fora de hoje) */}
      {(() => {
        const upcoming = events
          .filter((e) => !isSameDay(new Date(e.start_at), today) && new Date(e.start_at) > today)
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
          .slice(0, 5);
        if (upcoming.length === 0) return null;
        return (
          <>
            <div className="mt-6 mb-2 text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: "#0F172A" }}>
              Próximas sessões
            </div>
            <div className="flex flex-col gap-2">
              {upcoming.map((ev) => (
                <TherapistSessionCard key={ev.id} event={ev} patients={patients} onClick={() => onSelectEvent(ev.id)} />
              ))}
            </div>
          </>
        );
      })()}
    </>
  );
}

// ─── TherapistSessionCard ─────────────────────────────────────────────────────

function TherapistSessionCard({
  event,
  patients,
  onClick,
}: {
  event: AgendaEventWithRelations;
  patients: TherapistPatient[];
  onClick: () => void;
}) {
  const TEAL = "#0D9488";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evAny = event as any;
  const childId = event.child_id;
  const { col } = getPatientColor(childId ?? "");
  const patientName =
    patients.find((p) => p.id === childId)?.name ??
    event.child?.name ??
    "Paciente";
  const initial = patientName.charAt(0).toUpperCase();

  // Horário
  const start = new Date(event.start_at);
  const end   = event.end_at ? new Date(event.end_at) : null;
  const hm = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const timeLabel = end ? `${hm(start)} – ${hm(end)}` : hm(start);

  // Tipo de sessão
  const sessionTypeLabels: Record<string, string> = {
    individual: "Individual",
    grupo: "Em grupo",
    familiar: "Familiar",
  };
  const sessionType = sessionTypeLabels[evAny.session_type] ?? "Individual";

  // Status
  const status = computeSessionStatus(event);
  const { label: statusLabel, color: statusColor, bg: statusBg } = STATUS_LABELS[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-[18px] border bg-white px-4 py-3.5 text-left transition-shadow hover:shadow-md"
      style={{ borderColor: "#EEF0F4" }}
    >
      {/* Colored initial circle */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
        style={{ background: col }}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight" style={{ color: "#0F172A" }}>
          {patientName}
        </div>
        <div className="mt-0.5 text-[12.5px]" style={{ color: "#6B7280" }}>
          {timeLabel} · {sessionType}
        </div>
      </div>

      {/* Status badge */}
      <span
        className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{ background: statusBg, color: statusColor }}
      >
        {statusLabel}
      </span>
    </button>
  );
}

function AgendaEmptyState({
  onAdd,
  onOpenTutorial,
}: {
  onAdd: () => void;
  onOpenTutorial: () => void;
}) {
  return (
    <div className="mt-5">
      <p
        className="mb-5 text-sm leading-relaxed"
        style={{ color: "#6B7280", maxWidth: 360 }}
      >
        Organize compromissos, terapias e medicações da criança.
      </p>
      <section
        className="mx-1 rounded-[18px] border bg-white px-[22px] py-7 text-center"
        style={{
          borderColor: "#EEF0F4",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.03), 0 6px 18px rgba(15,23,42,0.04)",
        }}
      >
        <div
          className="mx-auto mb-3.5 inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(135deg, ${AGENDA_BRAND.tint} 0%, ${AGENDA_BRAND.tintDeep} 100%)`,
            boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.8)",
          }}
        >
          <Calendar size={28} strokeWidth={1.7} color={AGENDA_BRAND.col} />
        </div>
        <h2
          className="mb-1.5 text-[17px] font-extrabold"
          style={{ color: "#0F172A", letterSpacing: "-0.02em" }}
        >
          Sua agenda está em branco
        </h2>
        <p
          className="mx-auto mb-[18px] text-[13.5px] leading-snug"
          style={{ color: "#6B7280", maxWidth: 280 }}
        >
          Cadastre seu primeiro compromisso e organize a rotina em um só lugar.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-xl px-[22px] text-[14px] font-bold text-white transition-all hover:-translate-y-px"
          style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
        >
          <Plus size={18} strokeWidth={2.2} />
          Adicionar compromisso
        </button>
        <div className="mt-3">
          <button
            type="button"
            onClick={onOpenTutorial}
            className="bg-transparent text-[13px] font-bold underline-offset-2 hover:underline"
            style={{ color: AGENDA_BRAND.col }}
          >
            Voltar ao tutorial guiado
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── AgendaFilterSheet ────────────────────────────────────────────────────────

function AgendaFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  patients,
  isTherapist,
  viewMode,
  onViewMode,
}: {
  open: boolean;
  onClose: () => void;
  filters: AgendaFilters;
  onChange: (f: AgendaFilters) => void;
  patients: { id: string; name: string }[];
  isTherapist: boolean;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
}) {
  const TEAL = "#0D9488";

  const toggleShift = (s: "morning" | "afternoon" | "evening") => {
    const next = filters.shifts.includes(s)
      ? filters.shifts.filter((x) => x !== s)
      : [...filters.shifts, s];
    onChange({ ...filters, shifts: next });
  };

  const togglePatient = (id: string) => {
    const next = filters.patientIds.includes(id)
      ? filters.patientIds.filter((x) => x !== id)
      : [...filters.patientIds, id];
    onChange({ ...filters, patientIds: next });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[24px] bg-white px-5 pt-4 shadow-2xl"
        style={{ maxHeight: "85vh", overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#E5E7EB]" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-extrabold" style={{ color: "#0F172A", letterSpacing: "-0.02em" }}>
            Filtros
          </h2>
          <button
            type="button"
            onClick={() => onChange({ patientIds: [], shifts: [], hasReminder: null })}
            className="text-[13px] font-semibold"
            style={{ color: "#9CA3AF" }}
          >
            Limpar tudo
          </button>
        </div>

        {/* Visualização rápida */}
        <div className="mb-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
            Visualização
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: "hoje", label: "Hoje" },
                { key: "semana", label: "Semana" },
                { key: "mes", label: "Mês" },
              ] as { key: ViewMode; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onViewMode(key);
                  onClose();
                }}
                className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                style={
                  viewMode === key
                    ? { background: TEAL, borderColor: TEAL, color: "white" }
                    : { background: "white", borderColor: "#E5E7EB", color: "#374151" }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Turno */}
        <div className="mb-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
            Turno
          </p>
          <div className="flex flex-wrap gap-2">
            {(["morning", "afternoon", "evening"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleShift(s)}
                className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                style={
                  filters.shifts.includes(s)
                    ? { background: TEAL, borderColor: TEAL, color: "white" }
                    : { background: "white", borderColor: "#E5E7EB", color: "#374151" }
                }
              >
                {SHIFT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Lembrete */}
        <div className="mb-5">
          <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
            Lembrete
          </p>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                hasReminder: filters.hasReminder === true ? null : true,
              })
            }
            className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
            style={
              filters.hasReminder === true
                ? { borderColor: TEAL, background: "#F0FDFA" }
                : { borderColor: "#E5E7EB", background: "white" }
            }
          >
            <span
              className="text-[14px] font-semibold"
              style={{ color: filters.hasReminder === true ? TEAL : "#374151" }}
            >
              Apenas com lembrete ativo
            </span>
            <span
              className="ml-auto flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors"
              style={{ background: filters.hasReminder === true ? TEAL : "#D1D5DB" }}
            >
              <span
                className="h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{
                  transform:
                    filters.hasReminder === true ? "translateX(18px)" : "translateX(2px)",
                }}
              />
            </span>
          </button>
        </div>

        {/* Pacientes — só terapeuta */}
        {isTherapist && patients.length > 0 && (
          <div className="mb-5">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>
              Paciente
            </p>
            <div className="flex flex-wrap gap-2">
              {patients.map((p) => {
                const { col } = getPatientColor(p.id);
                const active = filters.patientIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePatient(p.id)}
                    className="rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                    style={
                      active
                        ? { background: col, borderColor: col, color: "white" }
                        : { background: "white", borderColor: "#E5E7EB", color: "#374151" }
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fechar */}
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-xl text-[15px] font-bold text-white"
          style={{ background: TEAL }}
        >
          Aplicar
        </button>
      </div>
    </>
  );
}
