// ServerFns para o Dashboard de Evolução do paciente.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type MilestoneArea =
  | "comunicacao"
  | "socializacao"
  | "autonomia"
  | "comportamento"
  | "cognicao"
  | "motricidade";

export interface AreaStats {
  total: number;
  atingido: number;
  em_progresso: number;
  pausado: number;
}

export interface DashboardData {
  child: { id: string; name: string; birth_date: string };
  milestonesByArea: Record<MilestoneArea, AreaStats>;
  achievedMilestones: Array<{ id: string; title: string; area: string; achieved_at: string }>;
  goalStats: { total: number; achieved: number };
  sessionsByMonth: Array<{ month: string; happened: number; missed: number }>;
  engagementHistory: Array<{ date: string; level: "baixo" | "medio" | "alto"; title: string }>;
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const MILESTONE_AREAS: MilestoneArea[] = [
  "comunicacao",
  "socializacao",
  "autonomia",
  "comportamento",
  "cognicao",
  "motricidade",
];

function emptyMilestonesByArea(): Record<MilestoneArea, AreaStats> {
  const result = {} as Record<MilestoneArea, AreaStats>;
  for (const area of MILESTONE_AREAS) {
    result[area] = { total: 0, atingido: 0, em_progresso: 0, pausado: 0 };
  }
  return result;
}

/** Últimos 6 meses no formato YYYY-MM, do mais antigo para o mais recente. */
function buildLastSixMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months;
}

function buildDashboardData(
  child: { id: string; name: string; birth_date: string },
  milestones: any[],
  goals: any[],
  sessions: any[],
  engagementRecords: any[],
): DashboardData {
  // ── milestonesByArea ────────────────────────────────────────────────────────
  const milestonesByArea = emptyMilestonesByArea();
  for (const m of milestones) {
    const area = m.area as MilestoneArea;
    if (!(area in milestonesByArea)) continue;
    milestonesByArea[area].total++;
    if (m.status === "atingido") milestonesByArea[area].atingido++;
    else if (m.status === "pausado") milestonesByArea[area].pausado++;
    else milestonesByArea[area].em_progresso++;
  }

  // ── achievedMilestones ──────────────────────────────────────────────────────
  const achievedMilestones = milestones
    .filter((m) => m.status === "atingido" && m.achieved_at)
    .sort(
      (a, b) =>
        new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime(),
    )
    .slice(0, 20)
    .map((m) => ({
      id: m.id as string,
      title: m.title as string,
      area: m.area as string,
      achieved_at: m.achieved_at as string,
    }));

  // ── goalStats ───────────────────────────────────────────────────────────────
  const goalStats = {
    total: goals.length,
    achieved: goals.filter((g) => (g as any).status === "atingido").length,
  };

  // ── sessionsByMonth ─────────────────────────────────────────────────────────
  const monthSlots = buildLastSixMonths();
  const sessionMap: Record<string, { happened: number; missed: number }> = {};
  for (const m of monthSlots) sessionMap[m] = { happened: 0, missed: 0 };

  for (const s of sessions) {
    if (!s.start_at || !s.session_attendance) continue;
    const month = (s.start_at as string).slice(0, 7);
    if (!sessionMap[month]) continue;
    if (s.session_attendance === "happened") sessionMap[month].happened++;
    else sessionMap[month].missed++;
  }

  const sessionsByMonth = monthSlots.map((m) => ({
    month: m,
    happened: sessionMap[m].happened,
    missed: sessionMap[m].missed,
  }));

  // ── engagementHistory ───────────────────────────────────────────────────────
  const engagementHistory = engagementRecords
    .filter((r) => r.engagement_level && (r.agenda_events as any)?.start_at)
    .slice() // não mutar original
    .reverse() // recebemos DESC do servidor; invertemos para cronológico
    .map((r) => ({
      date: (r.agenda_events as any).start_at as string,
      level: r.engagement_level as "baixo" | "medio" | "alto",
      title: ((r.agenda_events as any).title ?? "Sessão") as string,
    }));

  return {
    child,
    milestonesByArea,
    achievedMilestones,
    goalStats,
    sessionsByMonth,
    engagementHistory,
  };
}

async function assertTherapist(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .maybeSingle();
  if ((profile as any)?.user_type !== "therapist") {
    throw new Response("Apenas terapeutas podem executar esta ação.", {
      status: 403,
    });
  }
}

async function assertParentAccess(
  accessId: string,
  userId: string,
): Promise<{ therapistId: string; childId: string }> {
  const { data: access } = await (supabaseAdmin as any)
    .from("therapist_parent_access")
    .select("therapist_id, child_id")
    .eq("id", accessId)
    .eq("parent_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!access)
    throw new Response("Acesso não encontrado ou revogado.", { status: 404 });
  return {
    therapistId: (access as any).therapist_id,
    childId: (access as any).child_id,
  };
}

// ─── 1. getTherapistPatientDashboardServer ────────────────────────────────────

export const getTherapistPatientDashboardServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    // 6 meses atrás (para o comparecimento)
    const sixMonthsAgo = new Date(
      Date.now() - 6 * 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      { data: child },
      { data: milestones },
      { data: goals },
      { data: sessions },
      { data: engagementRecords },
    ] = await Promise.all([
      supabaseAdmin
        .from("children")
        .select("id, name, birth_date")
        .eq("id", data.childId)
        .maybeSingle(),

      (supabaseAdmin as any)
        .from("therapeutic_milestones")
        .select("id, title, area, status, achieved_at")
        .eq("child_id", data.childId)
        .eq("therapist_id", userId)
        .order("created_at", { ascending: true }),

      (supabaseAdmin as any)
        .from("milestone_goals")
        .select("id, status")
        .eq("child_id", data.childId)
        .eq("therapist_id", userId),

      (supabaseAdmin as any)
        .from("agenda_events")
        .select("id, start_at, session_attendance")
        .eq("child_id", data.childId)
        .eq("therapist_id", userId)
        .eq("type", "terapia")
        .gte("start_at", sixMonthsAgo)
        .order("start_at", { ascending: true }),

      (supabaseAdmin as any)
        .from("session_records")
        .select("engagement_level, agenda_events!inner(start_at, title)")
        .eq("child_id", data.childId)
        .eq("therapist_id", userId)
        .eq("is_draft", false)
        .not("engagement_level", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!child)
      throw new Response("Paciente não encontrado.", { status: 404 });

    return buildDashboardData(
      child as { id: string; name: string; birth_date: string },
      milestones ?? [],
      goals ?? [],
      sessions ?? [],
      engagementRecords ?? [],
    );
  });

// ─── 2. getParentPatientDashboardServer ──────────────────────────────────────

export const getParentPatientDashboardServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const { therapistId, childId } = await assertParentAccess(
      data.accessId,
      userId,
    );

    const sixMonthsAgo = new Date(
      Date.now() - 6 * 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const [
      { data: child },
      { data: milestones },
      { data: goals },
      { data: sessions },
      { data: engagementRecords },
    ] = await Promise.all([
      supabaseAdmin
        .from("children")
        .select("id, name, birth_date")
        .eq("id", childId)
        .maybeSingle(),

      // Apenas marcos compartilhados com pais
      (supabaseAdmin as any)
        .from("therapeutic_milestones")
        .select("id, title, area, status, achieved_at")
        .eq("child_id", childId)
        .eq("therapist_id", therapistId)
        .eq("is_shared_with_parents", true)
        .order("created_at", { ascending: true }),

      // Goals apenas de marcos compartilhados (sub-select via milestone_id)
      (supabaseAdmin as any)
        .from("milestone_goals")
        .select("id, status, milestone_id, therapeutic_milestones!inner(is_shared_with_parents)")
        .eq("child_id", childId)
        .eq("therapist_id", therapistId)
        .eq("therapeutic_milestones.is_shared_with_parents", true),

      (supabaseAdmin as any)
        .from("agenda_events")
        .select("id, start_at, session_attendance")
        .eq("child_id", childId)
        .eq("therapist_id", therapistId)
        .eq("type", "terapia")
        .gte("start_at", sixMonthsAgo)
        .order("start_at", { ascending: true }),

      // Engajamento: apenas registros publicados e não-privados
      (supabaseAdmin as any)
        .from("session_records")
        .select("engagement_level, agenda_events!inner(start_at, title)")
        .eq("child_id", childId)
        .eq("therapist_id", therapistId)
        .eq("is_draft", false)
        .eq("is_private", false)
        .not("engagement_level", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (!child)
      throw new Response("Paciente não encontrado.", { status: 404 });

    return buildDashboardData(
      child as { id: string; name: string; birth_date: string },
      milestones ?? [],
      // Para goals do portal dos pais, filtramos os que têm marco compartilhado
      (goals ?? []).filter(
        (g: any) => (g.therapeutic_milestones as any)?.is_shared_with_parents,
      ),
      sessions ?? [],
      engagementRecords ?? [],
    );
  });
