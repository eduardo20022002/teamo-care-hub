// ─── ServerFns do Módulo de Fila de Espera ────────────────────────────────────
// submitQueueEntryServer e getPublicClinicBySlugServer são públicas (sem auth).
// Demais ServerFns exigem requireSupabaseAuth.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit, getClientIp } from "@/server/rate-limit";
import type {
  QueueEntry,
  QueuePriorityConfig,
  QueueHistory,
  QueueModalidade,
  QueueTier,
  QueueStatus,
} from "@/types/queue";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const factorASchema = z.object({
  sem_servico_atual: z.boolean().optional(),
  diagnose_recente:  z.boolean().optional(),
  idade_critica:     z.boolean().optional(),
}).optional();

const factorBSchema = z.object({
  comportamento_desafio: z.boolean().optional(),
  gravidade:             z.enum(["leve","moderado","grave"]).optional(),
  descricao:             z.string().max(1000).optional(),
}).optional();

const factorCSchema = z.object({
  renda_baixa:     z.boolean().optional(),
  responsavel_solo: z.boolean().optional(),
  distancia_km:    z.number().int().min(0).max(9999).optional(),
}).optional();

const disponibilidadeSchema = z.object({
  dias:   z.array(z.string()).optional(),
  turnos: z.array(z.string()).optional(),
}).optional();

const submitQueueEntrySchema = z.object({
  clinicSlug:           z.string().min(1).max(120),
  child_name:           z.string().trim().min(1).max(200),
  child_birthdate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  child_diagnosis:      z.string().max(500).optional(),
  child_cid:            z.string().max(20).optional(),
  factor_a:             factorASchema,
  factor_b:             factorBSchema,
  factor_c:             factorCSchema,
  modalidades:          z.array(z.enum(["avaliacao","aba_individual","aba_grupo","orientacao_pais"])).min(1),
  disponibilidade:      disponibilidadeSchema,
  responsavel_nome:     z.string().trim().min(1).max(200),
  responsavel_email:    z.string().email("E-mail inválido.").max(255),
  responsavel_telefone: z.string().max(30).optional(),
});

// ─── getPublicClinicBySlugServer ──────────────────────────────────────────────
// Pública (sem auth) — usada pelo Form 1 para exibir nome da clínica.

export const getPublicClinicBySlugServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ id: string; name: string; slug: string } | null> => {
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("id, name, slug")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!clinic || !clinic.slug) return null;
    return { id: clinic.id, name: clinic.name, slug: clinic.slug };
  });

// ─── submitQueueEntryServer ───────────────────────────────────────────────────
// Pública (sem auth), rate-limited por IP.
// Família submete Form 1.

export const submitQueueEntryServer = createServerFn({ method: "POST" })
  .inputValidator((d) => submitQueueEntrySchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; entryId: string } | { ok: false; error: string }> => {
    // Rate limiting: 5 submissões por IP a cada 30 minutos
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`queue-form1:${ip}`, 5, 30 * 60_000);
    if (!rl.allowed) {
      return {
        ok: false,
        error: `Muitas tentativas. Tente novamente em ${rl.retryAfterSeconds} segundos.`,
      };
    }

    // Buscar clínica pelo slug
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("slug", data.clinicSlug)
      .maybeSingle();

    if (!clinic) return { ok: false, error: "Clínica não encontrada." };

    // Verificar duplicata recente (mesmo e-mail + clínica nas últimas 24h)
    const { data: duplicate } = await supabaseAdmin
      .from("queue_entries")
      .select("id")
      .eq("clinic_id", clinic.id)
      .eq("responsavel_email", data.responsavel_email.toLowerCase().trim())
      .neq("status", "inativo")
      .maybeSingle();

    if (duplicate) {
      return {
        ok: false,
        error: "Já existe uma solicitação ativa para este e-mail nesta clínica.",
      };
    }

    const { data: entry, error } = await supabaseAdmin
      .from("queue_entries")
      .insert({
        clinic_id:            clinic.id,
        child_name:           data.child_name.trim(),
        child_birthdate:      data.child_birthdate,
        child_diagnosis:      data.child_diagnosis?.trim() || null,
        child_cid:            data.child_cid?.trim() || null,
        factor_a:             data.factor_a ?? {},
        factor_b:             data.factor_b ?? {},
        factor_c:             data.factor_c ?? {},
        modalidades:          data.modalidades,
        disponibilidade:      data.disponibilidade ?? {},
        responsavel_nome:     data.responsavel_nome.trim(),
        responsavel_email:    data.responsavel_email.toLowerCase().trim(),
        responsavel_telefone: data.responsavel_telefone?.trim() || null,
      })
      .select("id")
      .single();

    if (error || !entry) {
      return { ok: false, error: "Não foi possível enviar. Tente novamente." };
    }

    return { ok: true, entryId: entry.id };
  });

// ─── listQueueEntriesServer ───────────────────────────────────────────────────

export const listQueueEntriesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:   z.string().uuid(),
      modalidade: z.enum(["avaliacao","aba_individual","aba_grupo","orientacao_pais"]).optional(),
      tier:       z.enum(["alta","moderada","rotina","triagem"]).optional(),
      status:     z.enum(["aguardando","em_avaliacao","agendado","inativo"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }): Promise<QueueEntry[]> => {
    let query = supabaseAdmin
      .from("queue_entries")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: true });

    if (data.tier)   query = query.eq("priority_tier", data.tier);
    if (data.status) query = query.eq("status", data.status);
    if (data.modalidade) {
      query = query.contains("modalidades", [data.modalidade]);
    }

    const { data: entries, error } = await query;
    if (error) throw new Error(error.message);
    return (entries ?? []) as QueueEntry[];
  });

// ─── getQueueEntryServer ──────────────────────────────────────────────────────

export const getQueueEntryServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entryId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<QueueEntry | null> => {
    const { userId } = context as { userId: string };

    const { data: entry } = await supabaseAdmin
      .from("queue_entries")
      .select("*")
      .eq("id", data.entryId)
      .maybeSingle();

    if (!entry) return null;

    // Verificar acesso à clínica
    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", entry.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .maybeSingle();

    if (!member) throw new Response("Sem acesso.", { status: 403 });

    return entry as QueueEntry;
  });

// ─── adjustQueueTierServer ────────────────────────────────────────────────────

export const adjustQueueTierServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      entryId:      z.string().uuid(),
      newTier:      z.enum(["alta","moderada","rotina"]),
      justificativa: z.string().min(20, "Justificativa mínima de 20 caracteres.").max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Buscar a entrada e verificar acesso coordinator
    const { data: entry } = await supabaseAdmin
      .from("queue_entries")
      .select("id, clinic_id, priority_tier, priority_score")
      .eq("id", data.entryId)
      .maybeSingle();

    if (!entry) return { ok: false, error: "Caso não encontrado." };

    // Somente coordinator pode ajustar manualmente
    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", entry.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .maybeSingle();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem ajustar a faixa manualmente." };
    }

    const oldTier = entry.priority_tier as QueueTier;
    if (oldTier === data.newTier) return { ok: true };

    // Registrar no histórico
    await supabaseAdmin.from("queue_history").insert({
      entry_id:     data.entryId,
      clinic_id:    entry.clinic_id,
      changed_by:   userId,
      change_type:  "tier_manual",
      old_tier:     oldTier,
      new_tier:     data.newTier,
      old_score:    entry.priority_score,
      new_score:    entry.priority_score,
      justificativa: data.justificativa,
    });

    // Atualizar a entry (bypass trigger: atualizar diretamente o tier sem recalcular score)
    const { error } = await supabaseAdmin
      .from("queue_entries")
      .update({ priority_tier: data.newTier, updated_at: new Date().toISOString() })
      .eq("id", data.entryId);

    if (error) return { ok: false, error: "Não foi possível ajustar a faixa." };

    return { ok: true };
  });

// ─── getQueuePriorityConfigServer ─────────────────────────────────────────────

export const getQueuePriorityConfigServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<QueuePriorityConfig> => {
    const { data: config } = await supabaseAdmin
      .from("queue_priority_config")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .maybeSingle();

    if (config) return config as QueuePriorityConfig;

    // Retornar defaults se não existe configuração
    return {
      id:               "",
      clinic_id:        data.clinicId,
      weight_factor_a:  40,
      weight_factor_b:  35,
      weight_factor_c:  15,
      weight_time:      10,
      tier_alta_min:    70,
      tier_moderada_min: 40,
    };
  });

// ─── updateQueuePriorityConfigServer ──────────────────────────────────────────

export const updateQueuePriorityConfigServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      weight_factor_a:  z.number().min(0).max(100).optional(),
      weight_factor_b:  z.number().min(0).max(100).optional(),
      weight_factor_c:  z.number().min(0).max(100).optional(),
      weight_time:      z.number().min(0).max(100).optional(),
      tier_alta_min:    z.number().min(0).max(100).optional(),
      tier_moderada_min: z.number().min(0).max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Verificar coordinator
    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .maybeSingle();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem alterar a configuração." };
    }

    const { clinicId, ...weights } = data;
    const patch = Object.fromEntries(
      Object.entries(weights).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin
      .from("queue_priority_config")
      .upsert({ clinic_id: clinicId, ...patch }, { onConflict: "clinic_id" });

    if (error) return { ok: false, error: "Não foi possível atualizar a configuração." };

    return { ok: true };
  });
