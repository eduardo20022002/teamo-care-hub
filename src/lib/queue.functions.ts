// ─── ServerFns do Módulo de Fila de Espera ────────────────────────────────────
// submitQueueEntryServer e getPublicClinicBySlugServer são públicas (sem auth).
// Demais ServerFns exigem requireSupabaseAuth.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertClinicMember } from "@/lib/clinic-auth.server";
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

const condicaoStatus = z.enum(["sim", "nao", "investigacao"]);

const responsavelSchema = z.object({
  nome:             z.string().trim().min(1).max(200),
  parentesco:       z.string().trim().min(1).max(40),
  parentesco_outro: z.string().trim().max(120).optional(),
  telefone:         z.string().trim().min(10).max(30),
  email:            z.string().email("E-mail inválido.").max(255),
});

const condicoesSchema = z.object({
  tea:                     condicaoStatus.optional(),
  tdah:                    condicaoStatus.optional(),
  deficiencia_intelectual: condicaoStatus.optional(),
  atraso_desenvolvimento:  condicaoStatus.optional(),
  transtorno_linguagem:    condicaoStatus.optional(),
  transtorno_sensorial:    condicaoStatus.optional(),
  outra:                   condicaoStatus.optional(),
  outra_qual:              z.string().trim().max(200).optional(),
}).optional();

const comportamentosSchema = z.object({
  autolesao:     z.boolean().optional(),
  agressividade: z.boolean().optional(),
  nenhum:        z.boolean().optional(),
}).optional();

const formDisponibilidadeSchema = z.object({
  modo:       z.enum(["turno", "horario"]),
  grade:      z.record(z.string(), z.array(z.string())).optional(),
  horarios:   z.array(z.object({
    dia:    z.string(),
    inicio: z.string().regex(/^\d{2}:\d{2}$/),
    fim:    z.string().regex(/^\d{2}:\d{2}$/),
  })).optional(),
  restricoes: z.string().trim().max(500).optional(),
}).optional();

const submitQueueEntrySchema = z.object({
  clinicSlug:        z.string().min(1).max(120),
  child_name:        z.string().trim().min(3).max(200),
  child_birthdate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  responsaveis:      z.array(responsavelSchema).min(1).max(10),
  condicoes:         condicoesSchema,
  comportamentos:    comportamentosSchema,
  terapia_aba_atual: z.boolean().optional(),
  terapia_aba_horas: z.number().int().min(1).max(60).optional(),
  como_soube:        z.string().trim().max(300).optional(),
  observacoes:       z.string().trim().max(1000).optional(),
  disponibilidade:   formDisponibilidadeSchema,
  consentimento:     z.literal(true),
});

// ─── getPublicClinicBySlugServer ──────────────────────────────────────────────
// Pública (sem auth) — usada pelo Form 1 para exibir nome da clínica.

export const getPublicClinicBySlugServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ id: string; name: string; slug: string } | null> => {
    // Rate limiting por IP (Regra 6): rota pública, leitura leve → janela generosa.
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    if (!rateLimit(`clinic-slug:${ip}`, 30, 60_000).allowed) return null;

    // Cast necessário: coluna slug adicionada via migration, tipos Supabase não regenerados
    const { data: clinic } = await (supabaseAdmin.from("clinics") as any)
      .select("id, name, slug")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!clinic || !clinic.slug) return null;
    return { id: clinic.id, name: clinic.name, slug: clinic.slug };
  });

// ─── submitQueueEntryServer ───────────────────────────────────────────────────
// Pública (sem auth), rate-limited por IP.
// Família submete Form 1.

// Idade em anos completos a partir da data de nascimento (YYYY-MM-DD).
function idadeEmAnos(birthdate: string): number {
  const b = new Date(birthdate + "T00:00:00");
  const now = new Date();
  let anos = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) anos--;
  return anos;
}

// Resumo legível das condições marcadas (para exibição no painel via child_diagnosis).
const CONDICAO_LABELS: Record<string, string> = {
  tea: "TEA", tdah: "TDAH", deficiencia_intelectual: "Def. Intelectual",
  atraso_desenvolvimento: "Atraso no desenvolvimento", transtorno_linguagem: "Transtorno de linguagem",
  transtorno_sensorial: "Transtorno sensorial", outra: "Outra",
};
const STATUS_LABELS: Record<string, string> = {
  sim: "sim", nao: "não", investigacao: "em investigação",
};

export const submitQueueEntryServer = createServerFn({ method: "POST" })
  .inputValidator((d) => submitQueueEntrySchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; entryId: string; protocol: string } | { ok: false; error: string; protocol?: string }> => {
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
    // Cast necessário: coluna slug adicionada via migration, tipos Supabase não regenerados
    const { data: clinic } = await (supabaseAdmin.from("clinics") as any)
      .select("id")
      .eq("slug", data.clinicSlug)
      .maybeSingle();

    if (!clinic) return { ok: false, error: "Clínica não encontrada." };

    const childName = data.child_name.trim();

    // Duplicata: mesma criança (nome + data de nascimento) com entrada ativa nesta clínica.
    // Status terminais (inativo) são ignorados — família pode reentrar após saída da fila.
    const { data: duplicate } = await (supabaseAdmin.from("queue_entries") as any)
      .select("id, form_payload")
      .eq("clinic_id", clinic.id)
      .ilike("child_name", childName)
      .eq("child_birthdate", data.child_birthdate)
      .in("status", ["aguardando", "em_avaliacao", "agendado"])
      .maybeSingle();

    if (duplicate) {
      const existingProtocol = (duplicate.form_payload?.protocol as string) ?? undefined;
      return {
        ok: false,
        error: existingProtocol
          ? `Já existe uma solicitação ativa para esta criança. O protocolo é ${existingProtocol}.`
          : "Já existe uma solicitação ativa para esta criança.",
        protocol: existingProtocol,
      };
    }

    // ── Derivar fatores de priorização a partir do payload ──
    const comp = data.comportamentos ?? {};
    const temComportamento = !!(comp.autolesao || comp.agressividade);

    const factor_a = {
      // Não está em terapia ABA → sem serviço especializado atual
      sem_servico_atual: data.terapia_aba_atual === false ? true : undefined,
      // Faixa de maior plasticidade (intervenção precoce)
      idade_critica: idadeEmAnos(data.child_birthdate) < 6 ? true : undefined,
    };
    const factor_b = temComportamento
      ? {
          comportamento_desafio: true,
          // Autolesão visível é mais grave; agressividade isolada = moderado
          gravidade: comp.autolesao ? ("grave" as const) : ("moderado" as const),
        }
      : { comportamento_desafio: false };
    const factor_c = {}; // Vulnerabilidade socioeconômica não é coletada no Form 1 público

    // ── Resumo de diagnóstico (para exibição no painel) ──
    const cond = data.condicoes ?? {};
    const diagnosisParts: string[] = [];
    for (const [key, label] of Object.entries(CONDICAO_LABELS)) {
      const status = (cond as Record<string, string | undefined>)[key];
      if (status && status !== "nao") {
        const extra = key === "outra" && cond.outra_qual ? ` (${cond.outra_qual})` : "";
        diagnosisParts.push(`${label}: ${STATUS_LABELS[status]}${extra}`);
      }
    }
    const childDiagnosis = diagnosisParts.length > 0 ? diagnosisParts.join("; ") : null;

    // ── Disponibilidade para retrocompatibilidade do painel (dias/turnos) ──
    const disp = data.disponibilidade;
    let dias: string[] = [];
    let turnos: string[] = [];
    if (disp?.modo === "turno" && disp.grade) {
      dias = Object.keys(disp.grade).filter((d) => (disp.grade![d] ?? []).length > 0);
      turnos = [...new Set(Object.values(disp.grade).flat())];
    } else if (disp?.modo === "horario" && disp.horarios) {
      dias = [...new Set(disp.horarios.map((h) => h.dia))];
    }

    // ── Protocolo: AAAA-NNNN sequencial por clínica ──
    const { count } = await supabaseAdmin
      .from("queue_entries")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id);
    const year = new Date().getFullYear();
    const protocol = `${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const primeiro = data.responsaveis[0];
    const formPayload = {
      protocol,
      responsaveis:      data.responsaveis,
      condicoes:         data.condicoes ?? {},
      comportamentos:    data.comportamentos ?? {},
      terapia_aba_atual: data.terapia_aba_atual,
      terapia_aba_horas: data.terapia_aba_horas,
      como_soube:        data.como_soube,
      observacoes:       data.observacoes,
      disponibilidade:   data.disponibilidade,
    };

    const { data: entry, error } = await (supabaseAdmin.from("queue_entries") as any)
      .insert({
        clinic_id:            clinic.id,
        child_name:           childName,
        child_birthdate:      data.child_birthdate,
        child_diagnosis:      childDiagnosis,
        child_cid:            null,
        factor_a,
        factor_b,
        factor_c,
        modalidades:          ["avaliacao"], // avaliação inicial é o primeiro passo padrão
        disponibilidade:      { dias, turnos },
        responsavel_nome:     primeiro.nome.trim(),
        responsavel_email:    primeiro.email.toLowerCase().trim(),
        responsavel_telefone: primeiro.telefone.trim() || null,
        form_payload:         formPayload,
      })
      .select("id")
      .single();

    if (error || !entry) {
      return { ok: false, error: "Não foi possível enviar. Tente novamente." };
    }

    return { ok: true, entryId: entry.id, protocol };
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
  .handler(async ({ data, context }): Promise<QueueEntry[]> => {
    // Isolamento de tenant: só membro ativo da clínica lê a fila (PII de menores).
    await assertClinicMember(data.clinicId, (context as { userId: string }).userId);

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
  .handler(async ({ data, context }): Promise<QueuePriorityConfig> => {
    await assertClinicMember(data.clinicId, (context as { userId: string }).userId);

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
