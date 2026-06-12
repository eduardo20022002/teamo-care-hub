// ServerFns para o fluxo Pai → Profissional.
// Nunca importar de arquivos *.client.* — todos rodam no servidor.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";
import {
  generateParentProfessionalInviteToken,
  hashParentProfessionalInviteToken,
  sendParentProfessionalInviteEmail,
  sendParentInviteAcceptedEmail,
  type ParentProfessionalInviteRow,
} from "@/server/parent-professional.server";
import { appBaseUrl } from "@/server/app-url";

// ─── Helpers internos ─────────────────────────────────────────────────────────

async function assertParent(userId: string): Promise<void> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .maybeSingle();
  if ((profile as any)?.user_type !== "parent") {
    throw new Response("Apenas responsáveis podem executar esta ação.", { status: 403 });
  }
}

async function getProfileName(userId: string, fallback = "Usuário"): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return fallback;
  return (data as any).full_name || ((data as any).email ?? "").split("@")[0] || fallback;
}

async function getProfileEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.email ?? null;
}

async function fetchInviteByToken(
  rawToken: string,
): Promise<ParentProfessionalInviteRow | null> {
  const { data } = await (supabaseAdmin as any)
    .from("parent_professional_invites")
    .select("*")
    .eq("token_hash", hashParentProfessionalInviteToken(rawToken))
    .maybeSingle();
  return (data as ParentProfessionalInviteRow) ?? null;
}

// ─── 1. sendParentProfessionalInviteServer ────────────────────────────────────
// Cria o convite (idempotente) e envia e-mail apenas se não existir pending/accepted.

export const sendParentProfessionalInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        childId:          z.string().uuid(),
        inviteeEmail:     z.string().email().max(200),
        inviteeName:      z.string().max(120).optional(),
        otpShareLink:     z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertParent(userId);

    const email = data.inviteeEmail.toLowerCase().trim();

    // Verifica criança pertence ao pai
    const { data: child } = await supabaseAdmin
      .from("children")
      .select("id, name, user_id")
      .eq("id", data.childId)
      .maybeSingle();
    if (!child || (child as any).user_id !== userId) {
      throw new Response("Criança não encontrada.", { status: 404 });
    }
    const childName: string = (child as any).name;

    // Idempotência: já existe accepted → retorna info do acesso ativo
    const { data: existingAccess } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .select("id, status, granted_at")
      .eq("parent_id", userId)
      .eq("child_id", data.childId)
      .eq("status", "active")
      .maybeSingle();

    if (existingAccess) {
      return {
        ok: true as const,
        result: "already_active" as const,
        accessId: (existingAccess as any).id as string,
      };
    }

    // Idempotência: já existe pending → não reenvia (retorna para o cliente sinalizar)
    const { data: existingInvite } = await (supabaseAdmin as any)
      .from("parent_professional_invites")
      .select("id, status")
      .eq("parent_id", userId)
      .eq("child_id", data.childId)
      .ilike("invitee_email", email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return { ok: true as const, result: "already_pending" as const };
    }

    // Cria token
    const rawToken = generateParentProfessionalInviteToken();
    const tokenHash = hashParentProfessionalInviteToken(rawToken);

    const { error: insertError } = await (supabaseAdmin as any)
      .from("parent_professional_invites")
      .insert({
        parent_id:     userId,
        child_id:      data.childId,
        invitee_email: email,
        invitee_name:  data.inviteeName ?? null,
        token_hash:    tokenHash,
        status:        "pending",
        expires_at:    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    if (insertError) throw new Response("Erro ao criar convite.", { status: 500 });

    // Envia e-mail em background (fire-and-forget)
    const parentName = await getProfileName(userId, "Um responsável");
    void sendParentProfessionalInviteEmail({
      to:               email,
      professionalName: data.inviteeName ?? email.split("@")[0],
      parentName,
      childName,
      token:            rawToken,
      otpShareLink:     data.otpShareLink,
    });

    return { ok: true as const, result: "invited" as const };
  });

// ─── 2. getParentProfessionalInviteContextServer — PÚBLICO ────────────────────

export const getParentProfessionalInviteContextServer = createServerFn({
  method: "POST",
})
  .inputValidator((d) => z.object({ token: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`parent-prof-invite-ctx:${ip}`, 20, 10 * 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const invite = await fetchInviteByToken(data.token);
    if (!invite) return { state: "invalid" as const };
    if (invite.status === "revoked") return { state: "invalid" as const };
    if (invite.status === "accepted") return { state: "already_used" as const };
    if (new Date(invite.expires_at) < new Date()) return { state: "expired" as const };

    // Enriquece com dados do pai e da criança
    const { data: parentProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", invite.parent_id)
      .maybeSingle();
    const parentName: string =
      (parentProfile as any)?.full_name ||
      ((parentProfile as any)?.email ?? "").split("@")[0] ||
      "Um responsável";

    const { data: child } = await supabaseAdmin
      .from("children")
      .select("name, birth_date")
      .eq("id", invite.child_id)
      .maybeSingle();
    const childName: string = (child as any)?.name ?? "Criança";
    const childBirthDate: string = (child as any)?.birth_date ?? "";

    return {
      state:          "valid" as const,
      inviteId:       invite.id,
      parentName,
      childName,
      childBirthDate,
      inviteeName:    invite.invitee_name,
      inviteeEmail:   invite.invitee_email,
    };
  });

// ─── 3. acceptParentProfessionalInviteServer ──────────────────────────────────

export const acceptParentProfessionalInviteServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;

    const invite = await fetchInviteByToken(data.token);
    if (!invite) throw new Response("Convite inválido.", { status: 404 });

    if (invite.status !== "pending") {
      throw new Response(
        invite.status === "accepted" ? "Convite já aceito." : "Convite inválido.",
        { status: 409 },
      );
    }
    if (new Date(invite.expires_at) < new Date()) {
      throw new Response("Este convite expirou.", { status: 410 });
    }

    // Verifica e-mail da conta logada bate com o e-mail do convite
    let userEmail: string | null =
      typeof claims?.email === "string" ? claims.email : null;
    if (!userEmail) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = authUser?.user?.email ?? null;
    }
    if (!userEmail || userEmail.toLowerCase() !== invite.invitee_email.toLowerCase()) {
      throw new Response(
        "Este convite foi enviado para outro e-mail. Entre com a conta do e-mail que recebeu o convite.",
        { status: 403 },
      );
    }

    const childName = await (async () => {
      const { data: c } = await supabaseAdmin
        .from("children")
        .select("name")
        .eq("id", invite.child_id)
        .maybeSingle();
      return (c as any)?.name ?? "Criança";
    })();

    // Cria acesso via service_role (upsert para idempotência)
    const { error: accessError } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .upsert(
        {
          parent_id:       invite.parent_id,
          professional_id: userId,
          child_id:        invite.child_id,
          invite_id:       invite.id,
          status:          "active",
          granted_at:      new Date().toISOString(),
        },
        { onConflict: "parent_id,professional_id,child_id" },
      );
    if (accessError) throw new Response("Erro ao criar acesso.", { status: 500 });

    // Liga professionals.user_id para todos os registros com este e-mail
    await (supabaseAdmin as any)
      .from("professionals")
      .update({ user_id: userId })
      .ilike("email", invite.invitee_email)
      .is("user_id", null);

    // Marca convite como aceito
    await (supabaseAdmin as any)
      .from("parent_professional_invites")
      .update({
        status:      "accepted",
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq("id", invite.id);

    // Notifica o pai (fire-and-forget)
    const professionalName = await getProfileName(userId, "O profissional");
    const parentEmail = await getProfileEmail(invite.parent_id);
    if (parentEmail) {
      void sendParentInviteAcceptedEmail({
        to:               parentEmail,
        professionalName,
        childName,
      });
    }

    return { ok: true as const };
  });

// ─── 4. listParentProfessionalAccessesServer ──────────────────────────────────
// Retorna invites + acessos do pai, agrupados por criança.

export const listParentProfessionalAccessesServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertParent(userId);

    // Pendentes / revogados (invites)
    let invitesQuery = (supabaseAdmin as any)
      .from("parent_professional_invites")
      .select("id, child_id, invitee_email, invitee_name, status, created_at, expires_at")
      .eq("parent_id", userId)
      .in("status", ["pending", "revoked"])
      .order("created_at", { ascending: false });
    if (data.childId) invitesQuery = invitesQuery.eq("child_id", data.childId);
    const { data: invites } = await invitesQuery;

    // Acessos ativos/revogados
    let accessQuery = (supabaseAdmin as any)
      .from("parent_professional_access")
      .select("id, child_id, professional_id, status, granted_at, revoked_at")
      .eq("parent_id", userId)
      .order("granted_at", { ascending: false });
    if (data.childId) accessQuery = accessQuery.eq("child_id", data.childId);
    const { data: accesses } = await accessQuery;

    // Enriquece acessos com nome do profissional
    const enrichedAccesses = await Promise.all(
      ((accesses as any[]) ?? []).map(async (a: any) => {
        const name = await getProfileName(a.professional_id, "Profissional");
        const email = await getProfileEmail(a.professional_id);
        return { ...a, professionalName: name, professionalEmail: email };
      }),
    );

    // Busca nomes das crianças envolvidas
    const childIds = [
      ...new Set([
        ...((invites as any[]) ?? []).map((i: any) => i.child_id),
        ...((accesses as any[]) ?? []).map((a: any) => a.child_id),
      ]),
    ];
    const childNames: Record<string, string> = {};
    if (childIds.length > 0) {
      const { data: children } = await supabaseAdmin
        .from("children")
        .select("id, name")
        .in("id", childIds);
      for (const c of (children as any[]) ?? []) {
        childNames[c.id] = c.name;
      }
    }

    return {
      invites: ((invites as any[]) ?? []).map((i: any) => ({
        ...i,
        childName: childNames[i.child_id] ?? "",
      })),
      accesses: enrichedAccesses.map((a) => ({
        ...a,
        childName: childNames[a.child_id] ?? "",
      })),
    };
  });

// ─── 5. revokeParentProfessionalAccessServer ──────────────────────────────────

export const revokeParentProfessionalAccessServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertParent(userId);

    const { error } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("id", data.accessId)
      .eq("parent_id", userId)
      .eq("status", "active");
    if (error) throw new Response("Erro ao revogar acesso.", { status: 500 });

    return { ok: true as const };
  });

// ─── 6. resendParentProfessionalInviteServer ──────────────────────────────────

export const resendParentProfessionalInviteServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ inviteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertParent(userId);

    const { data: invite } = await (supabaseAdmin as any)
      .from("parent_professional_invites")
      .select("*")
      .eq("id", data.inviteId)
      .eq("parent_id", userId)
      .maybeSingle();
    if (!invite) throw new Response("Convite não encontrado.", { status: 404 });
    if ((invite as any).status !== "pending") {
      throw new Response("Só é possível reenviar convites pendentes.", { status: 409 });
    }

    // Gera novo token
    const rawToken = generateParentProfessionalInviteToken();
    await (supabaseAdmin as any)
      .from("parent_professional_invites")
      .update({
        token_hash: hashParentProfessionalInviteToken(rawToken),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.inviteId);

    const { data: child } = await supabaseAdmin
      .from("children")
      .select("name")
      .eq("id", (invite as any).child_id)
      .maybeSingle();
    const childName: string = (child as any)?.name ?? "Criança";
    const parentName = await getProfileName(userId, "Um responsável");

    void sendParentProfessionalInviteEmail({
      to:               (invite as any).invitee_email,
      professionalName: (invite as any).invitee_name ?? (invite as any).invitee_email.split("@")[0],
      parentName,
      childName,
      token:            rawToken,
    });

    return { ok: true as const };
  });

// ─── 7. listMyParentInvitedChildrenServer ─────────────────────────────────────
// Visão do profissional: crianças que pais compartilharam com ele.

export const listMyParentInvitedChildrenServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({}).parse(d))
  .handler(async ({ context }) => {
    const { userId } = context as any;

    const { data: accesses } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .select("id, parent_id, child_id, granted_at, status")
      .eq("professional_id", userId)
      .eq("status", "active")
      .order("granted_at", { ascending: false });

    if (!accesses || (accesses as any[]).length === 0) return { items: [] };

    const results = await Promise.all(
      (accesses as any[]).map(async (a: any) => {
        const { data: child } = await supabaseAdmin
          .from("children")
          .select("id, name, birth_date")
          .eq("id", a.child_id)
          .maybeSingle();
        const parentName = await getProfileName(a.parent_id, "Responsável");

        // Conta shares ativos do pai para este profissional (via professionals.user_id)
        const { count: sharesCount } = await (supabaseAdmin as any)
          .from("shares")
          .select("id", { count: "exact", head: true })
          .eq("user_id", a.parent_id)
          .gt("expires_at", new Date().toISOString())
          .is("revoked_at", null)
          .in(
            "professional_id",
            (supabaseAdmin as any)
              .from("professionals")
              .select("id")
              .eq("user_id", userId),
          );

        // Conta mensagens não lidas
        const { count: unreadCount } = await (supabaseAdmin as any)
          .from("parent_professional_messages")
          .select("id", { count: "exact", head: true })
          .eq("access_id", a.id)
          .neq("author_id", userId)
          .is("read_at", null);

        return {
          accessId:    a.id,
          childId:     a.child_id,
          childName:   (child as any)?.name ?? "Criança",
          birthDate:   (child as any)?.birth_date ?? null,
          parentName,
          grantedAt:   a.granted_at,
          sharesCount: sharesCount ?? 0,
          unreadCount: unreadCount ?? 0,
        };
      }),
    );

    return { items: results };
  });

// ─── 8. getParentProfessionalAccessDetailServer ───────────────────────────────

export const getParentProfessionalAccessDetailServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Acesso deve ser do profissional autenticado
    const { data: access } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .select("*")
      .eq("id", data.accessId)
      .eq("professional_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!access) throw new Response("Acesso não encontrado.", { status: 404 });

    const { data: child } = await supabaseAdmin
      .from("children")
      .select("id, name, birth_date")
      .eq("id", (access as any).child_id)
      .maybeSingle();
    const parentName = await getProfileName((access as any).parent_id, "Responsável");
    const parentEmail = await getProfileEmail((access as any).parent_id);

    // Shares ativos do pai para este profissional (via professionals.user_id)
    const { data: profRows } = await (supabaseAdmin as any)
      .from("professionals")
      .select("id")
      .eq("user_id", userId);
    const profIds = ((profRows as any[]) ?? []).map((p: any) => p.id);

    let shares: any[] = [];
    if (profIds.length > 0) {
      const { data: sharesData } = await (supabaseAdmin as any)
        .from("shares")
        .select("id, link_token, expires_at, created_at, professional_id")
        .eq("user_id", (access as any).parent_id)
        .in("professional_id", profIds)
        .gt("expires_at", new Date().toISOString())
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      shares = (sharesData as any[]) ?? [];
    }

    return {
      accessId:   (access as any).id,
      childId:    (access as any).child_id,
      childName:  (child as any)?.name ?? "Criança",
      birthDate:  (child as any)?.birth_date ?? null,
      parentName,
      parentEmail,
      grantedAt:  (access as any).granted_at,
      shares,
    };
  });

// ─── 9. listParentProfessionalMessagesServer ──────────────────────────────────

export const listParentProfessionalMessagesServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    // Valida que o usuário é parte do acesso (pai ou profissional)
    const { data: access } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .select("id, parent_id, professional_id, status")
      .eq("id", data.accessId)
      .maybeSingle();
    if (
      !access ||
      ((access as any).parent_id !== userId && (access as any).professional_id !== userId)
    ) {
      throw new Response("Acesso não encontrado.", { status: 404 });
    }
    if ((access as any).status !== "active") {
      throw new Response("Este acesso foi revogado.", { status: 403 });
    }

    // Busca mensagens
    const { data: messages } = await (supabaseAdmin as any)
      .from("parent_professional_messages")
      .select("id, author_id, author_type, content, read_at, created_at")
      .eq("access_id", data.accessId)
      .order("created_at", { ascending: true });

    // Marca mensagens de outros como lidas (fire-and-forget)
    void (supabaseAdmin as any)
      .from("parent_professional_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("access_id", data.accessId)
      .neq("author_id", userId)
      .is("read_at", null);

    return { messages: (messages as any[]) ?? [] };
  });

// ─── 10. sendParentProfessionalMessageServer ──────────────────────────────────

export const sendParentProfessionalMessageServer = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        accessId: z.string().uuid(),
        content:  z.string().min(1).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { data: access } = await (supabaseAdmin as any)
      .from("parent_professional_access")
      .select("id, parent_id, professional_id, status")
      .eq("id", data.accessId)
      .maybeSingle();
    if (
      !access ||
      ((access as any).parent_id !== userId && (access as any).professional_id !== userId)
    ) {
      throw new Response("Acesso não encontrado.", { status: 404 });
    }
    if ((access as any).status !== "active") {
      throw new Response("Este acesso foi revogado.", { status: 403 });
    }

    const authorType =
      (access as any).parent_id === userId ? "parent" : "professional";

    const { data: msg, error } = await (supabaseAdmin as any)
      .from("parent_professional_messages")
      .insert({
        access_id:   data.accessId,
        author_id:   userId,
        author_type: authorType,
        content:     data.content.trim(),
      })
      .select("id, author_id, author_type, content, read_at, created_at")
      .single();
    if (error) throw new Response("Erro ao enviar mensagem.", { status: 500 });

    return { message: msg };
  });
