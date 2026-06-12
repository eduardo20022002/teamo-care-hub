// ─── ServerFns do Módulo de Agenda da Clínica (Fase 3) ───────────────────────
// Todas as funções exigem requireSupabaseAuth.
// Operações de escrita usam supabaseAdmin para bypass de RLS controlado.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  ClinicRoom,
  TherapistAvailability,
  RecurringSchedule,
  ClinicSession,
  ClinicReplacement,
} from "@/types/clinic-agenda";


// ─── listClinicRoomsServer ───────────────────────────────────────────────────

export const listClinicRoomsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clinicId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; rooms: ClinicRoom[] } | { ok: false; error: string }> => {
    const { data: rows, error } = await supabaseAdmin
      .from("clinic_rooms")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .order("name");

    if (error) return { ok: false, error: error.message };
    return { ok: true, rooms: (rows ?? []) as ClinicRoom[] };
  });

// ─── createClinicRoomServer ──────────────────────────────────────────────────

export const createClinicRoomServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:  z.string().uuid(),
      name:      z.string().trim().min(1).max(120),
      capacity:  z.number().int().min(1).max(50).optional(),
      resources: z.array(z.string().max(80)).max(20).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; roomId: string } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: roomAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (roomAccess?.role !== "coordinator") return { ok: false, error: "Acesso negado." };

    const { data: room, error } = await supabaseAdmin
      .from("clinic_rooms")
      .insert({
        clinic_id: data.clinicId,
        name:      data.name,
        capacity:  data.capacity ?? 1,
        resources: data.resources ?? [],
      })
      .select("id")
      .single();

    if (error || !room) return { ok: false, error: error?.message ?? "Erro ao criar sala." };
    return { ok: true, roomId: room.id };
  });

// ─── setTherapistAvailabilityServer ─────────────────────────────────────────
// Substitui todos os slots do terapeuta para a clínica (delete + insert).

export const setTherapistAvailabilityServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId: z.string().uuid(),
      userId:   z.string().uuid(),
      slots:    z.array(z.object({
        day_of_week: z.number().int().min(0).max(6),
        start_time:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        end_time:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      })).max(50),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: availAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!availAccess) return { ok: false, error: "Acesso negado." };

    const { error: delErr } = await supabaseAdmin
      .from("clinic_therapist_availability")
      .delete()
      .eq("clinic_id", data.clinicId)
      .eq("user_id", data.userId);

    if (delErr) return { ok: false, error: delErr.message };

    if (data.slots.length === 0) return { ok: true };

    const rows = data.slots.map((s) => ({
      clinic_id:   data.clinicId,
      user_id:     data.userId,
      day_of_week: s.day_of_week,
      start_time:  s.start_time,
      end_time:    s.end_time,
    }));

    const { error: insErr } = await supabaseAdmin
      .from("clinic_therapist_availability")
      .insert(rows);

    if (insErr) return { ok: false, error: insErr.message };
    return { ok: true };
  });

// ─── getTherapistAvailabilityServer ─────────────────────────────────────────

export const getTherapistAvailabilityServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clinicId: z.string().uuid(), userId: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; slots: TherapistAvailability[] } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: slotAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!slotAccess) return { ok: false, error: "Acesso negado." };

    const { data: rows, error } = await supabaseAdmin
      .from("clinic_therapist_availability")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", data.userId)
      .order("day_of_week")
      .order("start_time");

    if (error) return { ok: false, error: error.message };
    return { ok: true, slots: (rows ?? []) as TherapistAvailability[] };
  });

// ─── createRecurringScheduleServer ──────────────────────────────────────────
// Integração Fase 2: se queue_entry_id presente → atualiza status='agendado'.

export const createRecurringScheduleServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:         z.string().uuid(),
      queueEntryId:     z.string().uuid().optional().nullable(),
      therapistUserId:  z.string().uuid(),
      roomId:           z.string().uuid(),
      patientName:      z.string().trim().min(1).max(200),
      dayOfWeek:        z.number().int().min(0).max(6),
      startTime:        z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      durationMinutes:  z.number().int().min(15).max(180).optional(),
      sessionType:      z.enum(["terapeutica","avaliacao","devolutiva","reposicao","orientacao_pais"]).optional(),
      startsOn:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsOn:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; scheduleId: string } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: schedAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!schedAccess) return { ok: false, error: "Acesso negado." };

    const { data: schedule, error } = await supabaseAdmin
      .from("clinic_recurring_schedules")
      .insert({
        clinic_id:        data.clinicId,
        queue_entry_id:   data.queueEntryId ?? null,
        therapist_user_id: data.therapistUserId,
        room_id:          data.roomId,
        patient_name:     data.patientName,
        day_of_week:      data.dayOfWeek,
        start_time:       data.startTime,
        duration_minutes: data.durationMinutes ?? 60,
        session_type:     data.sessionType ?? "terapeutica",
        starts_on:        data.startsOn,
        ends_on:          data.endsOn ?? null,
      })
      .select("id")
      .single();

    if (error || !schedule) return { ok: false, error: error?.message ?? "Erro ao criar agendamento." };

    // Integração Fase 2: marcar queue_entry como agendada
    if (data.queueEntryId) {
      await supabaseAdmin
        .from("queue_entries")
        .update({ status: "agendado" })
        .eq("id", data.queueEntryId);
    }

    return { ok: true, scheduleId: schedule.id };
  });

// ─── generateSessionsServer ─────────────────────────────────────────────────
// Chama a Edge Function generate-clinic-sessions.

export const generateSessionsServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      scheduleId: z.string().uuid(),
      weeksAhead: z.number().int().min(1).max(52).optional(),
    }).parse(d)
  )
  .handler(async ({ data }): Promise<{ ok: true; count: number } | { ok: false; error: string }> => {
    const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "";
    const serviceKey  = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-clinic-sessions`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        schedule_id: data.scheduleId,
        weeks_ahead: data.weeksAhead ?? 8,
      }),
    });

    const json = await res.json() as { ok: boolean; count?: number; error?: string };
    if (!json.ok) return { ok: false, error: json.error ?? "Erro ao gerar sessões." };
    return { ok: true, count: json.count ?? 0 };
  });

// ─── listClinicSessionsServer ────────────────────────────────────────────────

export const listClinicSessionsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:    z.string().uuid(),
      weekStart:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      therapistId: z.string().uuid().optional().nullable(),
      roomId:      z.string().uuid().optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; sessions: ClinicSession[] } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: sessAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!sessAccess) return { ok: false, error: "Acesso negado." };

    // Compute week end (6 days after weekStart)
    const start = new Date(data.weekStart);
    const end   = new Date(start);
    end.setDate(end.getDate() + 6);
    const weekEnd = end.toISOString().slice(0, 10);

    let query = supabaseAdmin
      .from("clinic_sessions")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .gte("session_date", data.weekStart)
      .lte("session_date", weekEnd)
      .order("session_date")
      .order("start_time");

    if (data.therapistId) query = query.eq("therapist_user_id", data.therapistId);
    if (data.roomId)      query = query.eq("room_id", data.roomId);

    const { data: rows, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, sessions: (rows ?? []) as ClinicSession[] };
  });

// ─── updateSessionStatusServer ──────────────────────────────────────────────
// Placeholder para Fase 5: quando status = 'realizada' e insurance_authorization_id
// presente, a Fase 5 adicionará um trigger no banco para decrementar a cota.

export const updateSessionStatusServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      sessionId: z.string().uuid(),
      status:    z.enum(["agendada","realizada","falta_justificada","falta_nao_justificada","cancelada_clinica"]),
      notes:     z.string().max(2000).optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: sessionRow } = await (supabaseAdmin as any)
      .from("clinic_sessions")
      .select("clinic_id")
      .eq("id", data.sessionId)
      .single();
    if (!sessionRow) return { ok: false, error: "Sessão não encontrada." };
    const { data: statusAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", (sessionRow as { clinic_id: string }).clinic_id)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!statusAccess) return { ok: false, error: "Acesso negado." };

    const { error } = await supabaseAdmin
      .from("clinic_sessions")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.sessionId);

    if (error) return { ok: false, error: error.message };

    // TODO Fase 5: quando status === 'realizada' e insurance_authorization_id IS NOT NULL
    // → decrementar cota em insurance_authorizations via trigger ou chamada aqui.

    return { ok: true };
  });

// ─── registerTherapistAbsenceServer ─────────────────────────────────────────
// Cancela sessões do período, cria reposições e registra a ausência.
// Placeholder para Fase 6: notificação às famílias via createCommunicationServer.

export const registerTherapistAbsenceServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:        z.string().uuid(),
      therapistUserId: z.string().uuid(),
      absenceType:     z.enum(["doenca","emergencia","falta_justificada","falta_nao_justificada","outro"]),
      startsOn:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsOn:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      partial:         z.boolean().optional(),
      affectedTimes:   z.array(z.string()).optional(),
      notes:           z.string().max(2000).optional().nullable(),
      replacementDeadlineDays: z.number().int().min(1).max(180).optional(),
    }).parse(d)
  )
  .handler(async ({
    data,
    context,
  }): Promise<{ ok: true; cancelledCount: number; replacementsCreated: number } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    const { data: absAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!absAccess) return { ok: false, error: "Acesso negado." };

    // 1. Buscar sessões afetadas
    let query = supabaseAdmin
      .from("clinic_sessions")
      .select("id, patient_name")
      .eq("clinic_id", data.clinicId)
      .eq("therapist_user_id", data.therapistUserId)
      .eq("status", "agendada")
      .gte("session_date", data.startsOn)
      .lte("session_date", data.endsOn);

    if (data.partial && data.affectedTimes && data.affectedTimes.length > 0) {
      query = query.in("start_time", data.affectedTimes);
    }

    const { data: affectedSessions, error: fetchErr } = await query;
    if (fetchErr) return { ok: false, error: fetchErr.message };

    const sessions = affectedSessions ?? [];

    // 2. Cancelar sessões
    if (sessions.length > 0) {
      const ids = sessions.map((s) => s.id);
      const { error: cancelErr } = await supabaseAdmin
        .from("clinic_sessions")
        .update({ status: "cancelada_clinica" })
        .in("id", ids);

      if (cancelErr) return { ok: false, error: cancelErr.message };
    }

    // 3. Criar reposições
    const deadlineDays = data.replacementDeadlineDays ?? 45;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    const deadlineDate = deadline.toISOString().slice(0, 10);

    let replacementsCreated = 0;
    if (sessions.length > 0) {
      const replacements = sessions.map((s) => ({
        clinic_id:           data.clinicId,
        original_session_id: s.id,
        therapist_user_id:   data.therapistUserId,
        patient_name:        s.patient_name,
        event_type:          "ausencia_terapeuta" as const,
        status:              "pendente" as const,
        deadline_date:       deadlineDate,
      }));

      const { error: repErr, count } = await supabaseAdmin
        .from("clinic_replacements")
        .insert(replacements, { count: "exact" });

      if (repErr) return { ok: false, error: repErr.message };
      replacementsCreated = count ?? replacements.length;
    }

    // 4. Registrar ausência
    const { error: absErr } = await supabaseAdmin
      .from("clinic_therapist_absences")
      .insert({
        clinic_id:         data.clinicId,
        therapist_user_id: data.therapistUserId,
        absence_type:      data.absenceType,
        starts_on:         data.startsOn,
        ends_on:           data.endsOn,
        partial:           data.partial ?? false,
        affected_times:    data.affectedTimes ?? [],
        notes:             data.notes ?? null,
        sessions_cancelled: sessions.length,
        created_by:        userId,
      });

    if (absErr) return { ok: false, error: absErr.message };

    // Fase 6: notificar cada família afetada
    const cancelDeadline = new Date();
    cancelDeadline.setDate(cancelDeadline.getDate() + 2);
    for (const session of sessions) {
      const { data: tokenRow } = await supabaseAdmin
        .from("clinic_form_tokens")
        .insert({
          clinic_id:  data.clinicId,
          form_type:  "confirmacao_clinica",
          payload: {
            patient_name:   session.patient_name,
            session_date:   data.startsOn,
            start_time:     "",
            therapist_name: "",
          },
          expires_at:  cancelDeadline.toISOString(),
          created_by:  userId,
        })
        .select("id")
        .single();
      await supabaseAdmin.from("clinic_communications").insert({
        clinic_id:         data.clinicId,
        patient_profile_id: (session as Record<string, unknown>).patient_profile_id as string ?? null,
        comm_type:         "cancelamento_ausencia_terapeuta",
        token_id:          (tokenRow as { id: string } | null)?.id ?? null,
        status:            "enviado",
        response_deadline: cancelDeadline.toISOString(),
      });
    }

    return { ok: true, cancelledCount: sessions.length, replacementsCreated };
  });

// ─── listClinicReplacementsServer ────────────────────────────────────────────

export const listClinicReplacementsServer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      clinicId:    z.string().uuid(),
      status:      z.enum(["pendente","agendada","realizada","expirada"]).optional().nullable(),
      therapistId: z.string().uuid().optional().nullable(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; replacements: ClinicReplacement[] } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };
    const { data: repAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", data.clinicId)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!repAccess) return { ok: false, error: "Acesso negado." };

    let query = supabaseAdmin
      .from("clinic_replacements")
      .select("*")
      .eq("clinic_id", data.clinicId)
      .order("deadline_date");

    if (data.status)      query = query.eq("status", data.status);
    if (data.therapistId) query = query.eq("therapist_user_id", data.therapistId);

    const { data: rows, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, replacements: (rows ?? []) as ClinicReplacement[] };
  });

// ─── proposeReplacementSlotServer ───────────────────────────────────────────
// Propõe um horário avulso para reposição, criando a clinic_session e linkando.
// Placeholder para Fase 6: notificar família via createCommunicationServer.

export const proposeReplacementSlotServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      replacementId: z.string().uuid(),
      proposedDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      proposedTime:  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      roomId:        z.string().uuid(),
      durationMinutes: z.number().int().min(15).max(180).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> => {
    const { userId } = context as { userId: string };

    // Buscar dados da reposição
    const { data: rep, error: repErr } = await supabaseAdmin
      .from("clinic_replacements")
      .select("*, original_session:clinic_sessions!original_session_id(*)")
      .eq("id", data.replacementId)
      .single();

    if (repErr || !rep) return { ok: false, error: repErr?.message ?? "Reposição não encontrada." };

    const { data: propAccess } = await supabaseAdmin
      .from("clinic_members")
      .select("role")
      .eq("clinic_id", rep.clinic_id as string)
      .eq("user_id", userId)
      .not("joined_at", "is", null)
      .single();
    if (!propAccess) return { ok: false, error: "Acesso negado." };

    const origSession = rep.original_session as ClinicSession | null;
    if (!origSession) return { ok: false, error: "Sessão original não encontrada." };

    // Criar sessão de reposição
    const { data: newSession, error: sessErr } = await supabaseAdmin
      .from("clinic_sessions")
      .insert({
        clinic_id:         rep.clinic_id,
        therapist_user_id: rep.therapist_user_id,
        room_id:           data.roomId,
        patient_name:      rep.patient_name,
        session_date:      data.proposedDate,
        start_time:        data.proposedTime,
        duration_minutes:  data.durationMinutes ?? origSession.duration_minutes ?? 60,
        session_type:      "reposicao",
        status:            "agendada",
      })
      .select("id")
      .single();

    if (sessErr || !newSession) return { ok: false, error: sessErr?.message ?? "Erro ao criar sessão de reposição." };

    // Atualizar replacement
    const { error: updErr } = await supabaseAdmin
      .from("clinic_replacements")
      .update({ status: "agendada", replacement_session_id: newSession.id })
      .eq("id", data.replacementId);

    if (updErr) return { ok: false, error: updErr.message };

    // Fase 6: notificar família da proposta de reposição
    const repDeadline = new Date();
    repDeadline.setDate(repDeadline.getDate() + 3);
    const { data: repTokenRow } = await supabaseAdmin
      .from("clinic_form_tokens")
      .insert({
        clinic_id:  rep.clinic_id as string,
        form_type:  "confirmacao_clinica",
        payload: {
          patient_name:   rep.patient_name as string,
          proposed_date:  data.proposedDate,
          proposed_time:  data.proposedTime,
          replacement_id: data.replacementId,
        },
        expires_at:  repDeadline.toISOString(),
        created_by:  rep.therapist_user_id as string,
      })
      .select("id")
      .single();
    await supabaseAdmin.from("clinic_communications").insert({
      clinic_id:         rep.clinic_id as string,
      comm_type:         "proposta_reposicao",
      token_id:          (repTokenRow as { id: string } | null)?.id ?? null,
      status:            "enviado",
      response_deadline: repDeadline.toISOString(),
    });

    // Vincular communication_id ao replacement (via token_id do token recém-criado)
    if (repTokenRow) {
      const { data: newComm } = await supabaseAdmin
        .from("clinic_communications")
        .select("id")
        .eq("token_id", (repTokenRow as { id: string }).id)
        .single();
      if (newComm) {
        await supabaseAdmin
          .from("clinic_replacements")
          .update({ communication_id: (newComm as { id: string }).id })
          .eq("id", data.replacementId);
      }
    }

    return { ok: true, sessionId: newSession.id };
  });
