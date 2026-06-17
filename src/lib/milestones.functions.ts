// ServerFns para o módulo de Evolução — Marcos de Desenvolvimento.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { milestoneSchema, milestoneGoalSchema } from "@/lib/validation";
import { isTherapistPremium } from "@/lib/subscription.functions";

// ─── Helper: verificação de papel ────────────────────────────────────────────

async function assertTherapist(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .maybeSingle();
  if ((profile as any)?.user_type !== "therapist") {
    throw new Response("Apenas terapeutas podem executar esta ação.", { status: 403 });
  }
}

// ─── Helper: verificar ownership do marco ────────────────────────────────────

async function assertMilestoneOwner(milestoneId: string, userId: string): Promise<any> {
  const { data } = await supabaseAdmin
    .from("therapeutic_milestones" as any)
    .select("*")
    .eq("id", milestoneId)
    .eq("therapist_id", userId)
    .maybeSingle();
  if (!data) {
    throw new Response("Marco não encontrado ou sem permissão.", { status: 404 });
  }
  return data;
}

// ─── 1. listMilestonesServer ──────────────────────────────────────────────────

export const listMilestonesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    const { data: milestones, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .select("*")
      .eq("child_id", data.childId)
      .eq("therapist_id", userId)
      .order("area", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw new Response(error.message, { status: 500 });
    return { milestones: milestones ?? [] };
  });

// ─── 2. getMilestoneServer ────────────────────────────────────────────────────

export const getMilestoneServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ milestoneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    const milestone = await assertMilestoneOwner(data.milestoneId, userId);
    return { milestone };
  });

// ─── 3. createMilestoneServer ─────────────────────────────────────────────────

export const createMilestoneServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => milestoneSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    // Compartilhar marco com pais é Premium: no free, força não compartilhado.
    const sharedWithParents =
      (await isTherapistPremium(userId)) ? data.isSharedWithParents : false;

    const now = new Date().toISOString();
    const { data: created, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .insert({
        therapist_id:          userId,
        child_id:              data.childId,
        title:                 data.title,
        area:                  data.area,
        description:           data.description ?? null,
        is_shared_with_parents: sharedWithParents,
        status:                "em_progresso",
        started_at:            now,
        created_at:            now,
        updated_at:            now,
      })
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { milestone: created };
  });

// ─── 4. updateMilestoneServer ─────────────────────────────────────────────────

export const updateMilestoneServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    milestoneSchema.extend({ milestoneId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    await assertMilestoneOwner(data.milestoneId, userId);

    // Compartilhar marco com pais é Premium: no free, força não compartilhado.
    const sharedWithParents =
      (await isTherapistPremium(userId)) ? data.isSharedWithParents : false;

    const { data: updated, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .update({
        title:                 data.title,
        area:                  data.area,
        description:           data.description ?? null,
        is_shared_with_parents: sharedWithParents,
        updated_at:            new Date().toISOString(),
      })
      .eq("id", data.milestoneId)
      .eq("therapist_id", userId)
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { milestone: updated };
  });

// ─── 5. achieveMilestoneServer ────────────────────────────────────────────────

export const achieveMilestoneServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ milestoneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    const existing = await assertMilestoneOwner(data.milestoneId, userId);

    if ((existing as any).status === "atingido") {
      throw new Response("Marco já foi marcado como atingido.", { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .update({
        status:      "atingido",
        achieved_at: now,
        updated_at:  now,
      })
      .eq("id", data.milestoneId)
      .eq("therapist_id", userId)
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { milestone: updated };
  });

// ─── 6. pauseResumeMilestoneServer ───────────────────────────────────────────

export const pauseResumeMilestoneServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ milestoneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    const existing = await assertMilestoneOwner(data.milestoneId, userId);

    if ((existing as any).status === "atingido") {
      throw new Response("Marcos atingidos não podem ser alterados.", { status: 409 });
    }

    const newStatus =
      (existing as any).status === "pausado" ? "em_progresso" : "pausado";

    const { data: updated, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", data.milestoneId)
      .eq("therapist_id", userId)
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { milestone: updated };
  });

// ═══════════════════════════════════════════════════════════════════════════════
// METAS TERAPÊUTICAS (milestone_goals)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: verificar ownership da meta ─────────────────────────────────────

async function assertGoalOwner(goalId: string, userId: string): Promise<any> {
  const { data } = await supabaseAdmin
    .from("milestone_goals" as any)
    .select("*")
    .eq("id", goalId)
    .eq("therapist_id", userId)
    .maybeSingle();
  if (!data) {
    throw new Response("Meta não encontrada ou sem permissão.", { status: 404 });
  }
  return data;
}

// ─── 7. listAllGoalsForChildServer ────────────────────────────────────────────
// Retorna todas as metas do paciente com info do marco pai (para o picker de vínculo).

export const listAllGoalsForChildServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    // Fetch all goals for this child with milestone info
    const { data: goals, error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .select("id, title, milestone_id, therapeutic_milestones!inner(id, title, area, status)")
      .eq("child_id", data.childId)
      .eq("therapist_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw new Response(error.message, { status: 500 });

    // Shape the result
    const shaped = (goals ?? []).map((g: any) => ({
      goalId:        g.id as string,
      goalTitle:     g.title as string,
      milestoneId:   g.milestone_id as string,
      milestoneTitle:(g.therapeutic_milestones as any)?.title as string,
      milestoneArea: (g.therapeutic_milestones as any)?.area as string,
      milestoneStatus:(g.therapeutic_milestones as any)?.status as string,
    }));

    return { goals: shaped };
  });

// ─── 8. getMilestoneGoalCountsServer ─────────────────────────────────────────
// Retorna { [milestoneId]: count } para todos os marcos do paciente.

export const getMilestoneGoalCountsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    const { data: goals, error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .select("milestone_id")
      .eq("child_id", data.childId)
      .eq("therapist_id", userId);

    if (error) throw new Response(error.message, { status: 500 });

    const counts: Record<string, number> = {};
    for (const g of goals ?? []) {
      const mid = (g as any).milestone_id as string;
      counts[mid] = (counts[mid] ?? 0) + 1;
    }
    return { counts };
  });

// ─── 8. listMilestoneGoalsServer ──────────────────────────────────────────────

export const listMilestoneGoalsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ milestoneId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    const { data: goals, error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .select("*")
      .eq("milestone_id", data.milestoneId)
      .eq("therapist_id", userId)
      .order("created_at", { ascending: true });

    if (error) throw new Response(error.message, { status: 500 });
    return { goals: goals ?? [] };
  });

// ─── 8. createMilestoneGoalServer ─────────────────────────────────────────────

export const createMilestoneGoalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => milestoneGoalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    // Verify user owns the parent milestone
    await assertMilestoneOwner(data.milestoneId, userId);

    const now = new Date().toISOString();
    const { data: created, error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .insert({
        milestone_id: data.milestoneId,
        child_id:     data.childId,
        therapist_id: userId,
        title:        data.title,
        description:  data.description ?? null,
        created_at:   now,
        updated_at:   now,
      })
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { goal: created };
  });

// ─── 9. updateMilestoneGoalServer ─────────────────────────────────────────────

export const updateMilestoneGoalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    milestoneGoalSchema.extend({ goalId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    await assertGoalOwner(data.goalId, userId);

    const { data: updated, error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .update({
        title:       data.title,
        description: data.description ?? null,
        updated_at:  new Date().toISOString(),
      })
      .eq("id", data.goalId)
      .eq("therapist_id", userId)
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { goal: updated };
  });

// ─── 10. achieveMilestoneGoalServer ───────────────────────────────────────────

export const achieveMilestoneGoalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ goalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    const existing = await assertGoalOwner(data.goalId, userId);

    if ((existing as any).status === "atingido") {
      throw new Response("Meta já foi marcada como atingida.", { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: updated, error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .update({ status: "atingido", achieved_at: now, updated_at: now })
      .eq("id", data.goalId)
      .eq("therapist_id", userId)
      .select("*")
      .single();

    if (error) throw new Response(error.message, { status: 500 });
    return { goal: updated };
  });

// ─── 11. deleteMilestoneGoalServer ────────────────────────────────────────────

export const deleteMilestoneGoalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ goalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    await assertGoalOwner(data.goalId, userId);

    const { error } = await supabaseAdmin
      .from("milestone_goals" as any)
      .delete()
      .eq("id", data.goalId)
      .eq("therapist_id", userId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true };
  });

// ─── 11. getMilestoneGoalProgressServer ───────────────────────────────────────
// Varre session_records.goals_achieved[] e retorna tentativas vinculadas à meta.

export const getMilestoneGoalProgressServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ goalId: z.string().uuid(), childId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    await assertGoalOwner(data.goalId, userId);

    // Fetch all published records for this child
    const { data: records, error } = await supabaseAdmin
      .from("session_records")
      .select("event_id, goals_achieved, agenda_events!inner(start_at, title)")
      .eq("child_id", data.childId)
      .eq("therapist_id", userId)
      .eq("is_draft", false);

    if (error) throw new Response(error.message, { status: 500 });

    const attempts: Array<{
      sessionId: string;
      sessionDate: string;
      sessionTitle: string;
      status: string;
      notes: string | null;
    }> = [];

    for (const record of records ?? []) {
      const goalsAchieved: any[] = (record as any).goals_achieved ?? [];
      const ev = (record as any).agenda_events;
      for (const g of goalsAchieved) {
        const linked =
          g?.milestoneGoalId === data.goalId ||
          (Array.isArray(g?.milestoneGoalIds) && g.milestoneGoalIds.includes(data.goalId));
        if (linked && g?.status) {
          attempts.push({
            sessionId:    (record as any).event_id,
            sessionDate:  ev?.start_at ?? "",
            sessionTitle: ev?.title ?? "Sessão",
            status:       g.status,
            notes:        g.notes ?? null,
          });
        }
      }
    }

    // Sort most recent first
    attempts.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
    return { attempts };
  });

// ─── 12. getMilestoneProgressServer ───────────────────────────────────────────
// Agrega tentativas de TODAS as metas de um marco (para o histórico do marco).

export const getMilestoneProgressServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ milestoneId: z.string().uuid(), childId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);
    await assertMilestoneOwner(data.milestoneId, userId);

    // Get all goal IDs for this milestone
    const { data: goals } = await supabaseAdmin
      .from("milestone_goals" as any)
      .select("id, title")
      .eq("milestone_id", data.milestoneId)
      .eq("therapist_id", userId);

    const goalIds = new Set<string>((goals ?? []).map((g: any) => g.id));
    const goalTitles: Record<string, string> = {};
    for (const g of goals ?? []) {
      goalTitles[(g as any).id] = (g as any).title;
    }

    if (goalIds.size === 0) return { entries: [] };

    const { data: records, error } = await supabaseAdmin
      .from("session_records")
      .select("event_id, goals_achieved, agenda_events!inner(start_at, title)")
      .eq("child_id", data.childId)
      .eq("therapist_id", userId)
      .eq("is_draft", false);

    if (error) throw new Response(error.message, { status: 500 });

    const entries: Array<{
      sessionId: string;
      sessionDate: string;
      sessionTitle: string;
      goalId: string;
      goalTitle: string;
      status: string;
      notes: string | null;
    }> = [];

    for (const record of records ?? []) {
      const goalsAchieved: any[] = (record as any).goals_achieved ?? [];
      const ev = (record as any).agenda_events;
      for (const g of goalsAchieved) {
        if (!g?.status) continue;
        // Coleta todos os IDs linkados neste item (novo shape: array; antigo: string única)
        const linkedIds: string[] = [];
        if (Array.isArray(g.milestoneGoalIds)) linkedIds.push(...g.milestoneGoalIds.filter(Boolean));
        else if (typeof g.milestoneGoalId === "string" && g.milestoneGoalId) linkedIds.push(g.milestoneGoalId);

        for (const gid of linkedIds) {
          if (goalIds.has(gid)) {
            entries.push({
              sessionId:    (record as any).event_id,
              sessionDate:  ev?.start_at ?? "",
              sessionTitle: ev?.title ?? "Sessão",
              goalId:       gid,
              goalTitle:    goalTitles[gid] ?? "",
              status:       g.status,
              notes:        g.notes ?? null,
            });
          }
        }
      }
    }

    entries.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));
    return { entries };
  });
