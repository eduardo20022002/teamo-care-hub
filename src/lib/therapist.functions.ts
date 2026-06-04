// ServerFns para o módulo de Terapeutas (Phase 1).
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";
import {
  generateTherapistInviteToken,
  fetchTherapistInviteByToken,
  createTherapistParentAccess,
  sendTherapistInviteEmail,
  sendTherapistInviteAcceptedEmail,
  type TherapistInviteRow,
  type TherapistParentAccessRow,
} from "@/server/therapist.server";
import {
  therapistProfileSchema,
  therapistInviteSchema,
  therapistPatientSchema,
  therapistProfileQuestionsSchema,
  therapistPatientWithGuardiansSchema,
  sessionPlanSchema,
  sessionConfirmSchema,
  sessionRecordSchema,
} from "@/lib/validation";
import { appBaseUrl } from "@/server/app-url";

const APP_URL = appBaseUrl;

// ─── Helper: nome do perfil ───────────────────────────────────────────────────

async function getProfileName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Terapeuta";
  return (data as any).full_name || ((data as any).email ?? "").split("@")[0] || "Terapeuta";
}

// ─── Helper: papéis efetivos ──────────────────────────────────────────────────

/** Um usuário "é terapeuta" se user_type for 'therapist'. Regra: 1 e-mail = 1 perfil. */
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

// ─── 1. upsertTherapistProfileServer ─────────────────────────────────────────

export const upsertTherapistProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => therapistProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Regra: apenas usuários com user_type = 'therapist' chegam aqui.
    // Não há mais concessão de secondary_role (1 e-mail = 1 perfil).
    await assertTherapist(userId);

    const { error } = await supabaseAdmin.from("therapist_profiles" as any).upsert(
      {
        user_id:       userId,
        specialty:     data.specialty,
        council_type:  data.councilType,
        council_number: data.councilNumber,
        council_state: data.councilState,
        bio:           data.bio ?? null,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ─── 2. getTherapistProfileServer ────────────────────────────────────────────

export const getTherapistProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { data, error } = await (supabaseAdmin as any)
      .from("therapist_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return { profile: data ?? null };
  });

// ─── 3. createPatientServer — terapeuta cria paciente ────────────────────────

export const createPatientServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => therapistPatientSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    const { data: child, error } = await supabaseAdmin
      .from("children")
      .insert({
        user_id:          userId,
        name:             data.name.trim(),
        birth_date:       data.birthDate,
        created_by_type:  "therapist",
        diagnosis:        data.diagnosis?.trim() || null,
      } as any)
      .select()
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return { child };
  });

// ─── 4. listPatientsServer — lista pacientes do terapeuta ────────────────────

export const listPatientsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    // Filtra explicitamente por user_id (defesa em profundidade além da RLS).
    // NÃO filtra por created_by_type — pacientes criados antes da migration
    // 20260601000000 têm o valor padrão 'parent' e também devem aparecer.
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (error) throw new Response(error.message, { status: 500 });
    return { patients: data ?? [] };
  });

// ─── 5. sendTherapistInviteServer — envia convite ao responsável ──────────────

export const sendTherapistInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => therapistInviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    // Verifica que o terapeuta é DONO da criança (paciente criado por ele).
    // Usa supabaseAdmin + filtro explícito por user_id para NÃO depender de
    // políticas RLS amplas (ex.: terapeuta que também é co-cuidador viewer da
    // criança não pode convidar terceiros para um paciente que não criou).
    const { data: child } = await (supabaseAdmin as any)
      .from("children")
      .select("id, name, user_id, created_by_type")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child || (child as any).user_id !== userId) {
      throw new Response("Paciente não encontrado.", { status: 404 });
    }

    // Verifica duplicata: convite já pending para o mesmo e-mail + criança
    const { data: existing } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .select("id, status")
      .eq("child_id", data.childId)
      .eq("invitee_email", data.inviteeEmail.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      throw new Response(
        "Já existe um convite pendente para este e-mail e paciente.",
        { status: 409 },
      );
    }

    const token = generateTherapistInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365); // safety net silencioso

    const { data: invite, error: insertErr } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .insert({
        therapist_id:  userId,
        child_id:      data.childId,
        invitee_email: data.inviteeEmail.toLowerCase(),
        invitee_alias: data.alias,
        relation:      data.relation,
        token,
        status:        "pending",
        expires_at:    expiresAt.toISOString(),
      })
      .select()
      .single();
    if (insertErr) throw new Response(insertErr.message, { status: 500 });

    const therapistName = await getProfileName(userId);
    // Busca especialidade
    const { data: tProfile } = await (supabaseAdmin as any)
      .from("therapist_profiles")
      .select("specialty")
      .eq("user_id", userId)
      .maybeSingle();
    const specialty: string = (tProfile as any)?.specialty ?? "";

    // Fire-and-forget: erro de e-mail não bloqueia o invite
    void sendTherapistInviteEmail({
      to:                 data.inviteeEmail.toLowerCase(),
      therapistName,
      therapistSpecialty: specialty,
      alias:              data.alias,
      childName:          (child as any).name,
      token,
    });

    return { ok: true as const, inviteId: (invite as TherapistInviteRow).id };
  });

// ─── 6. cancelTherapistInviteServer ──────────────────────────────────────────

export const cancelTherapistInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { error } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("therapist_id", userId)
      .eq("status", "pending"); // só revoga se ainda pendente

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ─── 7. resendTherapistInviteServer — novo token + reenvia e-mail ─────────────

export const resendTherapistInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { data: invite } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .select("*")
      .eq("id", data.inviteId)
      .eq("therapist_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (!invite) throw new Response("Convite não encontrado.", { status: 404 });

    const newToken = generateTherapistInviteToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 365);

    const { error: updErr } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .update({
        token:      newToken,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.inviteId);
    if (updErr) throw new Response(updErr.message, { status: 500 });

    // Busca dados para o e-mail
    const { data: child } = await supabaseAdmin
      .from("children")
      .select("name")
      .eq("id", (invite as TherapistInviteRow).child_id)
      .maybeSingle();
    const therapistName = await getProfileName(userId);
    const { data: tProfile } = await (supabaseAdmin as any)
      .from("therapist_profiles")
      .select("specialty")
      .eq("user_id", userId)
      .maybeSingle();

    void sendTherapistInviteEmail({
      to:                 (invite as TherapistInviteRow).invitee_email,
      therapistName,
      therapistSpecialty: (tProfile as any)?.specialty ?? "",
      alias:              (invite as TherapistInviteRow).invitee_alias,
      childName:          (child as any)?.name ?? "Paciente",
      token:              newToken,
    });

    return { ok: true as const };
  });

// ─── 8. getTherapistInviteContextServer — PÚBLICO, com rate limiting ──────────

export const getTherapistInviteContextServer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    // Rate limiting: 20 requisições por 10 minutos por IP
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`therapist-invite-ctx:${ip}`, 20, 10 * 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const ctx = await fetchTherapistInviteByToken(data.token);
    if (!ctx) return { state: "invalid" as const };

    const invite = ctx.invite;
    // Convite revogado
    if (invite.status === "revoked") return { state: "invalid" as const };
    // Convite já aceito (responsável voltou ao link)
    if (invite.status === "accepted") return { state: "already_used" as const };
    // Convite expirado (safety net de 365 dias)
    if (new Date(invite.expires_at) < new Date()) return { state: "expired" as const };

    return {
      state:              "valid" as const,
      inviteId:           invite.id,
      therapistName:      ctx.therapistName,
      therapistSpecialty: ctx.therapistSpecialty,
      childName:          ctx.childName,
      childBirthDate:     ctx.childBirthDate,
      inviteeAlias:       invite.invitee_alias,
      relation:           invite.relation,
    };
  });

// ─── 9. acceptTherapistInviteServer — responsável aceita o convite ────────────

export const acceptTherapistInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;

    // Busca invite via supabaseAdmin (bypassa RLS — responsável ainda não tem accepted_by)
    const ctx = await fetchTherapistInviteByToken(data.token);
    if (!ctx) throw new Response("Convite inválido.", { status: 404 });

    const invite = ctx.invite;
    if (invite.status !== "pending") {
      throw new Response(
        invite.status === "accepted" ? "Convite já aceito." : "Convite inválido.",
        { status: 409 },
      );
    }
    if (new Date(invite.expires_at) < new Date()) {
      throw new Response("Este convite expirou.", { status: 410 });
    }

    // Defesa em profundidade: como NÃO há etapa de aprovação (aceite imediato dá
    // acesso a dados de saúde de uma criança), exigimos que o e-mail da conta
    // logada coincida com o e-mail para o qual o terapeuta enviou o convite.
    // Isso impede que um link vazado seja reivindicado por uma conta arbitrária.
    let userEmail: string | null =
      (typeof claims?.email === "string" ? claims.email : null);
    if (!userEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? null;
    }
    if (
      !userEmail ||
      userEmail.toLowerCase() !== invite.invitee_email.toLowerCase()
    ) {
      throw new Response(
        "Este convite foi enviado para outro e-mail. Entre com a conta do e-mail que recebeu o convite.",
        { status: 403 },
      );
    }

    // Cria acesso de responsável via service_role
    await createTherapistParentAccess({
      inviteId:    invite.id,
      therapistId: invite.therapist_id,
      parentId:    userId,
      childId:     invite.child_id,
      relation:    invite.relation,
      alias:       invite.invitee_alias,
    });

    // Marca convite como aceito
    await (supabaseAdmin as any)
      .from("therapist_invites")
      .update({
        status:      "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq("id", invite.id);

    // Busca e-mail do terapeuta para notificar
    const { data: therapistProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", invite.therapist_id)
      .maybeSingle();

    if (therapistProfile) {
      void sendTherapistInviteAcceptedEmail({
        to:          (therapistProfile as any).email,
        parentAlias: invite.invitee_alias,
        childName:   ctx.childName,
        appUrl:      APP_URL(),
      });
    }

    return {
      ok:         true as const,
      childId:    invite.child_id,
      childName:  ctx.childName,
    };
  });

// ─── 10. listTherapistInvitesServer — lista convites de um paciente ───────────

export const listTherapistInvitesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Verifica ownership da criança (paciente criado pelo terapeuta).
    const { data: child } = await (supabaseAdmin as any)
      .from("children")
      .select("id, user_id")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child || (child as any).user_id !== userId) {
      throw new Response("Paciente não encontrado.", { status: 404 });
    }

    const { data: invites, error } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .select("*")
      .eq("therapist_id", userId)
      .eq("child_id", data.childId)
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 500 });

    const { data: accesses } = await (supabaseAdmin as any)
      .from("therapist_parent_access")
      .select("*")
      .eq("therapist_id", userId)
      .eq("child_id", data.childId)
      .eq("status", "active");

    return {
      invites:  (invites ?? []) as TherapistInviteRow[],
      accesses: (accesses ?? []) as TherapistParentAccessRow[],
    };
  });

// ─── 11. listMyTherapistAccessServer — lista acessos do responsável ───────────

export const listMyTherapistAccessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;

    const { data: accesses, error } = await (supabaseAdmin as any)
      .from("therapist_parent_access")
      .select("*")
      .eq("parent_id", userId)
      .eq("status", "active");
    if (error) throw new Response(error.message, { status: 500 });

    if (!accesses || accesses.length === 0) return { accesses: [] };

    // Enriquece com dados da criança e do terapeuta
    const enriched = await Promise.all(
      (accesses as TherapistParentAccessRow[]).map(async (access) => {
        const [{ data: child }, { data: therapistProfile }, { data: tProfile }] =
          await Promise.all([
            supabaseAdmin
              .from("children")
              .select("id, name, birth_date")
              .eq("id", access.child_id)
              .maybeSingle(),
            supabaseAdmin
              .from("profiles")
              .select("full_name, email")
              .eq("id", access.therapist_id)
              .maybeSingle(),
            (supabaseAdmin as any)
              .from("therapist_profiles")
              .select("specialty")
              .eq("user_id", access.therapist_id)
              .maybeSingle(),
          ]);

        const therapistName =
          (therapistProfile as any)?.full_name ||
          ((therapistProfile as any)?.email ?? "").split("@")[0] ||
          "Terapeuta";
        const therapistSpecialty = (tProfile as any)?.specialty ?? "";

        return {
          ...access,
          child:             child ?? null,
          therapistName,
          therapistSpecialty,
        };
      }),
    );

    return { accesses: enriched };
  });

// ─── 12. revokeTherapistInviteServer — terapeuta revoga acesso ────────────────

export const revokeTherapistParentAccessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { error } = await (supabaseAdmin as any)
      .from("therapist_parent_access")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.accessId)
      .eq("therapist_id", userId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO AGENDA DO TERAPEUTA — Onboarding + Sessões
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 13. saveTherapistProfileQuestionsServer — salva chips do onboarding ──────

export const saveTherapistProfileQuestionsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => therapistProfileQuestionsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    const patch: Record<string, string | null> = {};
    if (data.attendanceSetting  !== undefined) patch.attendance_setting  = data.attendanceSetting ?? null;
    if (data.attendanceModality !== undefined) patch.attendance_modality = data.attendanceModality ?? null;
    if (data.patientCountRange  !== undefined) patch.patient_count_range = data.patientCountRange ?? null;
    if (data.weeklyHoursRange   !== undefined) patch.weekly_hours_range  = data.weeklyHoursRange ?? null;

    // Upsert — cria o registro se ainda não existe (terapeuta que pulou a step de perfil)
    const { error } = await (supabaseAdmin as any)
      .from("therapist_profiles")
      .upsert(
        { user_id: userId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ─── 14. createPatientWithGuardiansServer — cria paciente + responsáveis ──────

export const createPatientWithGuardiansServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => therapistPatientWithGuardiansSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertTherapist(userId);

    // INSERT na tabela children com guardian_info, birthDate e diagnoses
    const { data: child, error } = await (supabaseAdmin as any)
      .from("children")
      .insert({
        user_id:         userId,
        name:            data.name.trim(),
        birth_date:      data.birthDate ?? new Date().toISOString().split("T")[0],
        diagnoses:       data.diagnoses ?? [],
        created_by_type: "therapist",
        guardian_info:   data.guardians ?? [],
      })
      .select("id, name")
      .single();

    if (error) throw new Response(error.message, { status: 500 });

    // Fire-and-forget: enviar convites para responsáveis com e-mail preenchido
    const guardianName = await getProfileName(userId);
    for (const guardian of data.guardians ?? []) {
      if (guardian.email && guardian.email.trim()) {
        void sendTherapistInviteEmail({
          to: guardian.email.trim(),
          therapistName: guardianName,
          therapistSpecialty: "",
          alias: guardian.name,
          childName: data.name,
          token: "",   // sem token ainda — convite formal é criado separadamente
        }).catch(() => undefined);
      }
    }

    return { child: child as { id: string; name: string } };
  });

// ─── 15. saveSessionPlanServer — salva plano pré-sessão no agenda_event ───────

export const saveSessionPlanServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sessionPlanSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Verifica propriedade do evento
    const { data: event, error: fetchErr } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("therapist_id")
      .eq("id", data.eventId)
      .maybeSingle();

    if (fetchErr || !event) throw new Response("Evento não encontrado.", { status: 404 });
    if ((event as any).therapist_id !== userId) throw new Response("Sem permissão.", { status: 403 });

    const plan = {
      objectives:          data.objectives ?? null,
      specific_objectives: data.specificObjectives ?? [],
      objective_goal_ids:  data.objectiveGoalIds ?? [],
      activities:          data.activities ?? [],
      materials:           data.materials ?? null,
    };

    const { error } = await (supabaseAdmin as any)
      .from("agenda_events")
      .update({
        session_plan:            plan,
        plan_visible_to_parents: data.visibleToParents,
        updated_at:              new Date().toISOString(),
      })
      .eq("id", data.eventId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

// ─── 16. confirmSessionServer — registra comparecimento e tempos reais ─────────

export const confirmSessionServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sessionConfirmSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { data: event, error: fetchErr } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("therapist_id, start_at")
      .eq("id", data.eventId)
      .maybeSingle();

    if (fetchErr || !event) throw new Response("Evento não encontrado.", { status: 404 });
    if ((event as any).therapist_id !== userId) throw new Response("Sem permissão.", { status: 403 });

    const happened = data.attendance === "happened";
    const newStatus = happened ? "happened" : "missed";

    const updatePayload: Record<string, unknown> = {
      session_attendance: data.attendance,
      status:             newStatus,
      updated_at:         new Date().toISOString(),
    };
    if (happened) {
      if (data.actualDurationMinutes) updatePayload.actual_duration_minutes = data.actualDurationMinutes;
      if (data.actualStartAt)         updatePayload.actual_start_at = data.actualStartAt;
    }

    const { error } = await (supabaseAdmin as any)
      .from("agenda_events")
      .update(updatePayload)
      .eq("id", data.eventId);

    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const, happened };
  });

// ─── 17. saveSessionRecordServer — upsert do registro pós-sessão ──────────────

export const saveSessionRecordServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => sessionRecordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Busca event para obter child_id e verificar ownership
    const { data: event, error: fetchErr } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("therapist_id, child_id, session_plan")
      .eq("id", data.eventId)
      .maybeSingle();

    if (fetchErr || !event) throw new Response("Evento não encontrado.", { status: 404 });
    if ((event as any).therapist_id !== userId) throw new Response("Sem permissão.", { status: 403 });

    const childId = (event as any).child_id as string;
    const now = new Date().toISOString();
    const publishing = !data.isDraft;

    const recordPayload: Record<string, unknown> = {
      event_id:             data.eventId,
      therapist_id:         userId,
      child_id:             childId,
      goals_achieved:       data.goalsAchieved ?? [],
      what_was_done:        data.whatWasDone ?? null,
      engagement_level:     null,
      clinical_observations: data.clinicalObservations ?? null,
      notable_behaviors:    data.notableBehaviors ?? [],
      professional_observations: data.professionalObservations ?? [],
      is_private:           data.isPrivate,
      family_instruction:   data.familyInstruction ?? null,
      frequency_suggestion: data.frequencySuggestion ?? null,
      points_to_continue:   data.pointsToContinue ?? null,
      approach_adjustment:  data.approachAdjustment ?? null,
      next_session_event_id: data.nextSessionEventId ?? null,
      is_draft:             data.isDraft,
      updated_at:           now,
    };

    if (publishing) {
      recordPayload.published_at = now;
    }

    const { data: record, error } = await (supabaseAdmin as any)
      .from("session_records")
      .upsert(recordPayload, { onConflict: "event_id" })
      .select("id")
      .single();

    if (error) throw new Response(error.message, { status: 500 });

    // Se publicando: propaga points_to_continue para a sessão escolhida pelo terapeuta
    // (next_session_event_id) ou, na ausência de escolha, para o próximo evento cronológico.
    if (publishing && data.pointsToContinue) {
      let targetEvent: { id: string; session_plan: unknown } | null = null;

      if (data.nextSessionEventId) {
        const { data: chosen } = await (supabaseAdmin as any)
          .from("agenda_events")
          .select("id, session_plan, therapist_id")
          .eq("id", data.nextSessionEventId)
          .maybeSingle();
        // Só aceita se for sessão do próprio terapeuta (defesa em profundidade)
        if (chosen && (chosen as any).therapist_id === userId) {
          targetEvent = chosen as any;
        }
      }

      if (!targetEvent) {
        const { data: nextEvent } = await (supabaseAdmin as any)
          .from("agenda_events")
          .select("id, session_plan")
          .eq("child_id", childId)
          .eq("therapist_id", userId)
          .eq("status", "upcoming")
          .gt("start_at", now)
          .order("start_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        targetEvent = (nextEvent as any) ?? null;
      }

      if (targetEvent) {
        const existingPlan = (targetEvent as any).session_plan ?? {};
        const updatedPlan = {
          ...existingPlan,
          // Pré-preenche objectives com os pontos a continuar (pode ser editado pelo terapeuta)
          objectives_from_previous: data.pointsToContinue,
        };
        await (supabaseAdmin as any)
          .from("agenda_events")
          .update({ session_plan: updatedPlan, updated_at: now })
          .eq("id", (targetEvent as any).id);
      }
    }

    return { ok: true as const, recordId: (record as any).id as string };
  });

// ─── 18. getSessionRecordServer — busca registro de uma sessão ────────────────

const _getSessionRecordInputSchema = z.object({ eventId: z.string().uuid() });

export const getSessionRecordServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => _getSessionRecordInputSchema.parse(d))
  .handler((async ({ data, context }: { data: { eventId: string }; context: { userId: string } }) => {
    const { userId } = context as any;

    // Busca o evento para validar ownership e pegar session_plan
    const { data: event, error: evErr } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("id, therapist_id, child_id, session_plan, plan_visible_to_parents, start_at, actual_duration_minutes, actual_start_at, session_attendance, title")
      .eq("id", data.eventId)
      .maybeSingle();

    if (evErr || !event) throw new Response("Evento não encontrado.", { status: 404 });
    if ((event as any).therapist_id !== userId) throw new Response("Sem permissão.", { status: 403 });

    // Busca registro existente (pode não existir — rascunho em andamento)
    const { data: sessionRecord } = await (supabaseAdmin as any)
      .from("session_records")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();

    // Busca nome do paciente
    const { data: child } = await (supabaseAdmin as any)
      .from("children")
      .select("name, birth_date")
      .eq("id", (event as any).child_id)
      .maybeSingle();

    // Busca points_to_continue do registro anterior para pré-preenchimento
    const { data: prevRecord } = await (supabaseAdmin as any)
      .from("session_records")
      .select("points_to_continue, published_at")
      .eq("therapist_id", userId)
      .eq("child_id", (event as any).child_id)
      .eq("is_draft", false)
      .lt("published_at", (event as any).start_at)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Próximas sessões deste paciente (para o seletor de "próxima sessão")
    // Filtra por start_at da sessão sendo registrada, não pelo momento atual —
    // para que sessões recentes também apareçam no picker ao registrar sessões passadas.
    const { data: upcoming } = await (supabaseAdmin as any)
      .from("agenda_events")
      .select("id, start_at, title")
      .eq("child_id", (event as any).child_id)
      .eq("therapist_id", userId)
      .neq("id", data.eventId)
      .gt("start_at", (event as any).start_at)
      .order("start_at", { ascending: true })
      .limit(20);

    return {
      event:           event as Record<string, unknown>,
      sessionRecord:   sessionRecord ?? null,
      child:           child ?? null,
      previousPoints:  (prevRecord as any)?.points_to_continue ?? null,
      upcomingSessions: (upcoming ?? []) as Array<{ id: string; start_at: string; title: string }>,
    };
  }) as any);

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL DOS PAIS — Visão do responsável sobre o acompanhamento terapêutico
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: valida que o usuário logado tem acesso ativo para um accessId ────
async function assertParentAccess(
  accessId: string,
  userId: string,
): Promise<{ therapistId: string; childId: string; relation: string; alias: string; grantedAt: string }> {
  const { data: access } = await (supabaseAdmin as any)
    .from("therapist_parent_access")
    .select("therapist_id, child_id, relation, alias, granted_at")
    .eq("id", accessId)
    .eq("parent_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!access) throw new Response("Acesso não encontrado ou revogado.", { status: 404 });
  return {
    therapistId: (access as any).therapist_id,
    childId:     (access as any).child_id,
    relation:    (access as any).relation,
    alias:       (access as any).alias,
    grantedAt:   (access as any).granted_at,
  };
}

// ─── listMyPendingTherapistInvitesServer — convites pendentes para o responsável
export const listMyPendingTherapistInvitesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as any;

    // Busca o e-mail do usuário logado (claims > admin API)
    let userEmail: string | null = typeof claims?.email === "string" ? claims.email : null;
    if (!userEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? null;
    }
    if (!userEmail) return { invites: [] };

    const { data: invites } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .select("id, therapist_id, child_id, invitee_alias, relation, created_at, expires_at")
      .ilike("invitee_email", userEmail.toLowerCase())
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (!invites || invites.length === 0) return { invites: [] };

    // Enriquece com nome do terapeuta e da criança
    const enriched = await Promise.all(
      (invites as any[]).map(async (inv) => {
        const [{ data: profile }, { data: tProfile }, { data: child }] = await Promise.all([
          supabaseAdmin.from("profiles").select("full_name, email").eq("id", inv.therapist_id).maybeSingle(),
          (supabaseAdmin as any).from("therapist_profiles").select("specialty").eq("user_id", inv.therapist_id).maybeSingle(),
          supabaseAdmin.from("children").select("name").eq("id", inv.child_id).maybeSingle(),
        ]);
        return {
          inviteId:          inv.id as string,
          therapistName:     (profile as any)?.full_name || ((profile as any)?.email ?? "").split("@")[0] || "Terapeuta",
          therapistSpecialty: (tProfile as any)?.specialty ?? "",
          childName:         (child as any)?.name ?? "Paciente",
          relation:          inv.relation as string,
          sentAt:            inv.created_at as string,
        };
      }),
    );

    return { invites: enriched };
  });

// ─── acceptTherapistInviteByIdServer — aceita convite pelo ID (sem token) ─────
export const acceptTherapistInviteByIdServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;

    const { data: invite } = await (supabaseAdmin as any)
      .from("therapist_invites")
      .select("*")
      .eq("id", data.inviteId)
      .eq("status", "pending")
      .maybeSingle();

    if (!invite) throw new Response("Convite não encontrado ou já processado.", { status: 404 });
    if (new Date((invite as TherapistInviteRow).expires_at) < new Date()) {
      throw new Response("Este convite expirou.", { status: 410 });
    }

    // Defesa: e-mail da conta logada deve coincidir com o convite
    let userEmail: string | null = typeof claims?.email === "string" ? claims.email : null;
    if (!userEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? null;
    }
    if (!userEmail || userEmail.toLowerCase() !== (invite as TherapistInviteRow).invitee_email.toLowerCase()) {
      throw new Response(
        "Este convite foi enviado para outro e-mail. Entre com a conta correta.",
        { status: 403 },
      );
    }

    await createTherapistParentAccess({
      inviteId:    (invite as TherapistInviteRow).id,
      therapistId: (invite as TherapistInviteRow).therapist_id,
      parentId:    userId,
      childId:     (invite as TherapistInviteRow).child_id,
      relation:    (invite as TherapistInviteRow).relation,
      alias:       (invite as TherapistInviteRow).invitee_alias,
    });

    await (supabaseAdmin as any)
      .from("therapist_invites")
      .update({ status: "accepted", accepted_by: userId, accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", (invite as TherapistInviteRow).id);

    // Busca criança para nome no retorno + notificação
    const { data: child } = await supabaseAdmin.from("children").select("name").eq("id", (invite as TherapistInviteRow).child_id).maybeSingle();
    const childName = (child as any)?.name ?? "Paciente";

    const { data: therapistProfile } = await supabaseAdmin.from("profiles").select("email, full_name").eq("id", (invite as TherapistInviteRow).therapist_id).maybeSingle();
    if (therapistProfile) {
      void sendTherapistInviteAcceptedEmail({
        to:          (therapistProfile as any).email,
        parentAlias: (invite as TherapistInviteRow).invitee_alias,
        childName,
        appUrl:      APP_URL(),
      });
    }

    return { ok: true as const, childName };
  });

// ─── getParentPortalSummaryServer — info do terapeuta + criança para o portal ─
export const getParentPortalSummaryServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const acc = await assertParentAccess(data.accessId, userId);

    const [{ data: profile }, { data: tProfile }, { data: child }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, email").eq("id", acc.therapistId).maybeSingle(),
      (supabaseAdmin as any).from("therapist_profiles").select("specialty").eq("user_id", acc.therapistId).maybeSingle(),
      supabaseAdmin.from("children").select("id, name, birth_date").eq("id", acc.childId).maybeSingle(),
    ]);

    return {
      accessId:           data.accessId,
      therapistName:      (profile as any)?.full_name || ((profile as any)?.email ?? "").split("@")[0] || "Terapeuta",
      therapistSpecialty: (tProfile as any)?.specialty ?? "",
      child:              child ?? null,
      relation:           acc.relation,
      alias:              acc.alias,
      grantedAt:          acc.grantedAt,
    };
  });

// ─── listParentSessionRecordsServer — registros de sessão publicados para o pai
export const listParentSessionRecordsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const acc = await assertParentAccess(data.accessId, userId);

    const { data: records, error } = await (supabaseAdmin as any)
      .from("session_records")
      .select(`
        event_id,
        what_was_done,
        family_instruction,
        notable_behaviors,
        goals_achieved,
        clinical_observations,
        published_at,
        agenda_events!inner(
          id, start_at, title, duration_minutes, session_attendance,
          session_plan, plan_visible_to_parents
        )
      `)
      .eq("child_id", acc.childId)
      .eq("therapist_id", acc.therapistId)
      .eq("is_draft", false)
      .eq("is_private", false)
      .order("published_at", { ascending: false });

    if (error) throw new Response(error.message, { status: 500 });

    return { records: (records ?? []) as any[] };
  });

// ─── listParentMilestonesServer — marcos compartilhados com pais ──────────────
export const listParentMilestonesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    const acc = await assertParentAccess(data.accessId, userId);

    const { data: milestones, error } = await (supabaseAdmin as any)
      .from("therapeutic_milestones")
      .select("*")
      .eq("child_id", acc.childId)
      .eq("therapist_id", acc.therapistId)
      .eq("is_shared_with_parents", true)
      .order("created_at", { ascending: true });

    if (error) throw new Response(error.message, { status: 500 });
    if (!milestones || milestones.length === 0) return { milestones: [] };

    // Busca metas de todos os marcos
    const milestoneIds = (milestones as any[]).map((m: any) => m.id);
    const { data: goals } = await (supabaseAdmin as any)
      .from("milestone_goals")
      .select("id, milestone_id, title, status, achieved_at")
      .in("milestone_id", milestoneIds)
      .order("created_at", { ascending: true });

    const goalsByMilestone: Record<string, any[]> = {};
    for (const g of goals ?? []) {
      if (!goalsByMilestone[(g as any).milestone_id]) goalsByMilestone[(g as any).milestone_id] = [];
      goalsByMilestone[(g as any).milestone_id].push(g);
    }

    return {
      milestones: (milestones as any[]).map((m: any) => ({
        ...m,
        goals: goalsByMilestone[m.id] ?? [],
      })),
    };
  });
