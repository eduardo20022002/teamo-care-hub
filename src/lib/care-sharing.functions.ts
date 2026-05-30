// ServerFns para Cuidado Compartilhado.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";
import {
  generateInviteToken,
  fetchInviteByToken,
  createCareAccess,
  sendInviteEmail,
  sendAcceptedNotificationEmail,
  sendApprovedEmail,
  type CareInviteRow,
  type CareAccessRow,
} from "@/server/care-sharing.server";
import { careInviteSchema } from "@/lib/validation";
import { appBaseUrl } from "@/server/app-url";

const APP_URL = appBaseUrl;
const INVITE_TTL_HOURS = 48;

// ─── Helper: busca perfil do user ────────────────────────────────────────────

async function getProfileName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Responsável";
  return (data as any).full_name || ((data as any).email ?? "").split("@")[0] || "Responsável";
}

// ─── 1. sendCareInviteServer — owner envia convite ───────────────────────────

export const sendCareInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => careInviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    // Verifica que o owner é dono da criança (RLS-aware)
    const { data: child } = await supabase
      .from("children")
      .select("id, name")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child) throw new Response("Criança não encontrada.", { status: 404 });

    // Verifica duplicata de convite pendente para o mesmo email+child
    const { data: existing } = await (supabaseAdmin as any)
      .from("care_invites")
      .select("id, status")
      .eq("child_id", data.childId)
      .eq("invitee_email", data.inviteeEmail.toLowerCase())
      .in("status", ["pending", "accepted", "approved"])
      .maybeSingle();

    if (existing) {
      throw new Response(
        "Já existe um convite ativo ou acesso aprovado para este e-mail.",
        { status: 409 },
      );
    }

    const token = generateInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();

    const { data: invite, error } = await (supabaseAdmin as any)
      .from("care_invites")
      .insert({
        owner_id: userId,
        child_id: data.childId,
        invitee_email: data.inviteeEmail.toLowerCase(),
        invitee_alias: data.alias,
        relation: data.relation,
        role: data.role,
        token,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error || !invite) {
      throw new Response("Erro ao criar convite.", { status: 500 });
    }

    const ownerName = await getProfileName(userId);

    // Envia e-mail (silencioso em caso de falha — convite já foi criado)
    await sendInviteEmail({
      to: data.inviteeEmail.toLowerCase(),
      inviterName: ownerName,
      alias: data.alias,
      childName: (child as any).name,
      token,
      expiresAt,
    });

    return { ok: true as const, inviteId: (invite as CareInviteRow).id };
  });

// ─── 2. cancelCareInviteServer — owner cancela convite pendente ──────────────

export const cancelCareInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { error } = await (supabaseAdmin as any)
      .from("care_invites")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("owner_id", userId)
      .in("status", ["pending"]);

    if (error) throw new Response("Erro ao cancelar convite.", { status: 500 });
    return { ok: true as const };
  });

// ─── 3. resendCareInviteServer — owner reenvia convite ───────────────────────

export const resendCareInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Busca invite do owner
    const { data: invite } = await (supabaseAdmin as any)
      .from("care_invites")
      .select("*")
      .eq("id", data.inviteId)
      .eq("owner_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!invite) throw new Response("Convite não encontrado.", { status: 404 });

    const inv = invite as CareInviteRow;
    const newToken = generateInviteToken();
    const newExpiry = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();

    const { error } = await (supabaseAdmin as any)
      .from("care_invites")
      .update({ token: newToken, expires_at: newExpiry })
      .eq("id", data.inviteId);

    if (error) throw new Response("Erro ao reenviar convite.", { status: 500 });

    const ownerName = await getProfileName(userId);
    const { data: child } = await supabaseAdmin
      .from("children")
      .select("name")
      .eq("id", inv.child_id)
      .maybeSingle();

    await sendInviteEmail({
      to: inv.invitee_email,
      inviterName: ownerName,
      alias: inv.invitee_alias,
      childName: (child as any)?.name ?? "Criança",
      token: newToken,
      expiresAt: newExpiry,
    });

    return { ok: true as const };
  });

// ─── 4. approveAccessServer — owner aprova acesso ────────────────────────────

export const approveAccessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Busca invite
    const { data: invite } = await (supabaseAdmin as any)
      .from("care_invites")
      .select("*")
      .eq("id", data.inviteId)
      .eq("owner_id", userId)
      .eq("status", "accepted")
      .maybeSingle();

    if (!invite) throw new Response("Convite não encontrado ou não está aguardando aprovação.", { status: 404 });

    const inv = invite as CareInviteRow;
    if (!inv.accepted_by) throw new Response("Convite ainda não foi aceito.", { status: 400 });

    // Cria acesso
    await createCareAccess({
      inviteId: inv.id,
      ownerId: userId,
      caregiverId: inv.accepted_by,
      childId: inv.child_id,
      role: inv.role,
      relation: inv.relation,
      alias: inv.invitee_alias,
    });

    // Atualiza status do invite
    await (supabaseAdmin as any)
      .from("care_invites")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", data.inviteId);

    // Busca e-mail do co-cuidador e dados da criança
    const { data: caregiverAuth } = await supabaseAdmin.auth.admin.getUserById(inv.accepted_by);
    const caregiverEmail = caregiverAuth?.user?.email ?? null;

    if (caregiverEmail) {
      const { data: child } = await supabaseAdmin
        .from("children")
        .select("name")
        .eq("id", inv.child_id)
        .maybeSingle();
      const ownerName = await getProfileName(userId);

      await sendApprovedEmail({
        to: caregiverEmail,
        inviterName: ownerName,
        childName: (child as any)?.name ?? "Criança",
        appUrl: APP_URL(),
      });
    }

    return { ok: true as const };
  });

// ─── 5. denyAccessServer — owner nega acesso ─────────────────────────────────

export const denyAccessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { error } = await (supabaseAdmin as any)
      .from("care_invites")
      .update({ status: "denied", denied_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .eq("owner_id", userId)
      .in("status", ["accepted"]);

    if (error) throw new Response("Erro ao negar acesso.", { status: 500 });
    return { ok: true as const };
  });

// ─── 6. revokeAccessServer — owner revoga acesso ativo ───────────────────────

export const revokeAccessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { error } = await (supabaseAdmin as any)
      .from("care_access")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.accessId)
      .eq("owner_id", userId)
      .eq("status", "active");

    if (error) throw new Response("Erro ao revogar acesso.", { status: 500 });
    return { ok: true as const };
  });

// ─── 7. listCareInvitesServer — owner lista co-cuidadores ───────────────────

export const listCareInvitesServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    // Verifica que é owner da criança
    const { data: child } = await supabase
      .from("children")
      .select("id, name")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child) throw new Response("Criança não encontrada.", { status: 404 });

    const [invitesRes, accessRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("care_invites")
        .select("*")
        .eq("child_id", data.childId)
        .eq("owner_id", userId)
        .not("status", "in", '("revoked","denied")')
        .order("created_at", { ascending: false }),
      (supabaseAdmin as any)
        .from("care_access")
        .select("*, caregiver:caregiver_id(id, email, raw_user_meta_data)")
        .eq("child_id", data.childId)
        .eq("owner_id", userId)
        .eq("status", "active"),
    ]);

    const invites = (invitesRes.data ?? []) as CareInviteRow[];
    const accesses = (accessRes.data ?? []) as Array<CareAccessRow & { caregiver: any }>;

    return {
      childName: (child as any).name as string,
      ativos: accesses,
      aguardandoAceite: invites.filter((i) => i.status === "pending"),
      aguardandoAprovacao: invites.filter((i) => i.status === "accepted"),
    };
  });

// ─── 8. acceptCareInviteServer — co-cuidador aceita convite ─────────────────

export const acceptCareInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const ctx = await fetchInviteByToken(data.token);
    if (!ctx) throw new Response("Convite não encontrado.", { status: 404 });
    if (ctx.invite.status !== "pending") {
      throw new Response("Este convite já foi utilizado ou expirou.", { status: 409 });
    }
    if (new Date(ctx.invite.expires_at) < new Date()) {
      throw new Response("Este convite expirou.", { status: 410 });
    }

    // Atualiza invite com quem aceitou
    const { error } = await (supabaseAdmin as any)
      .from("care_invites")
      .update({
        status: "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", ctx.invite.id)
      .eq("status", "pending");

    if (error) throw new Response("Erro ao aceitar convite.", { status: 500 });

    // Notifica owner por e-mail
    const { data: ownerAuth } = await supabaseAdmin.auth.admin.getUserById(ctx.invite.owner_id);
    const ownerEmail = ownerAuth?.user?.email ?? null;
    if (ownerEmail) {
      const approveUrl = `${APP_URL()}/cuidado-compartilhado/${ctx.invite.child_id}/aprovar/${ctx.invite.id}`;
      await sendAcceptedNotificationEmail({
        to: ownerEmail,
        alias: ctx.invite.invitee_alias,
        childName: ctx.childName,
        approveUrl,
      });
    }

    return { ok: true as const, inviteId: ctx.invite.id };
  });

// ─── 9. getCareInviteContextServer — público (sem auth) ──────────────────────

export const getCareInviteContextServer = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    // Rate limiting por IP (Regra 6 — rota pública sem auth).
    // Janela deslizante: 20 tentativas / 10 min por IP. Impede enumeração de tokens.
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`care-invite-context:${ip}`, 20, 10 * 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const ctx = await fetchInviteByToken(data.token);
    if (!ctx) return { state: "invalid" as const };

    const { invite } = ctx;

    if (new Date(invite.expires_at) < new Date()) {
      return { state: "expired" as const, expiresAt: invite.expires_at };
    }
    if (invite.status === "approved" || invite.status === "accepted") {
      return { state: "already_used" as const };
    }
    if (invite.status !== "pending") {
      return { state: "invalid" as const };
    }

    return {
      state: "valid" as const,
      inviteId: invite.id,
      ownerName: ctx.ownerName,
      childName: ctx.childName,
      childBirthDate: ctx.childBirthDate,
      inviteeAlias: invite.invitee_alias,
      inviteeEmail: invite.invitee_email,
      role: invite.role,
      expiresAt: invite.expires_at,
    };
  });

// ─── 10. listMyCareAccessServer — co-cuidador lista acessos ─────────────────

export const listMyCareAccessServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;

    const { data } = await (supabaseAdmin as any)
      .from("care_access")
      .select(`
        id,
        child_id,
        role,
        relation,
        alias,
        owner_id,
        status,
        granted_at,
        child:children(id, name, birth_date),
        owner:owner_id(id, raw_user_meta_data, email)
      `)
      .eq("caregiver_id", userId)
      .eq("status", "active");

    return { accesses: (data ?? []) as Array<CareAccessRow & { child: any; owner: any }> };
  });

// ─── 11. getCareInviteForApprovalServer — owner vê detalhes do aceite ────────

export const getCareInviteForApprovalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { data: invite } = await (supabaseAdmin as any)
      .from("care_invites")
      .select("*")
      .eq("id", data.inviteId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (!invite) throw new Response("Convite não encontrado.", { status: 404 });

    const inv = invite as CareInviteRow;

    // Dados de quem aceitou
    let acceptedBy: { email: string; displayName: string } | null = null;
    if (inv.accepted_by) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(inv.accepted_by);
      const meta = authUser?.user?.user_metadata as { display_name?: string } | undefined;
      acceptedBy = {
        email: authUser?.user?.email ?? "",
        displayName: meta?.display_name || authUser?.user?.email?.split("@")[0] || "",
      };
    }

    const { data: child } = await supabaseAdmin
      .from("children")
      .select("name")
      .eq("id", inv.child_id)
      .maybeSingle();

    const emailsMatch =
      acceptedBy?.email?.toLowerCase() === inv.invitee_email.toLowerCase();

    return {
      invite: inv,
      acceptedBy,
      childName: (child as any)?.name ?? "Criança",
      emailsMatch,
    };
  });
