// ─── ServerFns do Módulo Financeiro (Fase 5) ──────────────────────────────────
// Dados financeiros sensíveis (LGPD).
// Acesso restrito a coordenadores. Recepcionista e terapeuta bloqueados via RLS.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type {
  InsuranceAuthorization,
  ClinicPaymentRecord,
  AuthorizationAlert,
} from "@/types/clinic-financial";
import { getAlertLevel } from "@/types/clinic-financial";
import {
  isClinicPremium,
  clinicGateError,
  clinicResourceCount,
} from "@/lib/subscription.functions";
import { CLINIC_LIMITS } from "@/lib/plan-limits";

// ─── createInsuranceAuthorizationServer ──────────────────────────────────────

export const createInsuranceAuthorizationServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:            z.string().uuid(),
      patientProfileId:    z.string().uuid(),
      insurancePlan:       z.string().min(1),
      authorizationNumber: z.string().min(1),
      validFrom:           z.string(),
      validUntil:          z.string(),
      sessionsAuthorized:  z.number().int().positive(),
      notes:               z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; authorizationId: string } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem cadastrar autorizações" };
    }

    // Gate freemium da clínica: free = 1 autorização.
    if (!(await isClinicPremium(data.clinicId))) {
      const count = await clinicResourceCount("insurance_authorizations", data.clinicId);
      if (count >= CLINIC_LIMITS.autorizacoes) return clinicGateError("clinica-autorizacoes");
    }

    const { data: auth, error } = await supabaseAdmin
      .from("insurance_authorizations")
      .insert({
        clinic_id:            data.clinicId,
        patient_profile_id:   data.patientProfileId,
        insurance_plan:       data.insurancePlan,
        authorization_number: data.authorizationNumber,
        valid_from:           data.validFrom,
        valid_until:          data.validUntil,
        sessions_authorized:  data.sessionsAuthorized,
        status:               "ativa",
        notes:                data.notes ?? null,
        created_by:           userId,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    return { ok: true, authorizationId: auth.id };
  });

// ─── listInsuranceAuthorizationsServer ───────────────────────────────────────

export const listInsuranceAuthorizationsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
      status:   z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; authorizations: InsuranceAuthorization[] } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Acesso financeiro restrito a coordenadores" };
    }

    let q = supabaseAdmin
      .from("insurance_authorizations")
      .select(`
        *,
        patient_profiles!inner(child_full_name)
      `)
      .eq("clinic_id", data.clinicId)
      .filter("deleted_at", "is", null)
      .order("valid_until", { ascending: true });

    if (data.status) {
      q = q.eq("status", data.status);
    }

    const { data: rows, error } = await q;
    if (error) return { ok: false, error: error.message };

    const authorizations = (rows ?? []).map((r: Record<string, unknown>) => ({
      ...(r as unknown as InsuranceAuthorization),
      patient_name: (r.patient_profiles as { child_full_name: string } | null)?.child_full_name ?? "",
    }));

    return { ok: true, authorizations };
  });

// ─── getAuthorizationDetailServer ────────────────────────────────────────────

export const getAuthorizationDetailServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      patientProfileId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; authorizations: InsuranceAuthorization[] } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Acesso financeiro restrito a coordenadores" };
    }

    const { data: rows, error } = await supabaseAdmin
      .from("insurance_authorizations")
      .select("*")
      .eq("patient_profile_id", data.patientProfileId)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: error.message };

    return { ok: true, authorizations: (rows ?? []) as InsuranceAuthorization[] };
  });

// ─── startAuthorizationRenewalServer ─────────────────────────────────────────

export const startAuthorizationRenewalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:        z.string().uuid(),
      authorizationId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem iniciar renovações" };
    }

    const { error } = await supabaseAdmin
      .from("insurance_authorizations")
      .update({ status: "renovacao_em_andamento", updated_at: new Date().toISOString() })
      .eq("id", data.authorizationId)
      .eq("clinic_id", data.clinicId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

// ─── completeAuthorizationRenewalServer ──────────────────────────────────────

export const completeAuthorizationRenewalServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:              z.string().uuid(),
      authorizationId:       z.string().uuid(),
      newNumber:             z.string().min(1),
      newValidUntil:         z.string(),
      newSessionsAuthorized: z.number().int().positive(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem concluir renovações" };
    }

    const { error } = await supabaseAdmin
      .from("insurance_authorizations")
      .update({
        authorization_number: data.newNumber,
        valid_until:          data.newValidUntil,
        sessions_authorized:  data.newSessionsAuthorized,
        sessions_used:        0,
        status:               "ativa",
        updated_at:           new Date().toISOString(),
      })
      .eq("id", data.authorizationId)
      .eq("clinic_id", data.clinicId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

// ─── createPaymentRecordServer ────────────────────────────────────────────────

export const createPaymentRecordServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      patientProfileId: z.string().uuid(),
      paymentType:      z.enum(["convenio", "particular", "misto"]),
      referenceMonth:   z.string(),
      amountCents:      z.number().int().optional(),
      status:           z.enum(["pendente", "pago", "em_atraso"]).default("pendente"),
      notes:            z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; error?: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem registrar pagamentos" };
    }

    const { error } = await supabaseAdmin
      .from("clinic_payment_records")
      .insert({
        clinic_id:         data.clinicId,
        patient_profile_id: data.patientProfileId,
        payment_type:      data.paymentType,
        reference_month:   data.referenceMonth,
        amount_cents:      data.amountCents ?? null,
        status:            data.status,
        notes:             data.notes ?? null,
      });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

// ─── listPaymentRecordsServer ─────────────────────────────────────────────────

export const listPaymentRecordsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      patientProfileId: z.string().uuid().optional(),
      month:            z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; records: ClinicPaymentRecord[] } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Acesso financeiro restrito a coordenadores" };
    }

    let q = supabaseAdmin
      .from("clinic_payment_records")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .filter("deleted_at", "is", null)
      .order("reference_month", { ascending: false });

    if (data.patientProfileId) q = q.eq("patient_profile_id", data.patientProfileId);
    if (data.month)            q = q.eq("reference_month", data.month);

    const { data: rows, error } = await q;
    if (error) return { ok: false, error: error.message };

    return { ok: true, records: (rows ?? []) as ClinicPaymentRecord[] };
  });

// ─── getAuthorizationAlertsServer ────────────────────────────────────────────

export const getAuthorizationAlertsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; alerts: AuthorizationAlert[] } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Acesso financeiro restrito a coordenadores" };
    }

    const { data: rows, error } = await supabaseAdmin
      .from("insurance_authorizations")
      .select(`
        id,
        patient_profile_id,
        insurance_plan,
        authorization_number,
        valid_until,
        sessions_remaining,
        status,
        patient_profiles!inner(child_full_name)
      `)
      .eq("clinic_id", data.clinicId)
      .not("status", "eq", "encerrada")
      .order("valid_until", { ascending: true });

    if (error) return { ok: false, error: error.message };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alerts: AuthorizationAlert[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const validUntil = new Date(r.valid_until as string);
      const diffMs = validUntil.getTime() - today.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      return {
        authorizationId:    r.id as string,
        patientProfileId:   r.patient_profile_id as string,
        patientName:        (r.patient_profiles as { child_full_name: string } | null)?.child_full_name ?? "",
        insurancePlan:      r.insurance_plan as string,
        authorizationNumber: r.authorization_number as string,
        daysUntilExpiry,
        sessionsRemaining:  r.sessions_remaining as number ?? 0,
        alertLevel:         getAlertLevel(daysUntilExpiry),
      };
    }).filter((a) => a.daysUntilExpiry <= 60 || a.sessionsRemaining <= 10);

    // Fase 6: registrar comunicação para autorizações vencendo em 30 dias
    for (const alert of alerts) {
      if (alert.daysUntilExpiry <= 30) {
        const authDeadline = new Date();
        authDeadline.setDate(authDeadline.getDate() + 5);
        const { data: authTokenRow } = await supabaseAdmin
          .from("clinic_form_tokens")
          .insert({
            clinic_id:  data.clinicId,
            form_type:  "confirmacao_clinica",
            payload: {
              patient_name:         alert.patientName,
              insurance_plan:       alert.insurancePlan,
              authorization_number: alert.authorizationNumber,
              valid_until:          "",
              days_until_expiry:    alert.daysUntilExpiry,
              authorization_id:     alert.authorizationId,
            },
            expires_at:  authDeadline.toISOString(),
            created_by:  userId,
          })
          .select("id")
          .single();
        await supabaseAdmin.from("clinic_communications").insert({
          clinic_id:          data.clinicId,
          patient_profile_id: alert.patientProfileId,
          comm_type:          "autorizacao_vencendo",
          token_id:           (authTokenRow as { id: string } | null)?.id ?? null,
          status:             "enviado",
          response_deadline:  authDeadline.toISOString(),
        });
      }
    }

    return { ok: true, alerts };
  });

// ─── listClinicPatientsServer ─────────────────────────────────────────────────
// Retorna pacientes aprovados da clínica para busca no modal de autorização.

export const listClinicPatientsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clinicId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; patients: { id: string; name: string }[] } | { ok: false; error: string }> => {
    const userId = context.userId;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!member) return { ok: false, error: "Acesso negado." };

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("patient_profiles")
      .select("id, child_full_name, queue_entry_id, queue_entries!inner(clinic_id)")
      .eq("queue_entries.clinic_id", data.clinicId)
      .order("child_full_name");

    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      patients: (rows ?? []).map((r: { id: string; child_full_name: string }) => ({
        id: r.id,
        name: r.child_full_name,
      })),
    };
  });
