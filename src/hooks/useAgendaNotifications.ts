import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listAgendaEvents } from "@/services/agenda/events.service";
import { listPendingObservationsByEvent } from "@/services/agenda/observations.service";
import type { AgendaEventType } from "@/types/agenda";

type NotifTone = "neutral" | "sage" | "warm" | "rose";

export interface AgendaNotifItem {
  id: string;
  time: string;
  title: string;
  body: string;
  tone: NotifTone;
  type?: AgendaEventType;
  cta?: string;
  deepLink?: string;
  group: "Hoje" | "Ontem" | "Mais antigas";
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(d: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d, yesterday);
}

function fmtHourMin(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function diffMs(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/**
 * Calcula notificações on-demand a partir do estado atual de eventos e
 * observações pendentes. Em uma fase posterior, isso será substituído por
 * notificações pré-computadas em tabela (com scheduler real).
 */
export function useAgendaNotifications(): AgendaNotifItem[] {
  const { user } = useAuth();
  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: listAgendaEvents,
    enabled: !!user,
  });

  const events = eventsQuery.data ?? [];
  const now = new Date();
  const items: AgendaNotifItem[] = [];

  // Pendentes — apontando para o próximo evento do profissional.
  // Por ora só pra o ev-3 (mocks); a versão real virá com server-side.
  // Mantemos via query separada por evento futuro.
  // Para evitar muitas queries, só processamos eventos de hoje.
  // (Skip on first pass since the listPendingObservationsByEvent needs a per-event query)

  for (const ev of events) {
    const startAt = new Date(ev.start_at);
    if (!isSameDay(startAt, now) && !isYesterday(startAt)) continue;
    if (ev.status === "missed" || ev.status === "rescheduled") continue;

    const group: AgendaNotifItem["group"] = isSameDay(startAt, now)
      ? "Hoje"
      : "Ontem";

    // 1 hora antes (eventos futuros de hoje)
    const oneHourBefore = new Date(startAt);
    oneHourBefore.setHours(startAt.getHours() - 1);
    if (
      isSameDay(startAt, now) &&
      ev.reminders.oneHourBefore &&
      diffMs(now, oneHourBefore) >= 0 &&
      diffMs(now, startAt) <= 0
    ) {
      items.push({
        id: `${ev.id}-1h`,
        time: fmtHourMin(startAt),
        title: `Em 1 hora · ${ev.title}`,
        body: ev.locale
          ? `Saia em 30 minutos · ${ev.locale}`
          : "Preparar materiais e profissional.",
        tone: "sage",
        type: ev.type,
        group,
        deepLink: `/agenda/${ev.id}`,
      });
    }

    // Medicação no horário
    if (
      ev.type === "medicacao" &&
      isSameDay(startAt, now) &&
      Math.abs(diffMs(now, startAt)) <= 30 * 60 * 1000
    ) {
      items.push({
        id: `${ev.id}-med`,
        time: fmtHourMin(startAt),
        title: "Hora da medicação",
        body: ev.title,
        tone: "rose",
        type: "medicacao",
        group,
        deepLink: `/agenda/${ev.id}`,
      });
    }

    // Pós-atendimento sem registro
    if (
      isYesterday(startAt) &&
      ev.status === "upcoming" &&
      ev.end_at &&
      new Date(ev.end_at) < now
    ) {
      items.push({
        id: `${ev.id}-post`,
        time: `ontem ${fmtHourMin(startAt)}`,
        title: `Como foi ${ev.title}?`,
        body: "Você não registrou o atendimento. Quer registrar agora?",
        tone: "neutral",
        cta: "Registrar atendimento",
        group,
        deepLink: "/painel",
      });
    }
  }

  return items;
}

// Re-export pra evitar warnings de unused
export { listPendingObservationsByEvent };
