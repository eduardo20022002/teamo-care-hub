// ─── ServerFns do Módulo de Clínicas ─────────────────────────────────────────
// Todas as operações de escrita usam supabaseAdmin (service_role) para bypass
// de RLS quando necessário (ex: aceitar convite, adicionar membro).
// Operações de leitura usam o cliente autenticado do middleware.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { nameToSlug } from "@/lib/slugify";
import type { Clinic, ClinicMember, ClinicInvite } from "@/types/clinic";
import type { Json } from "@/integrations/supabase/types";

// ─── Schemas de validação ─────────────────────────────────────────────────────

const clinicAddressSchema = z.object({
  street:       z.string().max(200).optional(),
  number:       z.string().max(20).optional(),
  complement:   z.string().max(100).optional(),
  neighborhood: z.string().max(100).optional(),
  city:         z.string().max(100).optional(),
  state:        z.string().length(2).optional(),
  zip:          z.string().max(10).optional(),
});

const createClinicSchema = z.object({
  name:     z.string().trim().min(2, "Mínimo 2 caracteres.").max(120, "Máximo 120 caracteres."),
  cnpj:     z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido.").optional().or(z.literal("")),
  address:  clinicAddressSchema.optional(),
  services: z.array(z.string().max(60)).max(10).optional(),
});

const createInviteSchema = z.object({
  clinicId: z.string().uuid(),
  email:    z.string().email("E-mail inválido.").max(255),
  role:     z.enum(["coordinator", "receptionist", "therapist"]),
});

// ─── createClinicServer ───────────────────────────────────────────────────────
// Cria a clínica e adiciona o usuário como membro coordinator em uma transação.

export const createClinicServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createClinicSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; clinicId: string } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Verificar se já tem clínica
    const { data: existing } = await supabaseAdmin
      .from("clinic_members")
      .select("clinic_id")
      .eq("user_id", userId)
      .eq("role", "coordinator")
      .not("joined_at", "is", null)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "Você já possui uma clínica cadastrada." };
    }

    // Criar a clínica
    const { data: clinic, error: clinicErr } = await supabaseAdmin
      .from("clinics")
      .insert({
        name:     data.name.trim(),
        cnpj:     data.cnpj?.trim() || null,
        address:  data.address ?? {},
        services: data.services ?? [],
        owner_id: userId,
      })
      .select("id")
      .single();

    if (clinicErr || !clinic) {
      return { ok: false, error: "Não foi possível criar a clínica. Tente novamente." };
    }

    // Adicionar o criador como membro coordinator ativo
    const { error: memberErr } = await supabaseAdmin
      .from("clinic_members")
      .insert({
        clinic_id:  clinic.id,
        user_id:    userId,
        role:       "coordinator",
        joined_at:  new Date().toISOString(),
      });

    if (memberErr) {
      // Rollback manual: remover a clínica se não conseguiu criar o membro
      await supabaseAdmin.from("clinics").delete().eq("id", clinic.id);
      return { ok: false, error: "Não foi possível configurar a clínica. Tente novamente." };
    }

    // Tentar atribuir slug derivado do nome (até 5 tentativas para unicidade)
    const baseSlug = nameToSlug(data.name.trim());
    let assignedSlug: string | null = null;
    for (let i = 1; i <= 5; i++) {
      const candidate = i === 1 ? baseSlug : `${baseSlug}-${i}`;
      const { error: slugErr } = await (supabaseAdmin.from("clinics") as any)
        .update({ slug: candidate })
        .eq("id", clinic.id);
      if (!slugErr) {
        assignedSlug = candidate;
        break;
      }
    }

    if (!assignedSlug) {
      console.warn("[createClinicServer] slug não pôde ser atribuído para clinicId:", clinic.id);
    }

    return { ok: true, clinicId: clinic.id, slug: assignedSlug };
  });

// ─── updateClinicServer ───────────────────────────────────────────────────────

const updateClinicPatchSchema = createClinicSchema.partial().extend({
  slug: z.string().min(2).max(60).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Slug inválido.").optional().nullable(),
});

export const updateClinicServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
      patch: updateClinicPatchSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Verificar permissão (coordinator ou owner)
    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("owner_id")
      .eq("id", data.clinicId)
      .maybeSingle();

    const isCoordinator = member?.role === "coordinator";
    const isOwner = clinic?.owner_id === userId;

    if (!isCoordinator && !isOwner) {
      return { ok: false, error: "Sem permissão para editar esta clínica." };
    }

    const patch: { name?: string; cnpj?: string | null; address?: Json; services?: string[]; slug?: string | null } = {};
    if (data.patch.name     !== undefined) patch.name     = data.patch.name.trim();
    if (data.patch.cnpj     !== undefined) patch.cnpj     = data.patch.cnpj?.trim() || null;
    if (data.patch.address  !== undefined) patch.address  = data.patch.address as Json;
    if (data.patch.services !== undefined) patch.services = data.patch.services;
    if (data.patch.slug     !== undefined) patch.slug     = data.patch.slug?.trim() || null;

    if (Object.keys(patch).length === 0) return { ok: true };

    // Verificar slug único (se fornecido)
    // Cast necessário: coluna slug adicionada via migration, tipos Supabase não regenerados
    if (patch.slug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabaseAdmin.from("clinics") as any)
        .select("id")
        .eq("slug", patch.slug)
        .neq("id", data.clinicId)
        .maybeSingle();
      if (existing) return { ok: false, error: "Este slug já está em uso. Escolha outro." };
    }

    const { error } = await supabaseAdmin
      .from("clinics")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", data.clinicId);

    if (error) return { ok: false, error: "Não foi possível atualizar. Tente novamente." };

    return { ok: true };
  });

// ─── getMyClinicServer ────────────────────────────────────────────────────────
// Retorna a clínica do usuário autenticado (onde é coordinator ativo).

export const getMyClinicServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ clinic: Clinic | null; role: string | null }> => {
    const { userId } = context as { userId: string };

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("clinic_id, role")
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!member) return { clinic: null, role: null };

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("*")
      .eq("id", member.clinic_id)
      .single();

    return { clinic: clinic as Clinic | null, role: member.role };
  });

// ─── listClinicMembersServer ──────────────────────────────────────────────────

export const listClinicMembersServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClinicMember[]> => {
    const { userId } = context as { userId: string };

    // Verificar acesso
    const { data: access } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!access) throw new Response("Sem acesso a esta clínica.", { status: 403 });

    const { data: members, error } = await supabaseAdmin
      .from("clinic_members")
      .select(`
        id, clinic_id, user_id, role, invited_at, joined_at,
        profiles:user_id ( full_name, email )
      `)
      .eq("clinic_id", data.clinicId)
      .order("joined_at", { ascending: true });

    if (error) throw new Error(error.message);

    return (members ?? []) as unknown as ClinicMember[];
  });

// ─── createClinicInviteServer ─────────────────────────────────────────────────

export const createClinicInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createInviteSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; token: string; inviteId: string } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Verificar permissão coordinator
    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .maybeSingle();

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("owner_id")
      .eq("id", data.clinicId)
      .maybeSingle();

    if (member?.role !== "coordinator" && clinic?.owner_id !== userId) {
      return { ok: false, error: "Sem permissão para convidar membros." };
    }

    // Buscar user_id pelo email para checar se já é membro ativo
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", data.email.toLowerCase().trim())
      .maybeSingle();

    if (profile) {
      const { data: alreadyMember } = await supabaseAdmin
        .from("clinic_members")
        .select("id")
        .eq("clinic_id", data.clinicId)
        .eq("user_id", profile.id)
        .not("joined_at", "is", null)
        .maybeSingle();

      if (alreadyMember) {
        return { ok: false, error: "Este profissional já é membro da clínica." };
      }
    }

    // Invalidar convites anteriores não usados para o mesmo e-mail+clínica
    await supabaseAdmin
      .from("clinic_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("clinic_id", data.clinicId)
      .eq("email", data.email.toLowerCase().trim())
      .is("used_at", null);

    // Criar novo convite
    const { data: invite, error } = await supabaseAdmin
      .from("clinic_invites")
      .insert({
        clinic_id:  data.clinicId,
        role:       data.role,
        email:      data.email.toLowerCase().trim(),
        created_by: userId,
      })
      .select("id, token")
      .single();

    if (error || !invite) {
      return { ok: false, error: "Não foi possível criar o convite. Tente novamente." };
    }

    return { ok: true, token: invite.token, inviteId: invite.id };
  });

// ─── getClinicInviteServer ────────────────────────────────────────────────────
// Busca dados do convite pelo token — usado na página de aceite.

export const getClinicInviteServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{
    invite: ClinicInvite | null;
    clinicName: string | null;
    expired: boolean;
    used: boolean;
  }> => {
    const { data: invite } = await supabaseAdmin
      .from("clinic_invites")
      .select("*, clinics:clinic_id ( name )")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { invite: null, clinicName: null, expired: false, used: false };

    const expired = new Date(invite.expires_at) < new Date();
    const used    = !!invite.used_at;

    const clinicName = (invite as unknown as { clinics: { name: string } | null }).clinics?.name ?? null;

    return {
      invite:     invite as unknown as ClinicInvite,
      clinicName,
      expired,
      used,
    };
  });

// ─── acceptClinicInviteServer ─────────────────────────────────────────────────

export const acceptClinicInviteServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; clinicId: string } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Buscar o convite
    const { data: invite } = await supabaseAdmin
      .from("clinic_invites")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();

    if (!invite) return { ok: false, error: "Convite não encontrado." };
    if (invite.used_at) return { ok: false, error: "Este convite já foi utilizado." };
    if (new Date(invite.expires_at) < new Date()) return { ok: false, error: "Este convite expirou." };

    // Verificar se o e-mail do convite corresponde ao usuário atual
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (!profile || !invite.email || profile.email.toLowerCase() !== invite.email.toLowerCase()) {
      return { ok: false, error: "Este convite foi enviado para outro e-mail." };
    }

    // Verificar se já é membro
    const { data: existing } = await supabaseAdmin
      .from("clinic_members")
      .select("id, joined_at")
      .eq("clinic_id", invite.clinic_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.joined_at) {
      return { ok: false, error: "Você já é membro desta clínica." };
    }

    const now = new Date().toISOString();

    if (existing) {
      // Atualizar entrada existente (convite pendente → ativo)
      await supabaseAdmin
        .from("clinic_members")
        .update({ joined_at: now, role: invite.role })
        .eq("id", existing.id);
    } else {
      // Inserir novo membro
      await supabaseAdmin.from("clinic_members").insert({
        clinic_id:  invite.clinic_id,
        user_id:    userId,
        role:       invite.role,
        joined_at:  now,
      });
    }

    // Marcar convite como usado
    await supabaseAdmin
      .from("clinic_invites")
      .update({ used_at: now })
      .eq("id", invite.id);

    return { ok: true, clinicId: invite.clinic_id };
  });

// ─── removeClinicMemberServer ─────────────────────────────────────────────────

export const removeClinicMemberServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
      memberId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Verificar permissão
    const { data: requester } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("owner_id")
      .eq("id", data.clinicId)
      .maybeSingle();

    if (requester?.role !== "coordinator" && clinic?.owner_id !== userId) {
      return { ok: false, error: "Sem permissão para remover membros." };
    }

    // Não deixar remover a si mesmo se for o único coordinator
    const { data: target } = await supabaseAdmin
      .from("clinic_members")
      .select("user_id, role")
      .eq("id", data.memberId)
      .maybeSingle();

    if (target?.user_id === userId && target?.role === "coordinator") {
      const { count } = await supabaseAdmin
        .from("clinic_members")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", data.clinicId)
        .eq("role", "coordinator")
        .not("joined_at", "is", null);

      if ((count ?? 0) <= 1) {
        return { ok: false, error: "Não é possível remover o único coordenador da clínica." };
      }
    }

    const { error } = await supabaseAdmin
      .from("clinic_members")
      .delete()
      .eq("id", data.memberId)
      .eq("clinic_id", data.clinicId);

    if (error) return { ok: false, error: "Não foi possível remover o membro." };

    return { ok: true };
  });

// ─── listClinicInvitesServer ──────────────────────────────────────────────────

export const listClinicInvitesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClinicInvite[]> => {
    const { userId } = context as { userId: string };

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .maybeSingle();

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("owner_id")
      .eq("id", data.clinicId)
      .maybeSingle();

    if (member?.role !== "coordinator" && clinic?.owner_id !== userId) {
      throw new Response("Sem permissão.", { status: 403 });
    }

    const { data: invites } = await supabaseAdmin
      .from("clinic_invites")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    return (invites ?? []) as ClinicInvite[];
  });
