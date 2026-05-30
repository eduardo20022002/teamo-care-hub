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
import { therapistProfileSchema, therapistInviteSchema, therapistPatientSchema } from "@/lib/validation";

const APP_URL = () => process.env.VITE_APP_URL ?? "https://teamo.vercel.app";

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

/** Um usuário "é terapeuta" se user_type OU secondary_role for 'therapist'. */
async function assertTherapist(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_type, secondary_role")
    .eq("id", userId)
    .maybeSingle();
  const isTherapist =
    (profile as any)?.user_type === "therapist" ||
    (profile as any)?.secondary_role === "therapist";
  if (!isTherapist) {
    throw new Response("Apenas terapeutas podem executar esta ação.", { status: 403 });
  }
}

// ─── 1. upsertTherapistProfileServer ─────────────────────────────────────────
//     Concluir o onboarding de terapeuta CONCEDE o papel. Se o usuário ainda
//     não é terapeuta (ex.: um pai adicionando o papel), grava secondary_role.

export const upsertTherapistProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => therapistProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Concede o papel de terapeuta se ainda não tiver.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_type, secondary_role")
      .eq("id", userId)
      .maybeSingle();
    const alreadyTherapist =
      (profile as any)?.user_type === "therapist" ||
      (profile as any)?.secondary_role === "therapist";
    if (!alreadyTherapist) {
      // user_type já é 'parent' (ou outro) → adiciona terapeuta como secundário.
      const { error: roleErr } = await (supabaseAdmin as any)
        .from("profiles")
        .update({ secondary_role: "therapist" })
        .eq("id", userId);
      if (roleErr) throw new Response(roleErr.message, { status: 500 });
    }

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
    // RLS: children_select_own (user_id = auth.uid()) já funciona para terapeuta-owner
    const { data, error } = await supabase
      .from("children")
      .select("*")
      .eq("created_by_type", "therapist")
      .order("created_at", { ascending: true });
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
