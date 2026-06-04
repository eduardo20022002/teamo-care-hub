// ServerFns para o módulo de Evolução — Marcos de Desenvolvimento.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { milestoneSchema } from "@/lib/validation";

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

    const now = new Date().toISOString();
    const { data: created, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .insert({
        therapist_id:          userId,
        child_id:              data.childId,
        title:                 data.title,
        area:                  data.area,
        description:           data.description ?? null,
        is_shared_with_parents: data.isSharedWithParents,
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

    const { data: updated, error } = await supabaseAdmin
      .from("therapeutic_milestones" as any)
      .update({
        title:                 data.title,
        area:                  data.area,
        description:           data.description ?? null,
        is_shared_with_parents: data.isSharedWithParents,
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
