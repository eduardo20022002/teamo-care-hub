// Server-only: implementação central de analytics.
// Nunca importar diretamente do cliente — usar analytics.functions.ts (ServerFn).
// Falhas são silenciosas: analytics NUNCA quebra a UX do usuário.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logger } from "@/lib/logger";

export interface TrackEventPayload {
  userId: string;
  sessionId?: string;
  eventType: string;
  module?: string;
  route?: string;
  durationMs?: number;
  /** Metadados extras — NUNCA incluir PHI: nomes, emails, textos clínicos, diagnósticos */
  properties?: Record<string, string | number | boolean | null>;
}

/**
 * Insere um evento de analytics na tabela analytics_events.
 * Silencia qualquer erro — analytics nunca bloqueia a operação do usuário.
 */
export async function trackEvent(payload: TrackEventPayload): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any).from("analytics_events").insert({
      user_id: payload.userId,
      session_id: payload.sessionId ?? null,
      event_type: payload.eventType,
      module: payload.module ?? null,
      route: payload.route ?? null,
      duration_ms: payload.durationMs ?? null,
      properties: payload.properties ?? {},
    });

    if (error) {
      logger.error("analytics.insert_failed", {
        failureCode: error.code ?? "unknown",
        event_type: payload.eventType,
      });
    }
  } catch (e) {
    logger.error("analytics.track_exception", {
      failureCode: e instanceof Error ? e.message.slice(0, 80) : "unknown",
      event_type: payload.eventType,
    });
  }
}

// ─── Queries de métricas admin ───────────────────────────────────────────────
// Usadas por admin-metrics.functions.ts. Todas verificam is_admin no caller.

/** Verifica se um userId tem is_admin = true. Lança 403 se não. */
export async function assertAdmin(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.is_admin) {
    throw new Response("Proibido.", { status: 403 });
  }
}

// ─── Saúde do Negócio ────────────────────────────────────────────────────────

export interface BusinessHealthData {
  totals: {
    caregivers: number;
    professionals: number;
    children: number;
    records: number;
    documents: number;
    events: number;
    shares: number;
  };
  growth: {
    caregiversThisWeek: number;
    caregiversLastWeek: number;
    caregiversThisMonth: number;
    caregiversLastMonth: number;
  };
  activity: {
    dau: number;  // distinct users last 24h
    wau: number;  // distinct users last 7d
    mau: number;  // distinct users last 30d
  };
  links: {
    childrenWithProfessional: number;
    sharesCreated: number;
    sharesConsumed: number;
    sharesExpiredUnused: number;
  };
  churn: {
    inactiveOver30d: number;
  };
}

export async function fetchBusinessHealthData(): Promise<BusinessHealthData> {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 86400_000).toISOString();
  const d30 = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const d60 = new Date(now.getTime() - 60 * 86400_000).toISOString();
  const d24h = new Date(now.getTime() - 86400_000).toISOString();

  const [
    { count: caregivers },
    { count: professionals },
    { count: children },
    { count: records },
    { count: documents },
    { count: agendaEvents },
    { count: shares },
    { count: caregiversThisWeek },
    { count: caregiversLastWeek },
    { count: caregiversThisMonth },
    { count: caregiversLastMonth },
    dauRows,
    wauRows,
    mauRows,
    { count: professionalsLinked },
    { count: sharesConsumed },
    { count: sharesExpiredUnused },
    { count: inactive30 },
  ] = await Promise.all([
    (supabaseAdmin.from("profiles") as any).select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("professionals") as any).select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("children") as any).select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("attendance_records") as any).select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("child_attachments") as any).select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("agenda_events") as any).select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("shares") as any).select("*", { count: "exact", head: true }),
    // growth
    (supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d7),
    (supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d14)
      .lt("created_at", d7),
    (supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d30),
    (supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d60)
      .lt("created_at", d30),
    // DAU/WAU/MAU via analytics_events session.start
    (supabaseAdmin as any).from("analytics_events")
      .select("user_id")
      .eq("event_type", "session.start")
      .gte("created_at", d24h),
    (supabaseAdmin as any).from("analytics_events")
      .select("user_id")
      .eq("event_type", "session.start")
      .gte("created_at", d7),
    (supabaseAdmin as any).from("analytics_events")
      .select("user_id")
      .eq("event_type", "session.start")
      .gte("created_at", d30),
    // profissionais cadastrados (proxy para vínculos ativos)
    (supabaseAdmin.from("professionals") as any)
      .select("*", { count: "exact", head: true }),
    (supabaseAdmin.from("shares") as any)
      .select("*", { count: "exact", head: true })
      .not("consumed_at", "is", null),
    (supabaseAdmin.from("shares") as any)
      .select("*", { count: "exact", head: true })
      .is("consumed_at", null)
      .lt("expires_at", now.toISOString()),
    // churn: sessões iniciadas antes de 30d atrás (proxy de usuários inativos)
    (supabaseAdmin as any).from("analytics_events")
      .select("user_id", { count: "exact", head: true })
      .eq("event_type", "session.start")
      .lt("created_at", d30),
  ]);

  const uniqueIds = (rows: { user_id: string }[] | null) =>
    new Set((rows ?? []).map((r) => r.user_id)).size;

  return {
    totals: {
      caregivers: caregivers ?? 0,
      professionals: professionals ?? 0,
      children: children ?? 0,
      records: records ?? 0,
      documents: documents ?? 0,
      events: agendaEvents ?? 0,
      shares: shares ?? 0,
    },
    growth: {
      caregiversThisWeek: caregiversThisWeek ?? 0,
      caregiversLastWeek: caregiversLastWeek ?? 0,
      caregiversThisMonth: caregiversThisMonth ?? 0,
      caregiversLastMonth: caregiversLastMonth ?? 0,
    },
    activity: {
      dau: uniqueIds(dauRows.data as any),
      wau: uniqueIds(wauRows.data as any),
      mau: uniqueIds(mauRows.data as any),
    },
    links: {
      childrenWithProfessional: professionalsLinked ?? 0,
      sharesCreated: shares ?? 0,
      sharesConsumed: sharesConsumed ?? 0,
      sharesExpiredUnused: sharesExpiredUnused ?? 0,
    },
    churn: {
      inactiveOver30d: inactive30 ?? 0,
    },
  };
}

// ─── Comportamento dos Usuários ──────────────────────────────────────────────

export interface UserBehaviorData {
  moduleAdoption: { module: string; opens: number; actions: number }[];
  topEvents: { event_type: string; count: number }[];
  otpFunnel: {
    created: number;
    otpRequested: number;
    otpSucceeded: number;
    expiredUnused: number;
  };
  recentErrors: { route: string | null; count: number }[];
}

export async function fetchUserBehaviorData(): Promise<UserBehaviorData> {
  const d30 = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [moduleOpens, moduleActions, topEventsRows, otpRequested, otpSucceeded, sharesCreated, sharesExpired, errorRows] =
    await Promise.all([
      // opens por módulo
      (supabaseAdmin as any).from("analytics_events")
        .select("module")
        .eq("event_type", "module.open")
        .gte("created_at", d30),
      // ações (create/upload/etc) por módulo
      (supabaseAdmin as any).from("analytics_events")
        .select("module")
        .in("event_type", ["record.create", "document.upload", "event.create", "share.create", "professional.invite"])
        .gte("created_at", d30),
      // top eventos
      (supabaseAdmin as any).from("analytics_events")
        .select("event_type")
        .gte("created_at", d30)
        .limit(2000),
      // funil OTP — usa audit_logs (logShareEvent já registra esses eventos)
      (supabaseAdmin.from("audit_logs") as any)
        .select("*", { count: "exact", head: true })
        .eq("event_type", "share.otp_requested")
        .gte("created_at", d30),
      (supabaseAdmin.from("audit_logs") as any)
        .select("*", { count: "exact", head: true })
        .eq("event_type", "share.otp_succeeded")
        .gte("created_at", d30),
      (supabaseAdmin.from("shares") as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", d30),
      (supabaseAdmin.from("shares") as any)
        .select("*", { count: "exact", head: true })
        .is("consumed_at", null)
        .lt("expires_at", new Date().toISOString())
        .gte("created_at", d30),
      // erros JS
      (supabaseAdmin as any).from("analytics_events")
        .select("route")
        .eq("event_type", "error.js")
        .gte("created_at", d30)
        .limit(500),
    ]);

  // agregar módulos
  const modules = ["registros", "documentos", "agenda", "profissionais", "compartilhamento"];
  const countBy = (rows: { module: string }[] | null, mod: string) =>
    (rows ?? []).filter((r) => r.module === mod).length;

  const moduleAdoption = modules.map((mod) => ({
    module: mod,
    opens: countBy(moduleOpens.data as any, mod),
    actions: countBy(moduleActions.data as any, mod),
  }));

  // top eventos
  const eventCounts = new Map<string, number>();
  for (const row of (topEventsRows.data as any) ?? []) {
    eventCounts.set(row.event_type, (eventCounts.get(row.event_type) ?? 0) + 1);
  }
  const topEvents = [...eventCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([event_type, count]) => ({ event_type, count }));

  // erros por rota
  const routeCounts = new Map<string, number>();
  for (const row of (errorRows.data as any) ?? []) {
    const r = row.route ?? "(desconhecida)";
    routeCounts.set(r, (routeCounts.get(r) ?? 0) + 1);
  }
  const recentErrors = [...routeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([route, count]) => ({ route, count }));

  return {
    moduleAdoption,
    topEvents,
    otpFunnel: {
      created: sharesCreated.count ?? 0,
      otpRequested: otpRequested.count ?? 0,
      otpSucceeded: otpSucceeded.count ?? 0,
      expiredUnused: sharesExpired.count ?? 0,
    },
    recentErrors,
  };
}

// ─── Saúde Técnica ───────────────────────────────────────────────────────────

export interface TechnicalHealthData {
  webVitals: { route: string; metric: string; p75: number; unit: string }[];
  errorRate: { event_type: string; count: number; last24h: number }[];
  jsErrors: { route: string | null; message: string | null; count: number }[];
  supabaseStatus: "operational" | "degraded" | "unknown";
}

export async function fetchTechnicalHealthData(): Promise<TechnicalHealthData> {
  const d7 = new Date(Date.now() - 7 * 86400_000).toISOString();
  const d24h = new Date(Date.now() - 86400_000).toISOString();

  const [webVitalsRows, errorRows7d, errorRows24h, jsErrorRows, supabaseStatusResult] =
    await Promise.all([
      // Web Vitals
      (supabaseAdmin as any).from("analytics_events")
        .select("route, properties, duration_ms")
        .eq("event_type", "web_vitals")
        .gte("created_at", d7)
        .limit(1000),
      // erros por tipo (7d)
      (supabaseAdmin as any).from("analytics_events")
        .select("event_type")
        .like("event_type", "error.%")
        .gte("created_at", d7),
      // erros últimas 24h
      (supabaseAdmin as any).from("analytics_events")
        .select("event_type")
        .like("event_type", "error.%")
        .gte("created_at", d24h),
      // erros JS agrupados por rota e mensagem
      (supabaseAdmin as any).from("analytics_events")
        .select("route, properties")
        .eq("event_type", "error.js")
        .gte("created_at", d7)
        .limit(500),
      // Ping Supabase status
      fetch("https://status.supabase.com/api/v2/status.json", {
        signal: AbortSignal.timeout(5000),
      })
        .then((r) => r.json())
        .catch(() => null),
    ]);

  // p75 por rota+métrica
  type VitalKey = string;
  const vitalsMap = new Map<VitalKey, number[]>();
  for (const row of (webVitalsRows.data as any) ?? []) {
    const props = row.properties as Record<string, unknown>;
    const metric = (props?.metric as string) ?? "unknown";
    const value = (props?.value as number) ?? row.duration_ms;
    if (typeof value === "number") {
      const key = `${row.route ?? "/"}|${metric}`;
      if (!vitalsMap.has(key)) vitalsMap.set(key, []);
      vitalsMap.get(key)!.push(value);
    }
  }
  const p75 = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  };
  const METRIC_UNIT: Record<string, string> = { LCP: "ms", CLS: "", INP: "ms" };
  const webVitals = [...vitalsMap.entries()].map(([key, values]) => {
    const [route, metric] = key.split("|");
    return { route, metric, p75: Math.round(p75(values)), unit: METRIC_UNIT[metric] ?? "ms" };
  });

  // erros por tipo
  const count7d = new Map<string, number>();
  for (const row of (errorRows7d.data as any) ?? []) {
    count7d.set(row.event_type, (count7d.get(row.event_type) ?? 0) + 1);
  }
  const count24h = new Map<string, number>();
  for (const row of (errorRows24h.data as any) ?? []) {
    count24h.set(row.event_type, (count24h.get(row.event_type) ?? 0) + 1);
  }
  const errorRate = [...count7d.entries()].map(([event_type, count]) => ({
    event_type,
    count,
    last24h: count24h.get(event_type) ?? 0,
  }));

  // erros JS por rota + mensagem
  const jsMap = new Map<string, number>();
  for (const row of (jsErrorRows.data as any) ?? []) {
    const props = row.properties as Record<string, unknown>;
    const msg = ((props?.message as string) ?? "").slice(0, 80);
    const key = `${row.route ?? ""}|${msg}`;
    jsMap.set(key, (jsMap.get(key) ?? 0) + 1);
  }
  const jsErrors = [...jsMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => {
      const [route, message] = key.split("|");
      return { route: route || null, message: message || null, count };
    });

  // status do Supabase
  let supabaseStatus: TechnicalHealthData["supabaseStatus"] = "unknown";
  try {
    const indicator = supabaseStatusResult?.status?.indicator as string | undefined;
    if (indicator === "none") supabaseStatus = "operational";
    else if (indicator) supabaseStatus = "degraded";
  } catch {
    supabaseStatus = "unknown";
  }

  return { webVitals, errorRate, jsErrors, supabaseStatus };
}
