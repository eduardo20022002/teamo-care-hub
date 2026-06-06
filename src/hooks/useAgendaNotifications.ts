import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listAgendaEvents } from "@/services/agenda/events.service";
import type { AgendaEventType } from "@/types/agenda";

const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

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
  /** true quando read_at é null (notificação ainda não vista) */
  unread?: boolean;
}

interface AgendaNotificationRow {
  id: string;
  kind:
    | "event_one_day_before"
    | "event_one_hour_before"
    | "pending_observations"
    | "post_event_register_prompt"
    | "medication_due";
  event_id: string | null;
  fire_at: string;
  body: string;
  deep_link: string;
  read_at: string | null;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isYesterday(d: Date): boolean {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return isSameDay(d, y);
}
function fmtHourMin(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const KIND_TONE: Record<AgendaNotificationRow["kind"], NotifTone> = {
  event_one_day_before: "sage",
  event_one_hour_before: "sage",
  pending_observations: "warm",
  post_event_register_prompt: "neutral",
  medication_due: "rose",
};

const KIND_CTA: Partial<Record<AgendaNotificationRow["kind"], string>> = {
  pending_observations: "Abrir lista",
  post_event_register_prompt: "Registrar atendimento",
};

/**
 * Lê notificações da tabela agenda_notifications (materializadas server-side
 * por public.schedule_agenda_notifications via pg_cron).
 *
 * Em DEV bypass, fallback pra cálculo client-side a partir dos eventos atuais.
 */
export function useAgendaNotifications(): AgendaNotifItem[] {
  const { user } = useAuth();

  const dbQuery = useQuery({
    queryKey: ["agenda-notifications", user?.id],
    queryFn: async (): Promise<AgendaNotificationRow[]> => {
      const { data, error } = await supabase
        .from("agenda_notifications")
        .select("id, kind, event_id, fire_at, body, deep_link, read_at")
        .lte("fire_at", new Date().toISOString())
        .order("fire_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as AgendaNotificationRow[];
    },
    enabled: !!user && !DEV_BYPASS,
    refetchInterval: 60_000, // refresh a cada 1 min
  });

  // Fallback DEV: calcula localmente a partir dos eventos mock
  const eventsQuery = useQuery({
    queryKey: ["agenda-events"],
    queryFn: () => listAgendaEvents(),
    enabled: !!user && DEV_BYPASS,
  });

  if (DEV_BYPASS) {
    return computeLocal(eventsQuery.data ?? []);
  }

  const items: AgendaNotifItem[] = [];
  const now = new Date();
  for (const row of dbQuery.data ?? []) {
    const fireAt = new Date(row.fire_at);
    const group: AgendaNotifItem["group"] = isSameDay(fireAt, now)
      ? "Hoje"
      : isYesterday(fireAt)
      ? "Ontem"
      : "Mais antigas";
    items.push({
      id: row.id,
      time: group === "Hoje" ? fmtHourMin(fireAt) : `${group.toLowerCase()} ${fmtHourMin(fireAt)}`,
      title: row.body,
      body: "",
      tone: KIND_TONE[row.kind],
      cta: KIND_CTA[row.kind],
      deepLink: row.deep_link,
      group,
      unread: row.read_at === null,
    });
  }
  return items;
}

/**
 * Conta quantas notificações ainda não foram vistas (read_at null).
 */
export function useUnreadNotificationsCount(): number {
  const items = useAgendaNotifications();
  return items.reduce((acc, it) => acc + (it.unread ? 1 : 0), 0);
}

/**
 * Marca todas as notificações do usuário como vistas (read_at = now()).
 * Sincroniza na conta — some em todos os dispositivos.
 */
export function useMarkNotificationsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!user || DEV_BYPASS) return;
      const { error } = await supabase
        .from("agenda_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda-notifications", user?.id] });
    },
  });
}

function computeLocal(
  events: Awaited<ReturnType<typeof listAgendaEvents>>,
): AgendaNotifItem[] {
  const items: AgendaNotifItem[] = [];
  const now = new Date();
  for (const ev of events) {
    const startAt = new Date(ev.start_at);
    if (!isSameDay(startAt, now) && !isYesterday(startAt)) continue;
    if (ev.status === "missed" || ev.status === "rescheduled") continue;
    const group: AgendaNotifItem["group"] = isSameDay(startAt, now)
      ? "Hoje"
      : "Ontem";
    const oneHourBefore = new Date(startAt);
    oneHourBefore.setHours(startAt.getHours() - 1);
    if (
      isSameDay(startAt, now) &&
      ev.reminders.oneHourBefore &&
      now.getTime() >= oneHourBefore.getTime() &&
      now.getTime() <= startAt.getTime()
    ) {
      items.push({
        id: `${ev.id}-1h`,
        time: fmtHourMin(startAt),
        title: `Em 1 hora · ${ev.title}`,
        body: ev.locale
          ? `Saia em 30 minutos · ${ev.locale}`
          : "Preparar materiais.",
        tone: "sage",
        type: ev.type,
        group,
        deepLink: `/agenda/${ev.id}`,
      });
    }
    if (
      ev.type === "medicacao" &&
      isSameDay(startAt, now) &&
      Math.abs(now.getTime() - startAt.getTime()) <= 30 * 60 * 1000
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
        body: "Você não registrou o atendimento. Quer registrar?",
        tone: "neutral",
        cta: "Registrar atendimento",
        group,
        deepLink: "/registros",
      });
    }
  }
  return items;
}
