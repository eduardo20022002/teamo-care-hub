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

// ─── Exclusão de contas de teste das métricas ────────────────────────────────
// Estas contas são usadas para testes internos e NÃO devem contaminar os números
// do painel (totais, atividade, acessos etc.).
const TEST_ACCOUNT_EMAILS = [
  "eduardo.estevesterra@gmail.com",
  "eduardo.meirelles@ufpe.br",
  "ianetemporal@gmail.com",
];

let _testIdsCache: { ids: string[]; at: number } | null = null;

/** IDs dos perfis das contas de teste (cache de 60s). Vazio se nenhuma existir. */
export async function getTestUserIds(): Promise<string[]> {
  if (_testIdsCache && Date.now() - _testIdsCache.at < 60_000) return _testIdsCache.ids;
  const { data } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .in("email", TEST_ACCOUNT_EMAILS);
  const ids = (data ?? []).map((r: any) => r.id as string);
  _testIdsCache = { ids, at: Date.now() };
  return ids;
}

/** Aplica `col NOT IN (testIds)` a um query builder, se houver IDs a excluir. */
function excludeTest(q: any, ids: string[], col = "user_id"): any {
  return ids.length ? q.not(col, "in", `(${ids.join(",")})`) : q;
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
    pendingInvites: number;
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

  const testIds = await getTestUserIds();

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
    { count: pendingInvites },
  ] = await Promise.all([
    excludeTest((supabaseAdmin.from("profiles") as any).select("*", { count: "exact", head: true }), testIds, "id"),
    excludeTest((supabaseAdmin.from("professionals") as any).select("*", { count: "exact", head: true }), testIds),
    excludeTest((supabaseAdmin.from("children") as any).select("*", { count: "exact", head: true }), testIds),
    excludeTest((supabaseAdmin.from("attendance_records") as any).select("*", { count: "exact", head: true }), testIds),
    excludeTest((supabaseAdmin.from("child_attachments") as any).select("*", { count: "exact", head: true }), testIds),
    excludeTest((supabaseAdmin.from("agenda_events") as any).select("*", { count: "exact", head: true }), testIds),
    excludeTest((supabaseAdmin.from("shares") as any).select("*", { count: "exact", head: true }), testIds),
    // growth
    excludeTest((supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d7), testIds, "id"),
    excludeTest((supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d14)
      .lt("created_at", d7), testIds, "id"),
    excludeTest((supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d30), testIds, "id"),
    excludeTest((supabaseAdmin.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("created_at", d60)
      .lt("created_at", d30), testIds, "id"),
    // DAU/WAU/MAU via analytics_events session.start
    excludeTest((supabaseAdmin as any).from("analytics_events")
      .select("user_id")
      .eq("event_type", "session.start")
      .gte("created_at", d24h), testIds),
    excludeTest((supabaseAdmin as any).from("analytics_events")
      .select("user_id")
      .eq("event_type", "session.start")
      .gte("created_at", d7), testIds),
    excludeTest((supabaseAdmin as any).from("analytics_events")
      .select("user_id")
      .eq("event_type", "session.start")
      .gte("created_at", d30), testIds),
    // profissionais cadastrados (proxy para vínculos ativos)
    excludeTest((supabaseAdmin.from("professionals") as any)
      .select("*", { count: "exact", head: true }), testIds),
    excludeTest((supabaseAdmin.from("shares") as any)
      .select("*", { count: "exact", head: true })
      .not("consumed_at", "is", null), testIds),
    excludeTest((supabaseAdmin.from("shares") as any)
      .select("*", { count: "exact", head: true })
      .is("consumed_at", null)
      .lt("expires_at", now.toISOString()), testIds),
    // churn: sessões iniciadas antes de 30d atrás (proxy de usuários inativos)
    excludeTest((supabaseAdmin as any).from("analytics_events")
      .select("user_id", { count: "exact", head: true })
      .eq("event_type", "session.start")
      .lt("created_at", d30), testIds),
    // convites de cuidado compartilhado ainda pendentes e não expirados
    excludeTest((supabaseAdmin as any).from("care_invites")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .gt("expires_at", now.toISOString()), testIds, "owner_id"),
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
      pendingInvites: pendingInvites ?? 0,
    },
    churn: {
      inactiveOver30d: inactive30 ?? 0,
    },
  };
}

// ─── Listagens de usuários (admin) ──────────────────────────────────────────

export interface UserListRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

export async function fetchCaregiversList(): Promise<UserListRow[]> {
  const testIds = await getTestUserIds();
  const { data } = await excludeTest(
    (supabaseAdmin as any)
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("user_type", "parent")
      .order("created_at", { ascending: false }),
    testIds,
    "id",
  );
  return data ?? [];
}

export async function fetchTherapistsList(): Promise<UserListRow[]> {
  const testIds = await getTestUserIds();
  const { data } = await excludeTest(
    (supabaseAdmin as any)
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("user_type", "therapist")
      .order("created_at", { ascending: false }),
    testIds,
    "id",
  );
  return data ?? [];
}

export interface DiagnosticStat {
  diagnosis: string;
  count: number;
}

export async function fetchDiagnosticsStats(): Promise<DiagnosticStat[]> {
  const { data } = await (supabaseAdmin as any).rpc("get_diagnoses_stats");
  return (data ?? []).map((r: any) => ({ diagnosis: r.diagnosis as string, count: Number(r.count) }));
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
  const testIds = await getTestUserIds();

  const [moduleOpens, moduleActions, topEventsRows, otpRequested, otpSucceeded, sharesCreated, sharesExpired, errorRows] =
    await Promise.all([
      // opens por módulo
      excludeTest((supabaseAdmin as any).from("analytics_events")
        .select("module")
        .eq("event_type", "module.open")
        .gte("created_at", d30), testIds),
      // ações (create/upload/etc) por módulo
      excludeTest((supabaseAdmin as any).from("analytics_events")
        .select("module")
        .in("event_type", ["record.create", "document.upload", "event.create", "share.create", "professional.invite"])
        .gte("created_at", d30), testIds),
      // top eventos
      excludeTest((supabaseAdmin as any).from("analytics_events")
        .select("event_type")
        .gte("created_at", d30)
        .limit(2000), testIds),
      // funil OTP — usa audit_logs (logShareEvent já registra esses eventos)
      (supabaseAdmin.from("audit_logs") as any)
        .select("*", { count: "exact", head: true })
        .eq("event_type", "share.otp_requested")
        .gte("created_at", d30),
      (supabaseAdmin.from("audit_logs") as any)
        .select("*", { count: "exact", head: true })
        .eq("event_type", "share.otp_succeeded")
        .gte("created_at", d30),
      excludeTest((supabaseAdmin.from("shares") as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", d30), testIds),
      excludeTest((supabaseAdmin.from("shares") as any)
        .select("*", { count: "exact", head: true })
        .is("consumed_at", null)
        .lt("expires_at", new Date().toISOString())
        .gte("created_at", d30), testIds),
      // erros JS
      excludeTest((supabaseAdmin as any).from("analytics_events")
        .select("route")
        .eq("event_type", "error.js")
        .gte("created_at", d30)
        .limit(500), testIds),
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

// ─── Atividade de Acesso (admin) ─────────────────────────────────────────────

export interface LoginSessionRow {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  userType: string | null;
  therapistPlan: string | null;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  endReason: string | null;
  ip: string | null;
  userAgent: string | null;
  durationMinutes: number;
  active: boolean;
}

export interface LoginActivityData {
  kpis: { activeNow: number; loginsToday: number; avgDurationMinutes: number };
  recentSessions: LoginSessionRow[];
  /** Logins por dia nos últimos 30 dias (ordem crescente). */
  loginsPerDay: { date: string; count: number }[];
  /** Matriz [diaDaSemana 0=Dom..6=Sáb][hora 0..23] = nº de logins. */
  peakHours: number[][];
}

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // "ativo agora" = visto nos últimos 5 min

function sessionDurationMs(startedAt: string, lastSeenAt: string, endedAt: string | null): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt ?? lastSeenAt).getTime();
  return Math.max(0, end - start);
}

export async function fetchLoginActivityData(): Promise<LoginActivityData> {
  const now = Date.now();
  const d30 = new Date(now - 30 * 86400_000).toISOString();
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const testIds = await getTestUserIds();

  // Sessões dos últimos 30 dias com dados do perfil (join via FK user_id → profiles).
  const { data: rows } = await excludeTest(
    (supabaseAdmin as any)
      .from("user_sessions")
      .select(
        "id, user_id, started_at, last_seen_at, ended_at, end_reason, ip, user_agent, " +
          "profiles:user_id (full_name, email, user_type, therapist_plan)",
      )
      .gte("started_at", d30)
      .order("started_at", { ascending: false }),
    testIds,
  );

  const sessions: any[] = rows ?? [];

  // KPIs
  let activeNow = 0;
  let loginsToday = 0;
  let durationSum = 0;
  const peakHours: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const perDay = new Map<string, number>();

  for (const s of sessions) {
    const startedAt = s.started_at as string;
    const lastSeenAt = s.last_seen_at as string;
    const endedAt = (s.ended_at as string | null) ?? null;

    const isActive = !endedAt && now - new Date(lastSeenAt).getTime() < ACTIVE_WINDOW_MS;
    if (isActive) activeNow++;
    if (startedAt >= startOfToday) loginsToday++;
    durationSum += sessionDurationMs(startedAt, lastSeenAt, endedAt);

    const d = new Date(startedAt);
    peakHours[d.getDay()][d.getHours()]++;
    const key = d.toISOString().slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }

  const avgDurationMinutes = sessions.length
    ? Math.round(durationSum / sessions.length / 60000)
    : 0;

  // Série de 30 dias preenchida (inclui dias sem login = 0).
  const loginsPerDay: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(now - i * 86400_000).toISOString().slice(0, 10);
    loginsPerDay.push({ date: key, count: perDay.get(key) ?? 0 });
  }

  // Lista das 50 sessões mais recentes (a UI mostra um trecho; o log completo
  // fica na visão paginada via fetchAccessLog).
  const recentSessions: LoginSessionRow[] = sessions.slice(0, 50).map(mapSessionRow);

  return {
    kpis: { activeNow, loginsToday, avgDurationMinutes },
    recentSessions,
    loginsPerDay,
    peakHours,
  };
}

/** Converte uma linha de user_sessions (com join de profiles) em LoginSessionRow. */
function mapSessionRow(s: any): LoginSessionRow {
  const now = Date.now();
  const p = s.profiles ?? {};
  const endedAt = (s.ended_at as string | null) ?? null;
  const lastSeenAt = s.last_seen_at as string;
  return {
    id: s.id as string,
    userId: s.user_id as string,
    fullName: (p.full_name as string | null) ?? null,
    email: (p.email as string | null) ?? null,
    userType: (p.user_type as string | null) ?? null,
    therapistPlan: (p.therapist_plan as string | null) ?? null,
    startedAt: s.started_at as string,
    lastSeenAt,
    endedAt,
    endReason: (s.end_reason as string | null) ?? null,
    ip: (s.ip as string | null) ?? null,
    userAgent: (s.user_agent as string | null) ?? null,
    durationMinutes: Math.round(sessionDurationMs(s.started_at as string, lastSeenAt, endedAt) / 60000),
    active: !endedAt && now - new Date(lastSeenAt).getTime() < ACTIVE_WINDOW_MS,
  };
}

export interface AccessLogPage {
  rows: LoginSessionRow[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Log COMPLETO de acessos (sem limite de tempo), paginado. Exclui contas de teste.
 * Usado pela visão "log completo" do painel — diferente de fetchLoginActivityData,
 * que é limitado a 30 dias e às 50 sessões mais recentes para o resumo.
 */
export async function fetchAccessLog(opts: { limit?: number; offset?: number } = {}): Promise<AccessLogPage> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const testIds = await getTestUserIds();

  const { data: rows, count } = await excludeTest(
    (supabaseAdmin as any)
      .from("user_sessions")
      .select(
        "id, user_id, started_at, last_seen_at, ended_at, end_reason, ip, user_agent, " +
          "profiles:user_id (full_name, email, user_type, therapist_plan)",
        { count: "exact" },
      )
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1),
    testIds,
  );

  return {
    rows: (rows ?? []).map(mapSessionRow),
    total: count ?? 0,
    offset,
    limit,
  };
}
