// ─── ServerFns do Módulo de Avaliações (Fase 4) ───────────────────────────────
// Dados sensíveis de saúde (LGPD Art. 11).
// Permissão verificada duas vezes: via RLS (supabase autenticado) e explicitamente no código.
// Operações públicas (forms via token) usam supabaseAdmin controlado com verificação de token válido.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getClinicMembership } from "@/lib/clinic-auth.server";
import { rateLimit, getClientIp } from "@/server/rate-limit";
import {
  isClinicPremium,
  clinicGateError,
  clinicResourceCount,
} from "@/lib/subscription.server";
import { CLINIC_LIMITS } from "@/lib/plan-limits";
import type { EvaluationReport, PatientProfile, ClinicFormToken } from "@/types/clinic-evaluation";

// ─── createEvaluationReportServer ────────────────────────────────────────────

export const createEvaluationReportServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:      z.string().uuid(),
      queueEntryId:  z.string().uuid(),
      instruments:   z.array(z.string()).min(1),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; reportId: string } | { ok: false; error: string }> => {
    const userId = context.user.id;

    // Verificação explícita: usuário deve ser membro da clínica
    const member = await getClinicMembership(data.clinicId, userId);

    if (!member) return { ok: false, error: "Sem permissão para esta clínica" };

    // Gate freemium da clínica: free = 1 avaliação.
    if (!(await isClinicPremium(data.clinicId))) {
      const count = await clinicResourceCount("evaluation_reports", data.clinicId);
      if (count >= CLINIC_LIMITS.avaliacoes) return clinicGateError("clinica-avaliacoes");
    }

    const { data: report, error } = await supabaseAdmin
      .from("evaluation_reports")
      .insert({
        clinic_id:         data.clinicId,
        queue_entry_id:    data.queueEntryId,
        therapist_user_id: userId,
        instruments:       data.instruments,
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    // Atualiza status da fila para em_avaliacao
    await supabaseAdmin
      .from("queue_entries")
      .update({ status: "em_avaliacao", updated_at: new Date().toISOString() })
      .eq("id", data.queueEntryId);

    return { ok: true, reportId: report.id };
  });

// ─── updateEvaluationReportServer ────────────────────────────────────────────

export const updateEvaluationReportServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      reportId:                  z.string().uuid(),
      evaluationDates:           z.array(z.string()).optional(),
      instruments:               z.array(z.string()).optional(),
      sessionsCount:             z.number().int().min(1).max(20).optional(),
      vbmappLevel:               z.number().int().min(1).max(3).optional().nullable(),
      vbmappDomains:             z.record(z.number()).optional(),
      vbmappBarriers:            z.array(z.object({ barrier: z.string(), description: z.string() })).optional(),
      functionalProfile:         z.record(z.unknown()).optional(),
      behaviorChallenges:        z.array(z.object({ descricao: z.string(), funcao: z.string(), estrategias: z.string() })).optional(),
      fbaConducted:              z.boolean().optional(),
      recommendedModality:       z.array(z.string()).optional(),
      recommendedHoursPerWeek:   z.number().int().min(1).max(80).optional().nullable(),
      clinicalJustification:     z.string().max(5000).optional().nullable(),
      sessionsPerWeek:           z.number().int().min(1).max(20).optional().nullable(),
      sessionDurationMinutes:    z.number().int().min(30).max(180).optional(),
      initialGoals:              z.array(z.object({ domain: z.string(), objective: z.string(), mastery_criterion: z.string() })).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = context.user.id;

    // Verificação explícita: só o terapeuta ou coordenador pode atualizar
    const { data: report } = await supabaseAdmin
      .from("evaluation_reports")
      .select("therapist_user_id, clinic_id")
      .eq("id", data.reportId)
      .single();

    if (!report) return { ok: false, error: "Relatório não encontrado" };

    const member = await getClinicMembership(report.clinic_id, userId);

    const isTherapist = report.therapist_user_id === userId;
    const isCoordinator = member?.role === "coordinator";
    if (!isTherapist && !isCoordinator) return { ok: false, error: "Sem permissão" };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.evaluationDates !== undefined)         patch.evaluation_dates = data.evaluationDates;
    if (data.instruments !== undefined)             patch.instruments = data.instruments;
    if (data.sessionsCount !== undefined)           patch.sessions_count = data.sessionsCount;
    if (data.vbmappLevel !== undefined)             patch.vbmapp_level = data.vbmappLevel;
    if (data.vbmappDomains !== undefined)           patch.vbmapp_domains = data.vbmappDomains;
    if (data.vbmappBarriers !== undefined)          patch.vbmapp_barriers = data.vbmappBarriers;
    if (data.functionalProfile !== undefined)       patch.functional_profile = data.functionalProfile;
    if (data.behaviorChallenges !== undefined)      patch.behavior_challenges = data.behaviorChallenges;
    if (data.fbaConducted !== undefined)            patch.fba_conducted = data.fbaConducted;
    if (data.recommendedModality !== undefined)     patch.recommended_modality = data.recommendedModality;
    if (data.recommendedHoursPerWeek !== undefined) patch.recommended_hours_per_week = data.recommendedHoursPerWeek;
    if (data.clinicalJustification !== undefined)   patch.clinical_justification = data.clinicalJustification;
    if (data.sessionsPerWeek !== undefined)         patch.sessions_per_week = data.sessionsPerWeek;
    if (data.sessionDurationMinutes !== undefined)  patch.session_duration_minutes = data.sessionDurationMinutes;
    if (data.initialGoals !== undefined)            patch.initial_goals = data.initialGoals;

    const { error } = await supabaseAdmin
      .from("evaluation_reports")
      .update(patch)
      .eq("id", data.reportId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

// ─── finalizeEvaluationReportServer ──────────────────────────────────────────

export const finalizeEvaluationReportServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: report } = await supabaseAdmin
      .from("evaluation_reports")
      .select("therapist_user_id, clinic_id, clinical_justification, status")
      .eq("id", data.reportId)
      .single();

    if (!report) return { ok: false, error: "Relatório não encontrado" };

    // Verificação explícita de permissão
    const member = await getClinicMembership(report.clinic_id, userId);

    const isTherapist = report.therapist_user_id === userId;
    const isCoordinator = member?.role === "coordinator";
    if (!isTherapist && !isCoordinator) return { ok: false, error: "Sem permissão" };

    if ((report.clinical_justification ?? "").length < 100) {
      return { ok: false, error: "A justificativa clínica precisa ter pelo menos 100 caracteres" };
    }

    const { error } = await supabaseAdmin
      .from("evaluation_reports")
      .update({ status: "finalizado", finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.reportId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

// ─── getEvaluationReportServer ────────────────────────────────────────────────

export const getEvaluationReportServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; report: EvaluationReport } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: report, error } = await supabaseAdmin
      .from("evaluation_reports")
      .select("*")
      .eq("id", data.reportId)
      .single();

    if (error || !report) return { ok: false, error: "Relatório não encontrado" };

    // Verificação explícita de permissão (LGPD — dupla verificação)
    const member = await getClinicMembership(report.clinic_id, userId);

    const isTherapist = report.therapist_user_id === userId;
    const isCoordinator = member?.role === "coordinator";
    if (!isTherapist && !isCoordinator) return { ok: false, error: "Sem permissão para acessar este relatório" };

    return { ok: true, report: report as EvaluationReport };
  });

// ─── listEvaluationReportsServer ─────────────────────────────────────────────

export const listEvaluationReportsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
      status:   z.enum(["rascunho", "finalizado"]).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; reports: EvaluationReport[] } | { ok: false; error: string }> => {
    const userId = context.user.id;

    // Verificação explícita: deve ser membro da clínica
    const member = await getClinicMembership(data.clinicId, userId);

    if (!member) return { ok: false, error: "Sem permissão" };

    let query = supabaseAdmin
      .from("evaluation_reports")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .order("created_at", { ascending: false });

    // Terapeuta só vê os próprios relatórios
    if (member.role === "therapist") {
      query = query.eq("therapist_user_id", userId);
    }

    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, reports: (rows ?? []) as EvaluationReport[] };
  });

// ─── generateEvaluationPdfServer ─────────────────────────────────────────────
// Retorna HTML estruturado como string — coordenador usa print do browser.
// @react-pdf/renderer não está instalado no projeto.

export const generateEvaluationPdfServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reportId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; html: string } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: report } = await supabaseAdmin
      .from("evaluation_reports")
      .select("*")
      .eq("id", data.reportId)
      .single();

    if (!report) return { ok: false, error: "Relatório não encontrado" };

    // Verificação explícita de permissão (LGPD)
    const member = await getClinicMembership(report.clinic_id, userId);

    const isTherapist = report.therapist_user_id === userId;
    const isCoordinator = member?.role === "coordinator";
    if (!isTherapist && !isCoordinator) return { ok: false, error: "Sem permissão" };

    const { data: entry } = await supabaseAdmin
      .from("queue_entries")
      .select("child_name, child_birthdate, child_cid, responsavel_nome")
      .eq("id", report.queue_entry_id)
      .single();

    const modalities = (report.recommended_modality as string[])?.join(", ") ?? "—";
    const instruments = (report.instruments as string[])?.join(", ") ?? "—";
    const barriers = (report.vbmapp_barriers as { barrier: string; description: string }[]) ?? [];

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório de Avaliação — ${entry?.child_name ?? ""}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 40px; }
    h1 { font-size: 18px; color: #4F46E5; }
    h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    td, th { border: 1px solid #ddd; padding: 6px 8px; }
    th { background: #f3f4f6; font-weight: 600; }
    .label { color: #6b7280; }
    .footer { margin-top: 40px; font-size: 10px; color: #9ca3af; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>TEAmo — Relatório de Avaliação Inicial</h1>
  <p style="color:#6b7280;font-size:11px;">Dado sensível de saúde — acesso restrito LGPD Art. 11</p>

  <h2>Dados do Paciente</h2>
  <table>
    <tr><td class="label">Nome</td><td>${entry?.child_name ?? "—"}</td></tr>
    <tr><td class="label">Data de nascimento</td><td>${entry?.child_birthdate ?? "—"}</td></tr>
    <tr><td class="label">CID</td><td>${entry?.child_cid ?? "—"}</td></tr>
    <tr><td class="label">Responsável</td><td>${entry?.responsavel_nome ?? "—"}</td></tr>
  </table>

  <h2>Dados da Avaliação</h2>
  <table>
    <tr><td class="label">Instrumento(s)</td><td>${instruments}</td></tr>
    <tr><td class="label">Nº de sessões</td><td>${report.sessions_count ?? 1}</td></tr>
    <tr><td class="label">Datas</td><td>${(report.evaluation_dates as string[])?.join(", ") ?? "—"}</td></tr>
    <tr><td class="label">Nível VB-MAPP</td><td>${report.vbmapp_level ? `Nível ${report.vbmapp_level}` : "—"}</td></tr>
  </table>

  ${barriers.length > 0 ? `
  <h2>Barreiras Identificadas</h2>
  <table>
    <tr><th>Barreira</th><th>Descrição</th></tr>
    ${barriers.map(b => `<tr><td>${b.barrier}</td><td>${b.description}</td></tr>`).join("")}
  </table>` : ""}

  <h2>Recomendação Terapêutica</h2>
  <table>
    <tr><td class="label">Modalidade indicada</td><td>${modalities}</td></tr>
    <tr><td class="label">Horas/semana recomendadas</td><td>${report.recommended_hours_per_week ?? "—"}</td></tr>
    <tr><td class="label">Sessões/semana</td><td>${report.sessions_per_week ?? "—"}</td></tr>
    <tr><td class="label">Duração da sessão</td><td>${report.session_duration_minutes ?? 60} min</td></tr>
  </table>

  <h2>Justificativa Clínica</h2>
  <p style="white-space:pre-wrap;">${report.clinical_justification ?? "—"}</p>

  <p class="footer">
    Código TUSS: 10.101.08-0 — RN ANS 539/2022 | Gerado em ${new Date().toLocaleDateString("pt-BR")} pelo sistema TEAmo.
    Este relatório é de uso exclusivo para fins de autorização junto ao convênio.
  </p>
</body>
</html>`;

    return { ok: true, html };
  });

// ─── sendForm2Server ──────────────────────────────────────────────────────────

export const sendForm2Server = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:          z.string().uuid(),
      queueEntryId:      z.string().uuid(),
      proposedSchedule:  z.object({
        days:              z.string(),
        startTime:         z.string(),
        endTime:           z.string(),
        therapistName:     z.string(),
        sessionType:       z.string(),
        roomName:          z.string().optional(),
      }),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`send-form2:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const { data: entry } = await supabaseAdmin
      .from("queue_entries")
      .select("child_name, responsavel_nome")
      .eq("id", data.queueEntryId)
      .single();

    const { data: token, error } = await supabaseAdmin
      .from("clinic_form_tokens")
      .insert({
        clinic_id:      data.clinicId,
        form_type:      "form2_horario",
        queue_entry_id: data.queueEntryId,
        created_by:     context.user.id,
        payload:        {
          child_name:         entry?.child_name ?? "",
          responsavel_nome:   entry?.responsavel_nome ?? "",
          proposed_schedule:  data.proposedSchedule,
        },
      })
      .select("token")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, token: token.token };
  });

// ─── getFormByTokenServer ─────────────────────────────────────────────────────
// Sem auth — formulários públicos

export const getFormByTokenServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{
    ok: true;
    formType: string;
    payload: Record<string, unknown>;
    expired: boolean;
    used: boolean;
  } | { ok: false; error: string }> => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`form-token-get:${ip}`, 30, 60_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const { data: tokenRow, error } = await supabaseAdmin
      .from("clinic_form_tokens")
      .select("*")
      .eq("token", data.token)
      .single();

    if (error || !tokenRow) return { ok: false, error: "Token inválido ou não encontrado" };

    const expired = new Date(tokenRow.expires_at) < new Date();
    const used = tokenRow.used_at != null;

    return {
      ok: true,
      formType: tokenRow.form_type,
      payload: (tokenRow.payload as Record<string, unknown>) ?? {},
      expired,
      used,
    };
  });

// ─── submitForm2Server ────────────────────────────────────────────────────────
// Sem auth — família confirma ou rejeita horário

export const submitForm2Server = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token:           z.string().min(1),
      confirmed:       z.boolean(),
      rejectionReason: z.string().max(500).optional(),
    }).parse(d)
  )
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { data: tokenRow } = await supabaseAdmin
      .from("clinic_form_tokens")
      .select("id, expires_at, used_at, form_type, clinic_id, queue_entry_id")
      .eq("token", data.token)
      .single();

    if (!tokenRow) return { ok: false, error: "Token inválido" };
    if (tokenRow.form_type !== "form2_horario") return { ok: false, error: "Token inválido para este formulário" };
    if (tokenRow.used_at) return { ok: true }; // Idempotente
    if (new Date(tokenRow.expires_at) < new Date()) return { ok: false, error: "Este link expirou" };

    const { data: current } = await supabaseAdmin
      .from("clinic_form_tokens")
      .select("payload")
      .eq("id", tokenRow.id)
      .single();

    await supabaseAdmin
      .from("clinic_form_tokens")
      .update({
        used_at: new Date().toISOString(),
        payload: {
          ...(current?.payload as Record<string, unknown> ?? {}),
          family_response: {
            confirmed:       data.confirmed,
            rejectionReason: data.rejectionReason ?? null,
            answered_at:     new Date().toISOString(),
          },
        },
      })
      .eq("id", tokenRow.id);

    // Audit log LGPD — dados clínicos sensíveis (Art. 11). Nunca logar conteúdo da resposta.
    await supabaseAdmin.from("audit_logs").insert({
      user_id:    null,
      event_type: "form2_family_response_submitted",
      metadata: {
        resourceType: "evaluation_report",
        resourceId:   tokenRow.queue_entry_id ?? null,
        clinicId:     tokenRow.clinic_id ?? null,
      },
    });

    return { ok: true };
  });

// ─── sendForm3Server ──────────────────────────────────────────────────────────

export const sendForm3Server = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:     z.string().uuid(),
      queueEntryId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const { data: entry } = await supabaseAdmin
      .from("queue_entries")
      .select("child_name, child_birthdate, responsavel_nome, responsavel_email")
      .eq("id", data.queueEntryId)
      .single();

    const { data: token, error } = await supabaseAdmin
      .from("clinic_form_tokens")
      .insert({
        clinic_id:      data.clinicId,
        form_type:      "form3_cadastro",
        queue_entry_id: data.queueEntryId,
        created_by:     context.user.id,
        expires_at:     new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        payload:        {
          child_name:      entry?.child_name ?? "",
          child_birthdate: entry?.child_birthdate ?? "",
          responsavel_nome:  entry?.responsavel_nome ?? "",
          responsavel_email: entry?.responsavel_email ?? "",
        },
      })
      .select("token")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, token: token.token };
  });

// ─── submitForm3Server ────────────────────────────────────────────────────────
// Sem auth — família preenche cadastro completo (11 seções)

export const submitForm3Server = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      token:               z.string().min(1),
      childFullName:       z.string().min(2).max(200),
      childCpf:            z.string().optional(),
      childBirthdate:      z.string(),
      guardians:           z.array(z.object({
        nome:       z.string().min(2),
        cpf:        z.string().optional(),
        parentesco: z.string(),
        email:      z.string().email().optional(),
        telefone:   z.string().optional(),
        is_primary: z.boolean().optional(),
      })).min(1),
      address:             z.record(z.unknown()).optional(),
      emergencyContacts:   z.array(z.object({
        nome:       z.string(),
        parentesco: z.string(),
        telefone:   z.string(),
      })).optional(),
      paymentType:         z.enum(["convenio", "particular", "misto"]).optional(),
      insuranceData:       z.record(z.unknown()).optional(),
      diagnosisFamilyReport: z.string().optional(),
      comorbidities:       z.array(z.string()).optional(),
      currentProfessionals: z.array(z.unknown()).optional(),
      schoolInfo:          z.record(z.unknown()).optional(),
      otherProfessionals:  z.array(z.unknown()).optional(),
      familyRoutine:       z.string().optional(),
      expectations:        z.string().optional(),
      consentGiven:        z.boolean(),
    }).parse(d)
  )
  .handler(async ({ data }): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> => {
    const request = getRequest();
    const ip = request ? getClientIp(request) : "unknown";
    const rl = rateLimit(`form3-submit:${ip}`, 5, 600_000);
    if (!rl.allowed) {
      throw new Response("Muitas tentativas. Tente novamente mais tarde.", {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds) },
      });
    }

    const { data: tokenRow } = await supabaseAdmin
      .from("clinic_form_tokens")
      .select("id, clinic_id, queue_entry_id, expires_at, used_at, form_type")
      .eq("token", data.token)
      .single();

    if (!tokenRow) return { ok: false, error: "Token inválido" };
    if (tokenRow.form_type !== "form3_cadastro") return { ok: false, error: "Token inválido para este formulário" };
    if (tokenRow.used_at) return { ok: false, error: "Este formulário já foi preenchido" };
    if (new Date(tokenRow.expires_at) < new Date()) return { ok: false, error: "Este link expirou" };
    if (!data.consentGiven) return { ok: false, error: "Consentimento LGPD é obrigatório" };

    const { data: profile, error } = await supabaseAdmin
      .from("patient_profiles")
      .insert({
        clinic_id:              tokenRow.clinic_id,
        queue_entry_id:         tokenRow.queue_entry_id,
        child_full_name:        data.childFullName,
        child_cpf:              data.childCpf ?? null,
        child_birthdate:        data.childBirthdate,
        guardians:              data.guardians,
        address:                data.address ?? {},
        emergency_contacts:     data.emergencyContacts ?? [],
        payment_type:           data.paymentType ?? null,
        insurance_data:         data.insuranceData ?? {},
        diagnosis_family_report: data.diagnosisFamilyReport ?? null,
        comorbidities:          data.comorbidities ?? [],
        current_professionals:  data.currentProfessionals ?? [],
        school_info:            data.schoolInfo ?? {},
        other_professionals:    data.otherProfessionals ?? [],
        family_routine:         data.familyRoutine ?? null,
        expectations:           data.expectations ?? null,
        consent_given:          data.consentGiven,
        consent_date:           new Date().toISOString(),
        status:                 "pendente",
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    await supabaseAdmin
      .from("clinic_form_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    return { ok: true, profileId: profile.id };
  });

// ─── approvePatientProfileServer ─────────────────────────────────────────────

export const approvePatientProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      profileId: z.string().uuid(),
      action:    z.enum(["aprovado", "rejeitado"]),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: profile } = await supabaseAdmin
      .from("patient_profiles")
      .select("clinic_id, payment_type, status, insurance_data")
      .eq("id", data.profileId)
      .single();

    if (!profile) return { ok: false, error: "Perfil não encontrado" };

    // Verificação explícita: apenas coordenador aprova (LGPD — dupla verificação)
    const member = await getClinicMembership(profile.clinic_id, userId);

    if (member?.role !== "coordinator") return { ok: false, error: "Apenas coordenadores podem aprovar cadastros" };

    // Gate freemium da clínica: free = 1 caso ativo (paciente aprovado).
    if (data.action === "aprovado" && !(await isClinicPremium(profile.clinic_id))) {
      const count = await clinicResourceCount("patient_profiles", profile.clinic_id, (q) =>
        q.eq("status", "aprovado").neq("id", data.profileId),
      );
      if (count >= CLINIC_LIMITS.casos) return clinicGateError("clinica-casos");
    }

    const { error } = await supabaseAdmin
      .from("patient_profiles")
      .update({
        status:      data.action,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })
      .eq("id", data.profileId);

    if (error) return { ok: false, error: error.message };

    // Fase 5: cria insurance_authorization inicial se aprovado e payment_type inclui convênio
    if (data.action === "aprovado" && (profile.payment_type === "convenio" || profile.payment_type === "misto")) {
      const insuranceData = (profile.insurance_data ?? {}) as {
        plano?: string;
        autorizacao?: string;
      };
      await supabaseAdmin.from("insurance_authorizations").insert({
        clinic_id:            profile.clinic_id,
        patient_profile_id:   data.profileId,
        insurance_plan:       insuranceData.plano ?? "A definir",
        authorization_number: insuranceData.autorizacao ?? "Pendente",
        valid_from:           new Date().toISOString().split("T")[0],
        valid_until:          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        sessions_authorized:  96,
        status:               "ativa",
        created_by:           userId,
      });
    }

    return { ok: true };
  });
