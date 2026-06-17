// ─── ServerFns do Módulo de Grupos ABA (Fase 7) ──────────────────────────────
// Dados sensíveis: composição agregada (nomes + nível), nunca prontuários completos.
// RLS: membro de grupo não acessa dados de outros membros.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type {
  ClinicGroup,
  ClinicGroupMember,
  GroupCandidate,
  MatchingResult,
  CompatibilityAlert,
  MatchingCriteria,
} from "@/types/clinic-groups";
import { isClinicPremium, clinicGateError } from "@/lib/subscription.functions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateAgeYears(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function checkCompatibility(
  criteria: MatchingCriteria,
  candidate: { vbmapp_level: number | null; factor_b: boolean; child_birthdate: string },
  existingMembers: Array<{ vbmapp_level: number | null; child_birthdate: string }>
): MatchingResult {
  const alerts: CompatibilityAlert[] = [];
  const ageYears = calculateAgeYears(candidate.child_birthdate);

  // Verifica faixa etária do grupo
  if (ageYears < criteria.age_min) {
    alerts.push({
      criterion: "Faixa etária",
      expected: `>= ${criteria.age_min} anos`,
      actual: `${ageYears} anos`,
      severity: "warning",
    });
  }
  if (ageYears > criteria.age_max) {
    alerts.push({
      criterion: "Faixa etária",
      expected: `<= ${criteria.age_max} anos`,
      actual: `${ageYears} anos`,
      severity: "warning",
    });
  }

  // Verifica compatibilidade de nível VB-MAPP com critério do grupo
  const level = candidate.vbmapp_level;
  if (level !== null) {
    if (level < criteria.vbmapp_level_min) {
      alerts.push({
        criterion: "Nível VB-MAPP",
        expected: `>= ${criteria.vbmapp_level_min}`,
        actual: `Nível ${level}`,
        severity: "warning",
      });
    }
    if (level > criteria.vbmapp_level_max) {
      alerts.push({
        criterion: "Nível VB-MAPP",
        expected: `<= ${criteria.vbmapp_level_max}`,
        actual: `Nível ${level}`,
        severity: "warning",
      });
    }
    // Verifica diferença de nível ≤ 1 com membros existentes
    for (const m of existingMembers) {
      if (m.vbmapp_level !== null && Math.abs(m.vbmapp_level - level) > 1) {
        alerts.push({
          criterion: "Diferença de nível VB-MAPP",
          expected: "Diferença máxima de 1 nível entre membros",
          actual: `Diferença de ${Math.abs(m.vbmapp_level - level)} níveis`,
          severity: "warning",
        });
        break;
      }
    }
  }

  // Verifica faixa etária: diferença máxima de 3 anos entre membros
  for (const m of existingMembers) {
    const mAge = calculateAgeYears(m.child_birthdate);
    if (Math.abs(mAge - ageYears) > 3) {
      alerts.push({
        criterion: "Diferença de idade",
        expected: "Diferença máxima de 3 anos entre membros",
        actual: `Diferença de ${Math.abs(mAge - ageYears)} anos`,
        severity: "warning",
      });
      break;
    }
  }

  // Fator B: alerta obrigatório se grupo não permite comportamento-desafio
  if (candidate.factor_b && !criteria.allow_factor_b) {
    alerts.push({
      criterion: "Fator B — Comportamento-desafio",
      expected: "Grupo não permite Fator B ativo",
      actual: "Candidato tem Fator B ativo",
      severity: "block",
    });
  }

  const hasBlock = alerts.some((a) => a.severity === "block");
  const requiresJustification = alerts.length > 0;

  return {
    compatible: !hasBlock,
    alerts,
    requiresJustification,
  };
}

function computeCompatibilityScore(result: MatchingResult): number {
  if (!result.compatible) return 0;
  const penaltyPerWarning = 10;
  return Math.max(0, 100 - result.alerts.length * penaltyPerWarning);
}

// ─── createGroupServer ────────────────────────────────────────────────────────

export const createGroupServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      name:             z.string().min(1),
      therapistUserId:  z.string().uuid(),
      roomId:           z.string().uuid(),
      dayOfWeek:        z.number().int().min(0).max(6),
      startTime:        z.string(),
      durationMinutes:  z.number().int().positive().optional(),
      capacityMax:      z.number().int().min(2).max(6).optional(),
      matchingCriteria: z.object({
        vbmapp_level_min: z.number().int().min(1).max(3),
        vbmapp_level_max: z.number().int().min(1).max(3),
        age_min:          z.number().int().min(0),
        age_max:          z.number().int().min(0),
        allow_factor_b:   z.boolean(),
      }).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") {
      return { ok: false, error: "Apenas coordenadores podem criar grupos" };
    }

    // Grupos ABA são exclusivos do Premium da clínica.
    if (!(await isClinicPremium(data.clinicId))) return clinicGateError("clinica-grupos");

    const insertData: Record<string, unknown> = {
      clinic_id:         data.clinicId,
      name:              data.name,
      therapist_user_id: data.therapistUserId,
      room_id:           data.roomId,
      day_of_week:       data.dayOfWeek,
      start_time:        data.startTime,
      duration_minutes:  data.durationMinutes ?? 60,
      capacity_max:      data.capacityMax ?? 4,
      status:            "formando",
    };

    if (data.matchingCriteria) {
      insertData.matching_criteria = data.matchingCriteria;
    }

    const { data: group, error } = await supabaseAdmin
      .from("clinic_groups")
      .insert(insertData)
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };

    return { ok: true, groupId: group.id };
  });

// ─── listGroupsServer ─────────────────────────────────────────────────────────

export const listGroupsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
      status:   z.enum(["formando", "ativo", "encerrado"]).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; groups: ClinicGroup[] } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (!member) return { ok: false, error: "Acesso negado" };

    let query = supabaseAdmin
      .from("clinic_groups")
      .select(`
        *,
        clinic_group_members!left(id, patient_profile_id, left_at)
      `)
      .eq("clinic_id", data.clinicId)
      .order("created_at", { ascending: false });

    if (data.status) {
      query = query.eq("status", data.status);
    }

    const { data: rows, error } = await query;
    if (error) return { ok: false, error: error.message };

    // Busca nomes de terapeutas e salas
    const therapistIds = [...new Set(rows.map((r: Record<string, unknown>) => r.therapist_user_id as string))];
    const roomIds = [...new Set(rows.map((r: Record<string, unknown>) => r.room_id as string))];

    const [therapistsRes, roomsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", therapistIds),
      supabaseAdmin.from("clinic_rooms").select("id, name").in("id", roomIds),
    ]);

    const therapistMap = new Map((therapistsRes.data ?? []).map((t: { id: string; full_name: string }) => [t.id, t.full_name]));
    const roomMap = new Map((roomsRes.data ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));

    const groups: ClinicGroup[] = rows.map((row: Record<string, unknown>) => {
      const members = (row.clinic_group_members as Array<{ id: string; patient_profile_id: string; left_at: string | null }> | null) ?? [];
      const activeMembers = members.filter((m) => m.left_at === null);
      return {
        id:                 row.id as string,
        clinic_id:          row.clinic_id as string,
        name:               row.name as string,
        therapist_user_id:  row.therapist_user_id as string,
        room_id:            row.room_id as string,
        day_of_week:        row.day_of_week as number,
        start_time:         row.start_time as string,
        duration_minutes:   row.duration_minutes as number,
        capacity_max:       row.capacity_max as number,
        matching_criteria:  row.matching_criteria as MatchingCriteria,
        status:             row.status as "formando" | "ativo" | "encerrado",
        created_at:         row.created_at as string,
        updated_at:         row.updated_at as string,
        therapist_name:     therapistMap.get(row.therapist_user_id as string) ?? "—",
        room_name:          roomMap.get(row.room_id as string) ?? "—",
        member_count:       activeMembers.length,
      };
    });

    return { ok: true, groups };
  });

// ─── getGroupDetailServer ─────────────────────────────────────────────────────

export const getGroupDetailServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      groupId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; group: ClinicGroup } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: group, error } = await supabaseAdmin
      .from("clinic_groups")
      .select("*")
      .eq("id", data.groupId)
      .single();

    if (error || !group) return { ok: false, error: "Grupo não encontrado" };

    const { data: memberCheck } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", group.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (!memberCheck) return { ok: false, error: "Acesso negado" };

    // Busca membros ativos com dados do paciente
    const { data: memberRows, error: memberError } = await supabaseAdmin
      .from("clinic_group_members")
      .select(`
        *,
        patient_profiles!inner(
          id, child_full_name, child_birthdate, status,
          evaluation_report_id
        )
      `)
      .eq("clinic_group_id", data.groupId)
      .is("left_at", null)
      .order("joined_at", { ascending: true });

    if (memberError) return { ok: false, error: memberError.message };

    // Busca níveis VB-MAPP via evaluation_reports
    const reportIds = (memberRows ?? [])
      .map((m: Record<string, unknown>) => {
        const pp = m.patient_profiles as Record<string, unknown> | null;
        return pp?.evaluation_report_id as string | null;
      })
      .filter(Boolean) as string[];

    const { data: reports } = reportIds.length > 0
      ? await supabaseAdmin
          .from("evaluation_reports")
          .select("id, vbmapp_level")
          .in("id", reportIds)
      : { data: [] };

    const reportLevelMap = new Map(
      (reports ?? []).map((r: { id: string; vbmapp_level: number | null }) => [r.id, r.vbmapp_level])
    );

    const members: ClinicGroupMember[] = (memberRows ?? []).map((m: Record<string, unknown>) => {
      const pp = m.patient_profiles as Record<string, unknown> | null;
      const reportId = pp?.evaluation_report_id as string | null;
      return {
        id:                     m.id as string,
        clinic_group_id:        m.clinic_group_id as string,
        patient_profile_id:     m.patient_profile_id as string,
        joined_at:              m.joined_at as string,
        left_at:                m.left_at as string | null,
        leave_reason:           m.leave_reason as string | null,
        exception_justification: m.exception_justification as string | null,
        patient: pp ? {
          id:                pp.id as string,
          child_full_name:   pp.child_full_name as string,
          child_birthdate:   pp.child_birthdate as string,
          vbmapp_level:      reportId ? (reportLevelMap.get(reportId) ?? null) : null,
        } as ClinicGroupMember["patient"] : undefined,
      };
    });

    const [therapistRes, roomRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", group.therapist_user_id).single(),
      supabaseAdmin.from("clinic_rooms").select("name").eq("id", group.room_id).single(),
    ]);

    return {
      ok: true,
      group: {
        ...group,
        matching_criteria: group.matching_criteria as MatchingCriteria,
        therapist_name: therapistRes.data?.full_name ?? "—",
        room_name:      roomRes.data?.name ?? "—",
        member_count:   members.length,
        members,
      },
    };
  });

// ─── getSuggestedCandidatesServer ─────────────────────────────────────────────
// Filtra queue_entries onde modalidades contém 'aba_grupo' E status = 'aguardando'
// Calcula score de compatibilidade com critérios do grupo

export const getSuggestedCandidatesServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      groupId: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; candidates: GroupCandidate[] } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: group, error: groupError } = await supabaseAdmin
      .from("clinic_groups")
      .select("*")
      .eq("id", data.groupId)
      .single();

    if (groupError || !group) return { ok: false, error: "Grupo não encontrado" };

    const { data: memberCheck } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", group.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (!memberCheck) return { ok: false, error: "Acesso negado" };

    const criteria = group.matching_criteria as MatchingCriteria;

    // Busca membros ativos para comparação de compatibilidade
    const { data: activeMembers } = await supabaseAdmin
      .from("clinic_group_members")
      .select(`
        patient_profiles!inner(child_birthdate, evaluation_report_id)
      `)
      .eq("clinic_group_id", data.groupId)
      .is("left_at", null);

    const existingMemberProfiles = (activeMembers ?? []).map((m: Record<string, unknown>) => {
      const pp = m.patient_profiles as Record<string, unknown> | null;
      return {
        child_birthdate: (pp?.child_birthdate as string) ?? "",
        vbmapp_level: null as number | null,
      };
    });

    // Busca candidatos da fila que querem ABA em grupo e ainda aguardam
    const { data: queueEntries, error: queueError } = await supabaseAdmin
      .from("queue_entries")
      .select("id, child_name, child_birthdate, factor_b, modalidades")
      .eq("clinic_id", group.clinic_id)
      .eq("status", "aguardando")
      .contains("modalidades", ["aba_grupo"]);

    if (queueError) return { ok: false, error: queueError.message };

    // Filtra entradas que já têm patient_profile aprovado (já passaram da avaliação)
    const entryIds = (queueEntries ?? []).map((e: Record<string, unknown>) => e.id as string);

    const { data: profiles } = entryIds.length > 0
      ? await supabaseAdmin
          .from("patient_profiles")
          .select("id, queue_entry_id, evaluation_report_id, child_birthdate")
          .in("queue_entry_id", entryIds)
          .eq("status", "aprovado")
      : { data: [] };

    const profileByEntry = new Map(
      (profiles ?? []).map((p: { id: string; queue_entry_id: string; evaluation_report_id: string | null; child_birthdate: string }) => [
        p.queue_entry_id,
        p,
      ])
    );

    // Busca níveis VB-MAPP dos candidatos com perfil aprovado
    const reportIds = (profiles ?? [])
      .map((p: { evaluation_report_id: string | null }) => p.evaluation_report_id)
      .filter(Boolean) as string[];

    const { data: evalReports } = reportIds.length > 0
      ? await supabaseAdmin
          .from("evaluation_reports")
          .select("id, vbmapp_level")
          .in("id", reportIds)
      : { data: [] };

    const reportLevelMap = new Map(
      (evalReports ?? []).map((r: { id: string; vbmapp_level: number | null }) => [r.id, r.vbmapp_level])
    );

    const candidates: GroupCandidate[] = [];

    for (const entry of queueEntries ?? []) {
      const profile = profileByEntry.get(entry.id as string);
      if (!profile) continue;

      const factorBRaw = entry.factor_b as Record<string, unknown> | null;
      const factorB = factorBRaw?.comportamento_desafio === true || factorBRaw?.comportamento_desafio === "true";

      const vbmappLevel = profile.evaluation_report_id
        ? (reportLevelMap.get(profile.evaluation_report_id as string) ?? null)
        : null;

      const candidateData = {
        vbmapp_level: vbmappLevel,
        factor_b: factorB,
        child_birthdate: (profile.child_birthdate ?? entry.child_birthdate) as string,
      };

      const matchingResult = checkCompatibility(criteria, candidateData, existingMemberProfiles);
      const score = computeCompatibilityScore(matchingResult);

      candidates.push({
        entry_id:          entry.id as string,
        patient_profile_id: profile.id,
        child_name:        entry.child_name as string,
        child_birthdate:   candidateData.child_birthdate,
        vbmapp_level:      vbmappLevel,
        factor_b:          factorB,
        score,
        matchingResult,
      });
    }

    // Ordena por score de compatibilidade decrescente
    candidates.sort((a, b) => b.score - a.score);

    return { ok: true, candidates };
  });

// ─── addGroupMemberServer ─────────────────────────────────────────────────────

export const addGroupMemberServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      groupId:                z.string().uuid(),
      patientProfileId:       z.string().uuid(),
      exceptionJustification: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; alerts: CompatibilityAlert[] } | { ok: false; error: string; alerts?: CompatibilityAlert[] }> => {
    const userId = context.user.id;

    const { data: group, error: groupError } = await supabaseAdmin
      .from("clinic_groups")
      .select("*")
      .eq("id", data.groupId)
      .single();

    if (groupError || !group) return { ok: false, error: "Grupo não encontrado" };

    const { data: memberCheck } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", group.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (memberCheck?.role !== "coordinator") return { ok: false, error: "Apenas coordenadores podem adicionar membros" };

    // Verifica capacidade
    const { count: activeCount } = await supabaseAdmin
      .from("clinic_group_members")
      .select("*", { count: "exact", head: true })
      .eq("clinic_group_id", data.groupId)
      .is("left_at", null);

    if ((activeCount ?? 0) >= group.capacity_max) {
      return { ok: false, error: `Grupo atingiu capacidade máxima (${group.capacity_max} membros)` };
    }

    // Busca dados do candidato para verificar compatibilidade
    const { data: profile } = await supabaseAdmin
      .from("patient_profiles")
      .select("id, child_birthdate, evaluation_report_id, queue_entry_id")
      .eq("id", data.patientProfileId)
      .single();

    if (!profile) return { ok: false, error: "Perfil do paciente não encontrado" };

    // Busca queue_entry para factor_b
    const { data: queueEntry } = profile.queue_entry_id
      ? await supabaseAdmin
          .from("queue_entries")
          .select("factor_b")
          .eq("id", profile.queue_entry_id)
          .single()
      : { data: null };

    const factorBRaw = (queueEntry?.factor_b as Record<string, unknown> | null);
    const factorB = factorBRaw?.comportamento_desafio === true || factorBRaw?.comportamento_desafio === "true";

    const { data: evalReport } = profile.evaluation_report_id
      ? await supabaseAdmin
          .from("evaluation_reports")
          .select("vbmapp_level")
          .eq("id", profile.evaluation_report_id)
          .single()
      : { data: null };

    // Busca membros existentes para comparação
    const { data: existingMembersRaw } = await supabaseAdmin
      .from("clinic_group_members")
      .select(`
        patient_profiles!inner(child_birthdate, evaluation_report_id)
      `)
      .eq("clinic_group_id", data.groupId)
      .is("left_at", null);

    const existingMembers = (existingMembersRaw ?? []).map((m: Record<string, unknown>) => {
      const pp = m.patient_profiles as Record<string, unknown> | null;
      return {
        child_birthdate: (pp?.child_birthdate as string) ?? "",
        vbmapp_level: null as number | null,
      };
    });

    const criteria = group.matching_criteria as MatchingCriteria;
    const matchingResult = checkCompatibility(
      criteria,
      {
        vbmapp_level: evalReport?.vbmapp_level ?? null,
        factor_b: factorB,
        child_birthdate: profile.child_birthdate,
      },
      existingMembers
    );

    // Se tem alerta de bloqueio e não há justificativa → retornar alerta sem inserir
    const hasBlock = matchingResult.alerts.some((a) => a.severity === "block");
    if (hasBlock && !data.exceptionJustification) {
      return {
        ok: false,
        error: "Incompatibilidade detectada. Informe uma justificativa para prosseguir.",
        alerts: matchingResult.alerts,
      };
    }

    const { error: insertError } = await supabaseAdmin
      .from("clinic_group_members")
      .insert({
        clinic_group_id:         data.groupId,
        patient_profile_id:      data.patientProfileId,
        exception_justification: data.exceptionJustification ?? null,
      });

    if (insertError) return { ok: false, error: insertError.message };

    // Atualiza status do grupo para 'ativo' se atingiu capacidade mínima (2 membros)
    const newCount = (activeCount ?? 0) + 1;
    if (group.status === "formando" && newCount >= 2) {
      await supabaseAdmin
        .from("clinic_groups")
        .update({ status: "ativo", updated_at: new Date().toISOString() })
        .eq("id", data.groupId);
    }

    return { ok: true, alerts: matchingResult.alerts };
  });

// ─── removeGroupMemberServer ──────────────────────────────────────────────────

export const removeGroupMemberServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      memberId:    z.string().uuid(),
      leaveReason: z.string().min(1),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: member } = await supabaseAdmin
      .from("clinic_group_members")
      .select("clinic_group_id")
      .eq("id", data.memberId)
      .single();

    if (!member) return { ok: false, error: "Membro não encontrado" };

    const { data: group } = await supabaseAdmin
      .from("clinic_groups")
      .select("clinic_id")
      .eq("id", member.clinic_group_id)
      .single();

    if (!group) return { ok: false, error: "Grupo não encontrado" };

    const { data: clinicMember } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", group.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (clinicMember?.role !== "coordinator") return { ok: false, error: "Apenas coordenadores podem remover membros" };

    const { error } = await supabaseAdmin
      .from("clinic_group_members")
      .update({
        left_at:      new Date().toISOString(),
        leave_reason: data.leaveReason,
      })
      .eq("id", data.memberId)
      .is("left_at", null);

    if (error) return { ok: false, error: error.message };

    return { ok: true };
  });

// ─── updateGroupStatusServer ──────────────────────────────────────────────────

export const updateGroupStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      groupId: z.string().uuid(),
      status:  z.enum(["formando", "ativo", "encerrado"]),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const userId = context.user.id;

    const { data: group } = await supabaseAdmin
      .from("clinic_groups")
      .select("clinic_id")
      .eq("id", data.groupId)
      .single();

    if (!group) return { ok: false, error: "Grupo não encontrado" };

    const { data: member } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", group.clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();

    if (member?.role !== "coordinator") return { ok: false, error: "Apenas coordenadores podem alterar status do grupo" };

    const { error } = await supabaseAdmin
      .from("clinic_groups")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.groupId);

    if (error) return { ok: false, error: error.message };

    return { ok: true };
  });
