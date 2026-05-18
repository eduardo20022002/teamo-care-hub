import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EventCard } from "@/components/agenda/EventCard";
import { EventFormSheet } from "@/components/agenda/EventFormSheet";
import { useAuth } from "@/hooks/useAuth";
import { listChildren } from "@/services/children.service";
import { listProfessionals } from "@/services/professionals.service";
import {
  createAgendaEvent,
  listAgendaEvents,
} from "@/services/agenda/events.service";
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
} from "@/lib/agenda/tokens";
import type { AgendaEventInput } from "@/lib/agenda/validation";
import type { AgendaEventWithRelations } from "@/types/agenda";

export const Route = createFileRoute("/_auth/agenda")({
  head: () => ({
    meta: [{ title: "Agenda — TEAmo" }],
  }),
  component: AgendaPage,
});

type ViewMode = "hoje" | "semana" | "mes";

function AgendaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view] = useState<ViewMode>("hoje");
  const [sheetOpen, setSheetOpen] = useState(false);

  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: listAgendaEvents,
    enabled: !!user,
  });

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

  const createMutation = useMutation({
    mutationFn: (input: AgendaEventInput) =>
      createAgendaEvent(user!.id, input),
    onSuccess: () => {
      toast.success("Compromisso cadastrado.");
      qc.invalidateQueries({ queryKey: ["agenda-events"] });
      setSheetOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (eventsQuery.isLoading) {
    return (
      <AppShell hideMenu>
        <LoadingSpinner />
      </AppShell>
    );
  }

  const events = eventsQuery.data ?? [];
  const hasEvents = events.length > 0;
  const childrenList = childrenQuery.data ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
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
                style={{ background: AGENDA_BRAND.tint }}
              >
                <Calendar size={20} strokeWidth={1.7} color={AGENDA_BRAND.col} />
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
                aria-label="Buscar"
                className="flex h-[38px] w-[38px] items-center justify-center rounded-xl transition-colors hover:bg-[#E5E7EB]"
                style={{ background: "#F4F5FA" }}
              >
                <Search size={18} strokeWidth={1.7} color="#6B7280" />
              </button>
              <button
                type="button"
                aria-label="Novo compromisso"
                onClick={() => setSheetOpen(true)}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-xl"
                style={{ background: BRAND_GRADIENT, boxShadow: BRAND_SHADOW }}
              >
                <Plus size={18} strokeWidth={2.2} color="white" />
              </button>
            </div>
          </div>
        </div>

        {hasEvents ? (
          <AgendaTodayView events={events} view={view} />
        ) : (
          <AgendaEmptyState onAdd={() => setSheetOpen(true)} />
        )}

        <div className="h-8" />
      </div>

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

function ViewToggle({ active }: { active: ViewMode }) {
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
          disabled
          className="flex h-8 flex-1 items-center justify-center rounded-[9px] text-[13px] font-bold"
          style={{
            background: v.key === active ? "white" : "transparent",
            boxShadow: v.key === active ? "0 1px 3px rgba(15,23,42,0.1)" : "none",
            color: v.key === active ? "#0F172A" : "#6B7280",
            letterSpacing: "-0.005em",
            cursor: "not-allowed",
            opacity: v.key === active ? 1 : 0.5,
          }}
          title={v.key === active ? undefined : "Em breve"}
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
}: {
  events: AgendaEventWithRelations[];
  view: ViewMode;
}) {
  const navigate = useNavigate();
  const groups = groupEventsByDay(events);
  return (
    <>
      <ViewToggle active={view} />

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

function AgendaEmptyState({ onAdd }: { onAdd: () => void }) {
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
      </section>
    </div>
  );
}
