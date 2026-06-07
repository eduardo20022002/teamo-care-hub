import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  Search,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TypeIcon } from "@/components/agenda/icons";
import {
  AGENDA_BRAND,
  ALERT_TONE,
  TYPE_STYLES,
} from "@/lib/agenda/tokens";
import { listAgendaEvents } from "@/services/agenda/events.service";
import { useAuth } from "@/hooks/useAuth";
import type { AgendaEventType, AgendaEventWithRelations } from "@/types/agenda";

interface SearchFilters {
  types: Set<AgendaEventType>;
  withReminder: boolean;
  period: "all" | "week";
}

export const Route = createFileRoute("/_auth/agenda_/busca")({
  head: () => ({ meta: [{ title: "Buscar na agenda — TEAmo" }] }),
  component: AgendaSearchPage,
});

const RECENT_KEY = "teamo:agenda:recent-searches";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 5) : [];
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  if (typeof window === "undefined" || !q.trim()) return;
  const cur = loadRecent().filter((r) => r !== q);
  cur.unshift(q);
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(cur.slice(0, 5)),
    );
  } catch {
    // ignore
  }
}

interface ResultHit {
  id: string;
  kind: "Compromisso" | "Observação";
  type?: keyof typeof TYPE_STYLES;
  title: string;
  snippet?: string;
  meta: string;
  deepLink: string;
}

function inThisWeek(ev: AgendaEventWithRelations): boolean {
  const t = new Date(ev.start_at).getTime();
  const now = Date.now();
  return t >= now - 24 * 3600 * 1000 && t <= now + 7 * 24 * 3600 * 1000;
}

function searchEvents(
  events: AgendaEventWithRelations[],
  q: string,
  f: SearchFilters,
): ResultHit[] {
  const needle = q.trim().toLowerCase();
  const useText = needle.length >= 2;
  return events
    .filter((ev) => {
      if (useText) {
        const hay = [
          ev.title,
          ev.locale ?? "",
          ev.professional?.name ?? ev.professional_name_raw ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (f.types.size > 0 && !f.types.has(ev.type)) return false;
      if (
        f.withReminder &&
        !(ev.reminders?.oneDayBefore || ev.reminders?.oneHourBefore)
      )
        return false;
      if (f.period === "week" && !inThisWeek(ev)) return false;
      return true;
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .map((ev) => ({
      id: ev.id,
      kind: "Compromisso" as const,
      type: ev.type,
      title: ev.title,
      snippet: ev.locale ? `📍 ${ev.locale}` : undefined,
      meta: [
        new Date(ev.start_at).toLocaleDateString("pt-BR"),
        ev.professional?.name ?? ev.professional_name_raw,
      ]
        .filter(Boolean)
        .join(" · "),
      deepLink: `/agenda/${ev.id}`,
    }));
}

function highlight(text: string, q: string): string {
  if (!q || q.length < 2) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return text.replace(
    re,
    (m) =>
      `<mark style="background:#FEF08A;color:#0F172A;border-radius:3px;padding:0 2px">${m}</mark>`,
  );
}

function AgendaSearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState(() => loadRecent());
  const [types, setTypes] = useState<Set<AgendaEventType>>(new Set());
  const [withReminder, setWithReminder] = useState(false);
  const [period, setPeriod] = useState<"all" | "week">("all");

  const filters = useMemo<SearchFilters>(
    () => ({ types, withReminder, period }),
    [types, withReminder, period],
  );
  const anyFilter = types.size > 0 || withReminder || period !== "all";

  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: () => listAgendaEvents(),
    enabled: !!user,
  });

  const eventHits = useMemo(
    () => searchEvents(eventsQuery.data ?? [], q, filters),
    [eventsQuery.data, q, filters],
  );

  const showResults = q.trim().length >= 2 || anyFilter;

  const toggleType = (t: AgendaEventType) =>
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const onSubmitSearch = () => {
    if (q.trim()) {
      saveRecent(q.trim());
      setRecent(loadRecent());
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/agenda" })}
          className="-ml-1 inline-flex items-center gap-1 py-2 text-[13.5px] font-medium"
          style={{ color: "#6B7280" }}
        >
          <ArrowLeft size={18} strokeWidth={1.8} />
          Agenda
        </button>

        {/* Search bar */}
        <div className="mt-1.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitSearch();
            }}
          >
            <div
              className="flex h-12 items-center gap-2.5 rounded-xl px-3.5"
              style={{
                background: q ? "#FAFBFF" : "#F6F7FB",
                border: "1.5px solid #4F46E5",
                boxShadow: "0 0 0 4px rgba(79,70,229,0.10)",
              }}
            >
              <Search size={18} strokeWidth={1.8} color="#4F46E5" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar em tudo: anotações, compromissos, documentos…"
                autoFocus
                className="flex-1 bg-transparent text-[14.5px] font-medium outline-none placeholder:font-normal placeholder:text-[#9CA3AF]"
                style={{ color: "#0F172A" }}
              />
              {q ? (
                <button
                  type="button"
                  aria-label="Limpar"
                  onClick={() => setQ("")}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E5E7EB]"
                >
                  <X size={14} strokeWidth={2} color="#6B7280" />
                </button>
              ) : (
                <Filter size={16} strokeWidth={1.8} color="#6B7280" />
              )}
            </div>
          </form>
        </div>

        {/* Filtros funcionais (tipo, anexos, lembrete) */}
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {(Object.keys(TYPE_STYLES) as AgendaEventType[]).map((t) => {
            const st = TYPE_STYLES[t];
            const active = types.has(t);
            return (
              <FilterChip
                key={t}
                label={st.label}
                active={active}
                activeColor={st.col}
                activeTint={st.tint}
                onClick={() => toggleType(t)}
                icon={<TypeIcon type={t} size={13} color={active ? st.col : "#6B7280"} />}
              />
            );
          })}
          <FilterChip
            label="Com lembrete"
            active={withReminder}
            onClick={() => setWithReminder((v) => !v)}
            icon={<Bell size={13} strokeWidth={1.7} color={withReminder ? "#4F46E5" : "#6B7280"} />}
          />
        </div>

        {!showResults ? (
          <EmptySearchState
            recent={recent}
            onRecent={(r) => setQ(r)}
            onClearRecent={() => {
              try {
                window.localStorage.removeItem(RECENT_KEY);
              } catch {
                // ignore
              }
              setRecent([]);
            }}
            onShortcut={(target) => {
              if (target === "pending") {
                navigate({ to: "/agenda" });
              } else if (target === "week") {
                setPeriod("week");
              }
            }}
            onOpenGlobal={() => navigate({ to: "/busca" })}
          />
        ) : (
          <SearchResults
            query={q}
            events={eventHits}
            onOpen={(deepLink, id) => {
              // Para Compromissos, deepLink é /agenda/$id
              if (deepLink.startsWith("/agenda/")) {
                navigate({
                  to: "/agenda/$eventId",
                  params: { eventId: id },
                });
              }
            }}
          />
        )}

        <div className="h-10" />
      </div>
    </AppShell>
  );
}

function FilterChip({
  label,
  icon,
  active,
  activeColor = "#4F46E5",
  activeTint = "#EEF1FF",
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  activeColor?: string;
  activeTint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex h-[34px] flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors"
      style={{
        borderColor: active ? activeColor : "#E5E7EB",
        background: active ? activeTint : "#fff",
        color: active ? activeColor : "#374151",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptySearchState({
  recent,
  onRecent,
  onClearRecent,
  onShortcut,
  onOpenGlobal,
}: {
  recent: string[];
  onRecent: (r: string) => void;
  onClearRecent: () => void;
  onShortcut: (target: "pending" | "week") => void;
  onOpenGlobal: () => void;
}) {
  return (
    <>
      {recent.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: "#9CA3AF" }}
            >
              Buscas recentes
            </div>
            <button
              type="button"
              onClick={onClearRecent}
              className="bg-transparent text-[12px] font-semibold transition-colors hover:text-[#374151]"
              style={{ color: "#9CA3AF" }}
            >
              Limpar
            </button>
          </div>
          <div
            className="overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: "#EEF0F4" }}
          >
            {recent.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onRecent(r)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[#F4F5FA]"
                style={{
                  borderTop: i > 0 ? "1px solid #F1F2F6" : "none",
                }}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
                  style={{ background: "#F4F5FA" }}
                >
                  <Search size={16} strokeWidth={1.8} color="#6B7280" />
                </div>
                <div
                  className="min-w-0 flex-1 truncate text-sm font-semibold"
                  style={{ color: "#0F172A" }}
                >
                  {r}
                </div>
                <ChevronRight
                  size={16}
                  strokeWidth={1.8}
                  color="#9CA3AF"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div
          className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: "#9CA3AF" }}
        >
          Atalhos
        </div>
        <div
          className="overflow-hidden rounded-2xl border bg-white"
          style={{ borderColor: "#EEF0F4" }}
        >
          <ShortcutRow
            icon={<Bell size={16} strokeWidth={1.7} color={ALERT_TONE.bodyColor} />}
            label="Observações pendentes"
            onClick={() => onShortcut("pending")}
          />
          <div className="h-px bg-[#F1F2F6]" />
          <ShortcutRow
            icon={
              <Clock size={16} strokeWidth={1.7} color={AGENDA_BRAND.col} />
            }
            label="Compromissos da semana"
            onClick={() => onShortcut("week")}
          />
          <div className="h-px bg-[#F1F2F6]" />
          <ShortcutRow
            icon={
              <Search size={16} strokeWidth={1.7} color="#6B7280" />
            }
            label="Buscar em todo o app (registros, documentos…)"
            onClick={onOpenGlobal}
          />
        </div>
      </div>
    </>
  );
}

function ShortcutRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[#F4F5FA]"
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: "#F4F5FA" }}
      >
        {icon}
      </div>
      <div
        className="min-w-0 flex-1 text-sm font-semibold"
        style={{ color: "#0F172A" }}
      >
        {label}
      </div>
      <ChevronRight size={16} strokeWidth={1.8} color="#9CA3AF" />
    </button>
  );
}

function SearchResults({
  query,
  events,
  onOpen,
}: {
  query: string;
  events: ResultHit[];
  onOpen: (deepLink: string, id: string) => void;
}) {
  const total = events.length;
  if (total === 0) {
    return (
      <div
        className="mt-6 rounded-2xl border border-dashed px-4 py-10 text-center text-sm"
        style={{ borderColor: "#E5E7EB", color: "#9CA3AF" }}
      >
        Nada encontrado para "{query}". Tente outro termo.
      </div>
    );
  }
  return (
    <>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        <span
          className="inline-flex h-[26px] flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-bold"
          style={{ background: "#EEF1FF", color: "#4F46E5" }}
        >
          Tudo{" "}
          <span
            className="rounded-full bg-[#4F46E5] px-1.5 py-[1px] text-[10px] text-white"
          >
            {total}
          </span>
        </span>
        <span
          className="inline-flex h-[26px] flex-shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-semibold"
          style={{ background: "#F4F5FA", color: "#6B7280" }}
        >
          Compromissos · {events.length}
        </span>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "#9CA3AF" }}
          >
            Compromissos{" "}
            <span style={{ color: "#D1D5DB" }}>· {events.length}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {events.map((hit) => (
            <ResultCard key={hit.id} hit={hit} query={query} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </>
  );
}

function ResultCard({
  hit,
  query,
  onOpen,
}: {
  hit: ResultHit;
  query: string;
  onOpen: (deepLink: string, id: string) => void;
}) {
  const t = hit.type ? TYPE_STYLES[hit.type] : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(hit.deepLink, hit.id)}
      className="flex items-start gap-3 rounded-xl border bg-white px-3.5 py-3 text-left transition-shadow hover:shadow-md"
      style={{ borderColor: "#EEF0F4" }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: t?.tint ?? AGENDA_BRAND.tint }}
      >
        {hit.type ? (
          <TypeIcon type={hit.type} size={16} color={t!.col} />
        ) : (
          <Calendar size={16} strokeWidth={1.7} color={AGENDA_BRAND.col} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
          style={{ color: t?.col ?? AGENDA_BRAND.col }}
        >
          {hit.kind}
          {t ? ` · ${t.label}` : ""}
        </div>
        <div
          className="truncate text-sm font-bold"
          style={{ color: "#0F172A", letterSpacing: "-0.01em" }}
          dangerouslySetInnerHTML={{ __html: highlight(hit.title, query) }}
        />
        {hit.snippet && (
          <div
            className="mt-1 text-[12.5px] leading-snug"
            style={{ color: "#4B5563" }}
            dangerouslySetInnerHTML={{ __html: highlight(hit.snippet, query) }}
          />
        )}
        {hit.meta && (
          <div
            className="mt-1.5 text-[11.5px]"
            style={{ color: "#9CA3AF" }}
          >
            {hit.meta}
          </div>
        )}
      </div>
      <ChevronRight size={16} strokeWidth={1.8} color="#9CA3AF" />
    </button>
  );
}
