// ─── ServerFns do Módulo de Comunicação com a Família (Fase 6) ───────────────
// createCommunicationServer e escalateCommunicationServer: autenticadas
// getCommunicationByTokenServer e confirmCommunicationServer: públicas (sem auth)
// listPatientCommunicationsServer: autenticada

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rateLimit, getClientIp } from "@/server/rate-limit";
import type { ClinicCommunication, CommType } from "@/types/clinic-communication";

// Tipos que exigem token de confirmação da família
const TOKEN_COMM_TYPES: CommType[] = [
  "cancelamento_ausencia_terapeuta",
  "proposta_reposicao",
  "autorizacao_vencendo",
  "mudanca_terapeuta",
  "renovacao_contrato",
];

// ─── createCommunicationServer ───────────────────────────────────────────────

export const createCommunicationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:          z.string().uuid(),
      commType:          z.enum([
        "confirmacao_fila", "form2_horario", "form3_cadastro",
        "cancelamento_ausencia_terapeuta", "proposta_reposicao",
        "autorizacao_vencendo", "mudanca_terapeuta", "renovacao_contrato",
      ]),
      patientProfileId:  z.string().uuid().optional().nullable(),
      queueEntryId:      z.string().uuid().optional().nullable(),
      payload:           z.record(z.unknown()).optional().nullable(),
      deadlineDays:      z.number().int().min(1).max(90).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({
    data,
    context,
  }): Promise<{ ok: true; communicationId: string; token?: string } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: commMember } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!commMember) return { ok: false, error: "Acesso negado." };

    const needsToken = TOKEN_COMM_TYPES.includes(data.commType as CommType);
    const deadlineDays = data.deadlineDays ?? 5;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    const responseDeadline = deadline.toISOString();

    let tokenId: string | null = null;
    let tokenValue: string | undefined;

    if (needsToken) {
      let resolvedQueueEntryId = data.queueEntryId ?? null;
      if (!resolvedQueueEntryId && data.patientProfileId) {
        const { data: profile } = await supabaseAdmin
          .from("patient_profiles")
          .select("queue_entry_id")
          .eq("id", data.patientProfileId)
          .single();
        resolvedQueueEntryId = (profile as { queue_entry_id: string | null } | null)?.queue_entry_id ?? null;
      }

      const { data: tokenRow, error: tokenErr } = await (supabaseAdmin as any)
        .from("clinic_form_tokens")
        .insert({
          clinic_id:      data.clinicId,
          form_type:      "confirmacao_clinica",
          queue_entry_id: resolvedQueueEntryId,
          payload:        data.payload ?? {},
          expires_at:     responseDeadline,
          created_by:     userId,
        })
        .select("id, token")
        .single();

      if (tokenErr || !tokenRow) {
        return { ok: false, error: tokenErr?.message ?? "Erro ao criar token de confirmação." };
      }

      tokenId = (tokenRow as { id: string; token: string }).id;
      tokenValue = (tokenRow as { id: string; token: string }).token;
    }

    const { data: comm, error: commErr } = await (supabaseAdmin as any)
      .from("clinic_communications")
      .insert({
        clinic_id:          data.clinicId,
        patient_profile_id: data.patientProfileId ?? null,
        queue_entry_id:     data.queueEntryId ?? null,
        comm_type:          data.commType,
        token_id:           tokenId,
        status:             "enviado",
        response_deadline:  needsToken ? responseDeadline : null,
      })
      .select("id")
      .single();

    if (commErr || !comm) {
      return { ok: false, error: commErr?.message ?? "Erro ao criar comunicação." };
    }

    return { ok: true, communicationId: (comm as { id: string }).id, token: tokenValue };
  });

// ─── getCommunicationByTokenServer ───────────────────────────────────────────
// Pública (sem auth). Retorna dados de exibição para a página de confirmação.

export const getCommunicationByTokenServer = createServerFn({ method: "GET" })
  .inputValidator((d) =>
    z.object({ token: z.string().min(20) }).parse(d)
  )
  .handler(async ({ data }): Promise<{
    ok: true;
    communication: ClinicCommunication;
    payload: Record<string, unknown>;
    expired: boolean;
    confirmed: boolean;
  } | { ok: false; error: string }> => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`comm-token-get:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const { data: tokenRow, error: tokenErr } = await (supabaseAdmin as any)
      .from("clinic_form_tokens")
      .select("id, clinic_id, expires_at, used_at, payload")
      .eq("token", data.token)
      .eq("form_type", "confirmacao_clinica")
      .single();

    if (tokenErr || !tokenRow) {
      return { ok: false, error: "Token não encontrado." };
    }

    const tr = tokenRow as { id: string; expires_at: string; used_at: string | null; payload: Record<string, unknown> | null };
    const expired = new Date(tr.expires_at) < new Date();
    const confirmed = tr.used_at != null;

    const { data: comm, error: commErr } = await (supabaseAdmin as any)
      .from("clinic_communications")
      .select("*")
      .eq("token_id", tr.id)
      .single();

    if (commErr || !comm) {
      return { ok: false, error: "Comunicação não encontrada." };
    }

    return {
      ok: true,
      communication: comm as ClinicCommunication,
      payload: (tr.payload ?? {}) as Record<string, unknown>,
      expired,
      confirmed,
    };
  });

// ─── confirmCommunicationServer ──────────────────────────────────────────────
// Pública (sem auth). Família confirma ciência ou ação específica.
// Idempotente: segundo clique retorna { ok: true, alreadyConfirmed: true }.

export const confirmCommunicationServer = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token:     z.string().min(20),
      action:    z.enum(["confirmar", "rejeitar", "ciencia"]).default("ciencia"),
      ipAddress: z.string().max(64).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data }): Promise<{ ok: true; alreadyConfirmed: boolean } | { ok: false; error: string }> => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`comm-confirm:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const { data: tokenRow, error: tokenErr } = await (supabaseAdmin as any)
      .from("clinic_form_tokens")
      .select("id, expires_at, used_at")
      .eq("token", data.token)
      .eq("form_type", "confirmacao_clinica")
      .single();

    if (tokenErr || !tokenRow) {
      return { ok: false, error: "Token não encontrado." };
    }

    const tr = tokenRow as { id: string; expires_at: string; used_at: string | null };

    if (tr.used_at) return { ok: true, alreadyConfirmed: true };

    if (new Date(tr.expires_at) < new Date()) {
      return { ok: false, error: "Este link expirou. Entre em contato com a clínica." };
    }

    // Anonimizar IP: SHA-256 truncado para 16 hex chars (LGPD)
    let ipHash: string | null = null;
    if (data.ipAddress) {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data.ipAddress));
      ipHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    }

    const now = new Date().toISOString();

    const { error: tokenUpdateErr } = await (supabaseAdmin as any)
      .from("clinic_form_tokens")
      .update({ used_at: now })
      .eq("id", tr.id);

    if (tokenUpdateErr) return { ok: false, error: tokenUpdateErr.message };

    const { error: commUpdateErr } = await (supabaseAdmin as any)
      .from("clinic_communications")
      .update({
        status:               "confirmado",
        confirmed_at:         now,
        confirmation_ip_hash: ipHash,
      })
      .eq("token_id", tr.id);

    if (commUpdateErr) return { ok: false, error: commUpdateErr.message };

    return { ok: true, alreadyConfirmed: false };
  });

// ─── listPatientCommunicationsServer ─────────────────────────────────────────

export const listPatientCommunicationsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      patientProfileId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; communications: ClinicCommunication[] } | { ok: false; error: string }> => {
    const userId = context.userId;
    const { data: listMember } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!listMember) return { ok: false, error: "Acesso negado." };

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("clinic_communications")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .eq("patient_profile_id", data.patientProfileId)
      .order("sent_at", { ascending: false });

    if (error) return { ok: false, error: error.message };

    return { ok: true, communications: (rows ?? []) as ClinicCommunication[] };
  });

// ─── escalateCommunicationServer ─────────────────────────────────────────────
// Chamado pelo coordenador quando prazo vence sem resposta.

export const escalateCommunicationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      communicationId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: escComm } = await (supabaseAdmin as any)
      .from("clinic_communications")
      .select("clinic_id")
      .eq("id", data.communicationId)
      .single();
    if (!escComm) return { ok: false, error: "Comunicação não encontrada." };

    const { data: escMember } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", escComm.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (escMember?.role !== "coordinator") return { ok: false, error: "Apenas coordenadores podem escalar comunicações." };

    const { error } = await (supabaseAdmin as any)
      .from("clinic_communications")
      .update({
        status:       "sem_resposta",
        escalated_at: new Date().toISOString(),
        escalated_to: userId,
      })
      .eq("id", data.communicationId);

    if (error) return { ok: false, error: error.message };

    return { ok: true };
  });
