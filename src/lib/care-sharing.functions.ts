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
  hashInviteToken,
  fetchInviteByToken,
  createCareAccess,
  sendInviteEmail,
  sendAcceptedNotificationEmail,
  sendApprovedEmail,
  type CareInviteRow,
  type CareAccessRow,
} from "@/server/care-sharing.server";
import { careInviteSchema } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { assertParentPremium } from "@/lib/subscription.server";
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

    // Convidar co-cuidadores é Premium do responsável.
    await assertParentPremium(userId, "cuidado-compartilhado");

    // Verifica que o owner é dono da criança (RLS-aware)
    const { data: child } = await supabase
      .from("children")
      .select("id, name")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child) throw new Response("Criança não encontrada.", { status: 404 });

    // Bloqueia apenas quando há um vínculo REALMENTE ativo/pendente para este
    // e-mail+criança. Importante: um convite "approved" cujo acesso foi revogado
    // NÃO deve bloquear (e era invisível na lista) — antes isso travava o
    // reconvite silenciosamente (409 sem nada aparecer na tela).
    // Usamos lista ordenada (não .maybeSingle, que erra com múltiplas linhas).
    const { data: priorInvites } = await (supabaseAdmin as any)
      .from("care_invites")
      .select("id, status, expires_at")
      .eq("child_id", data.childId)
      .eq("invitee_email", data.inviteeEmail.toLowerCase())
      .in("status", ["pending", "accepted", "approved"])
      .order("created_at", { ascending: false });

    let blockMsg: string | null = null;
    for (const inv of (priorInvites ?? []) as Array<{
      id: string;
      status: string;
      expires_at: string | null;
    }>) {
      if (inv.status === "pending") {
        const notExpired = !inv.expires_at || new Date(inv.expires_at) > new Date();
        if (notExpired) {
          blockMsg = "Já existe um convite pendente para este e-mail. Use \"Reenviar\" na lista.";
          break;
        }
      } else if (inv.status === "accepted") {
        blockMsg = "Já há um convite aceito aguardando sua aprovação para este e-mail.";
        break;
      } else if (inv.status === "approved") {
        // Só bloqueia se o acesso ainda estiver ativo (é co-cuidador atual).
        const { data: activeAccess } = await (supabaseAdmin as any)
          .from("care_access")
          .select("id")
          .eq("invite_id", inv.id)
          .eq("status", "active")
          .maybeSingle();
        if (activeAccess) {
          blockMsg = "Este e-mail já é um co-cuidador ativo desta criança.";
          break;
        }
        // approved sem acesso ativo (revogado) → não bloqueia: permite reconvidar.
      }
    }

    if (blockMsg) {
      throw new Response(blockMsg, { status: 409 });
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
        token_hash: hashInviteToken(token),
        status: "pending",
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error || !invite) {
      throw new Response("Erro ao criar convite.", { status: 500 });
    }

    const ownerName = await getProfileName(userId);

    // Envia e-mail. O convite já foi criado; uma falha de e-mail não desfaz o
    // convite, mas é reportada ao cliente (emailSent) e logada para diagnóstico.
    let emailSent = false;
    try {
      const emailRes = await sendInviteEmail({
        to: data.inviteeEmail.toLowerCase(),
        inviterName: ownerName,
        alias: data.alias,
        childName: (child as any).name,
        token,
        expiresAt,
      });
      emailSent = emailRes.ok;
      if (!emailRes.ok) {
        logger.warn("care.invite_email_failed", { failureCode: "email_not_sent" });
      }
    } catch {
      logger.error("care.invite_email_threw", { failureCode: "exception" });
    }

    return { ok: true as const, inviteId: (invite as CareInviteRow).id, emailSent };
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
      .update({ token_hash: hashInviteToken(newToken), expires_at: newExpiry })
      .eq("id", data.inviteId);

    if (error) throw new Response("Erro ao reenviar convite.", { status: 500 });

    const ownerName = await getProfileName(userId);
    const { data: child } = await supabaseAdmin
      .from("children")
      .select("name")
      .eq("id", inv.child_id)
      .maybeSingle();

    let emailSent = false;
    try {
      const emailRes = await sendInviteEmail({
        to: inv.invitee_email,
        inviterName: ownerName,
        alias: inv.invitee_alias,
        childName: (child as any)?.name ?? "Criança",
        token: newToken,
        expiresAt: newExpiry,
      });
      emailSent = emailRes.ok;
      if (!emailRes.ok) logger.warn("care.resend_email_failed", { failureCode: "email_not_sent" });
    } catch {
      logger.error("care.resend_email_threw", { failureCode: "exception" });
    }

    return { ok: true as const, emailSent };
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
        // Filtro positivo (evita risco de sintaxe do not.in): só os status exibidos.
        .in("status", ["pending", "accepted", "approved"])
        .order("created_at", { ascending: false }),
      // IMPORTANTE: NÃO embutir auth.users (caregiver:caregiver_id(...)) — o
      // PostgREST não expõe o schema auth, então o embed FALHA e a lista de
      // "Ativos" vinha sempre vazia (co-cuidador aprovado nunca aparecia).
      // Buscamos os acessos simples e enriquecemos o e-mail via admin API abaixo.
      (supabaseAdmin as any)
        .from("care_access")
        .select("*")
        .eq("child_id", data.childId)
        .eq("owner_id", userId)
        .eq("status", "active"),
    ]);

    // Não engolir erro da query de convites: se falhar, a lista apareceria
    // silenciosamente vazia (bug difícil de diagnosticar). Falhar explicitamente.
    if (invitesRes.error) {
      logger.error("care.list_invites_query_failed", { failureCode: "db_error" });
      throw new Response("Erro ao carregar convites.", { status: 500 });
    }
    if (accessRes.error) {
      logger.error("care.list_access_query_failed", { failureCode: "db_error" });
      throw new Response("Erro ao carregar acessos.", { status: 500 });
    }

    const invites = (invitesRes.data ?? []) as CareInviteRow[];
    const accessRows = (accessRes.data ?? []) as CareAccessRow[];

    // Enriquece cada acesso ativo com o e-mail do co-cuidador (auth.users via admin).
    const accesses = await Promise.all(
      accessRows.map(async (a) => {
        let email = "";
        try {
          const { data: au } = await supabaseAdmin.auth.admin.getUserById(a.caregiver_id);
          email = au?.user?.email ?? "";
        } catch {
          /* e-mail é secundário; alias já vem em a.alias */
        }
        return { ...a, caregiver: { id: a.caregiver_id, email } };
      }),
    );

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
    // "approved" → acesso já foi liberado (owner aprovou)
    if (invite.status === "approved") {
      return {
        state: "approved" as const,
        inviteId: invite.id,
        ownerName: ctx.ownerName,
        childName: ctx.childName,
      };
    }
    // "accepted" → co-cuidador aceitou mas owner ainda não aprovou
    if (invite.status === "accepted") {
      return {
        state: "already_used" as const,
        inviteId: invite.id,
        ownerName: ctx.ownerName,
        childName: ctx.childName,
        childBirthDate: ctx.childBirthDate,
        role: invite.role,
        expiresAt: invite.expires_at,
      };
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
