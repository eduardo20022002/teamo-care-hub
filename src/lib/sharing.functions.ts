import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  generateShareToken,
  hashShareToken,
  logShareEvent,
  SHARING_TABLES,
} from "@/server/sharing.server";

// 2160h = 90 days (~3 months). Trigger DB allows up to 93 days for safety margin.
const createShareSchema = z.object({
  professionalId: z.string().uuid(),
  expiresInHours: z.union([
    z.literal(6),
    z.literal(24),
    z.literal(48),
    z.literal(2160),
  ]),
  recordIds: z.array(z.string().uuid()).max(200).default([]),
  documentRecordIds: z.array(z.string().uuid()).max(200).default([]),
  documentChildIds: z.array(z.string().uuid()).max(200).default([]),
});

export const createShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createShareSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    // Validate professional belongs to this user (RLS-protected query)
    const { data: prof, error: profErr } = await supabase
      .from(SHARING_TABLES.professionals)
      .select("id")
      .eq("id", data.professionalId)
      .maybeSingle();
    if (profErr || !prof) {
      throw new Response("Profissional não encontrado.", { status: 404 });
    }

    const totalItems =
      data.recordIds.length + data.documentRecordIds.length + data.documentChildIds.length;
    if (totalItems === 0) {
      throw new Response("Selecione pelo menos um item para compartilhar.", { status: 400 });
    }

    // Validate ownership via RLS-aware queries
    if (data.recordIds.length) {
      const { data: rows } = await supabase
        .from(SHARING_TABLES.attendance_records)
        .select("id")
        .in("id", data.recordIds);
      if ((rows ?? []).length !== data.recordIds.length) {
        throw new Response("Alguns registros não foram encontrados.", { status: 400 });
      }
    }
    if (data.documentRecordIds.length) {
      const { data: rows } = await supabase
        .from(SHARING_TABLES.record_attachments)
        .select("id")
        .in("id", data.documentRecordIds);
      if ((rows ?? []).length !== data.documentRecordIds.length) {
        throw new Response("Alguns anexos não foram encontrados.", { status: 400 });
      }
    }
    if (data.documentChildIds.length) {
      const { data: rows } = await supabase
        .from(SHARING_TABLES.child_attachments)
        .select("id")
        .in("id", data.documentChildIds);
      if ((rows ?? []).length !== data.documentChildIds.length) {
        throw new Response("Alguns documentos não foram encontrados.", { status: 400 });
      }
    }

    const rawToken = generateShareToken();
    const tokenHash = hashShareToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + data.expiresInHours * 60 * 60 * 1000);

    // Store SHA-256(token) — raw token is returned to the caller and never persisted.
    // Hash-only design: even with full DB access, an attacker cannot reconstruct valid URLs.
    const { data: shareRow, error: insErr } = await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
      .insert({
        user_id: userId,
        professional_id: data.professionalId,
        token: tokenHash,
        expires_at: expiresAt.toISOString(),
      })
      .select("id, expires_at, created_at")
      .single();

    if (insErr || !shareRow) {
      throw new Response("Não foi possível criar o compartilhamento.", { status: 500 });
    }

    const itemsPayload = [
      ...data.recordIds.map((id) => ({
        share_id: shareRow.id,
        user_id: userId,
        item_type: "record",
        item_id: id,
      })),
      ...data.documentRecordIds.map((id) => ({
        share_id: shareRow.id,
        user_id: userId,
        item_type: "document_record",
        item_id: id,
      })),
      ...data.documentChildIds.map((id) => ({
        share_id: shareRow.id,
        user_id: userId,
        item_type: "document_child",
        item_id: id,
      })),
    ];

    if (itemsPayload.length) {
      const { error: itemsErr } = await (supabaseAdmin.from(SHARING_TABLES.share_items) as any).insert(
        itemsPayload,
      );
      if (itemsErr) {
        await (supabaseAdmin.from(SHARING_TABLES.shares) as any).delete().eq("id", shareRow.id);
        throw new Response("Erro ao salvar itens do compartilhamento.", { status: 500 });
      }
    }

    await logShareEvent(userId, "share.created", {
      share_id: shareRow.id,
      professional_id: data.professionalId,
      expires_in_hours: data.expiresInHours,
      item_count: itemsPayload.length,
    });

    return {
      shareId: shareRow.id as string,
      token: rawToken, // raw bearer token — shown once, never stored
      expiresAt: shareRow.expires_at as string,
      itemCount: itemsPayload.length,
    };
  });

const revokeShareSchema = z.object({ shareId: z.string().uuid() });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => revokeShareSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await (supabase.from(SHARING_TABLES.shares) as any)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.shareId)
      .is("revoked_at", null);
    if (error) {
      throw new Response("Não foi possível revogar.", { status: 500 });
    }
    await logShareEvent(userId, "share.revoked", { share_id: data.shareId });
    return { ok: true };
  });
const renewShareSchema = z.object({
  shareId: z.string().uuid(),
  expiresInHours: z.union([
    z.literal(6),
    z.literal(24),
    z.literal(48),
    z.literal(2160),
  ]),
});

export const renewShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => renewShareSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    // Ensure the share belongs to the user (RLS-aware)
    const { data: row, error: fetchErr } = await (supabase
      .from(SHARING_TABLES.shares) as any)
      .select("id, revoked_at, renewals_count")
      .eq("id", data.shareId)
      .maybeSingle();
    if (fetchErr || !row) {
      throw new Response("Compartilhamento não encontrado.", { status: 404 });
    }
    if (row.revoked_at) {
      throw new Response("Não é possível renovar um compartilhamento revogado.", {
        status: 400,
      });
    }
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + data.expiresInHours * 60 * 60 * 1000);
    // Re-issue: clear OTP state so professional must re-validate, and reset consumed_at
    const { error: updErr } = await (supabaseAdmin.from(SHARING_TABLES.shares) as any)
      .update({
        expires_at: newExpiresAt.toISOString(),
        otp_hash: null,
        otp_expires_at: null,
        otp_attempts: 0,
        consumed_at: null,
        last_renewed_at: now.toISOString(),
        renewals_count: (row.renewals_count ?? 0) + 1,
      })
      .eq("id", data.shareId);
    if (updErr) {
      throw new Response("Não foi possível renovar.", { status: 500 });
    }
    await logShareEvent(userId, "share.renewed", {
      share_id: data.shareId,
      expires_in_hours: data.expiresInHours,
    });
    return { ok: true, expiresAt: newExpiresAt.toISOString() };
  });

export interface ShareSummary {
  id: string;
  professional_id: string;
  professional_name: string;
  professional_specialty: string;
  professional_email: string;
  item_count: number;
  expires_at: string;
  revoked_at: string | null;
  consumed_at: string | null;
  created_at: string;
  renewals_count: number;
  last_renewed_at: string | null;
}

export const listShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data: shares } = await (supabase.from(SHARING_TABLES.shares) as any)
      .select(
        "id, professional_id, expires_at, revoked_at, consumed_at, created_at, renewals_count, last_renewed_at",
      )
      .order("created_at", { ascending: false });

    const sharesArr = (shares as any[]) ?? [];
    if (sharesArr.length === 0) return { shares: [] as ShareSummary[] };

    const profIds = Array.from(new Set(sharesArr.map((s) => s.professional_id)));
    const { data: profs } = await supabase
      .from(SHARING_TABLES.professionals)
      .select("id, name, specialty, email")
      .in("id", profIds);
    const profMap = new Map(((profs as any[]) ?? []).map((p) => [p.id, p]));

    const shareIds = sharesArr.map((s) => s.id);
    const { data: items } = await (supabase.from(SHARING_TABLES.share_items) as any)
      .select("share_id")
      .in("share_id", shareIds);
    const counts = new Map<string, number>();
    for (const it of ((items as any[]) ?? [])) {
      counts.set(it.share_id, (counts.get(it.share_id) ?? 0) + 1);
    }

    const summaries: ShareSummary[] = sharesArr.map((s) => {
      const p = profMap.get(s.professional_id);
      return {
        id: s.id,
        professional_id: s.professional_id,
        professional_name: p?.name ?? "Profissional",
        professional_specialty: p?.specialty ?? "",
        professional_email: p?.email ?? "",
        item_count: counts.get(s.id) ?? 0,
        expires_at: s.expires_at,
        revoked_at: s.revoked_at,
        consumed_at: s.consumed_at,
        created_at: s.created_at,
        renewals_count: s.renewals_count ?? 0,
        last_renewed_at: s.last_renewed_at ?? null,
      };
    });

    // (audit not needed for read; user_id is themselves)
    void userId;
    return { shares: summaries };
  });
