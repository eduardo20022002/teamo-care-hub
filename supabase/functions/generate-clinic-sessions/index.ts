// Edge Function · generate-clinic-sessions
//
// Gera instâncias em clinic_sessions a partir de um clinic_recurring_schedule.
// Idempotente: usa INSERT ... ON CONFLICT DO NOTHING (UNIQUE constraint).
//
// Body (POST):
//   { schedule_id: string, weeks_ahead: number }
//
// Deploy:
//   supabase functions deploy generate-clinic-sessions --project-ref oguqnqdqqqzvfrdztykz

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: { schedule_id: string; weeks_ahead?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { schedule_id, weeks_ahead = 8 } = body;
  if (!schedule_id) {
    return new Response(JSON.stringify({ ok: false, error: "schedule_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: schedule, error: schedErr } = await supabase
    .from("clinic_recurring_schedules")
    .select("*")
    .eq("id", schedule_id)
    .single();

  if (schedErr || !schedule) {
    return new Response(
      JSON.stringify({ ok: false, error: schedErr?.message ?? "Schedule not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!schedule.active) {
    return new Response(
      JSON.stringify({ ok: false, error: "Schedule is inactive" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const generationEnd = addDays(today, weeks_ahead * 7);
  const startsOn = new Date(schedule.starts_on);
  const endsOn = schedule.ends_on ? new Date(schedule.ends_on) : null;

  const effectiveStart = startsOn > today ? startsOn : today;
  const effectiveEnd = endsOn && endsOn < generationEnd ? endsOn : generationEnd;

  const sessions: Array<{
    clinic_id: string;
    recurring_schedule_id: string;
    therapist_user_id: string;
    room_id: string;
    patient_name: string;
    session_date: string;
    start_time: string;
    duration_minutes: number;
    session_type: string;
    status: string;
  }> = [];

  let cursor = new Date(effectiveStart);
  while (cursor <= effectiveEnd) {
    if (cursor.getDay() === schedule.day_of_week) {
      sessions.push({
        clinic_id: schedule.clinic_id,
        recurring_schedule_id: schedule.id,
        therapist_user_id: schedule.therapist_user_id,
        room_id: schedule.room_id,
        patient_name: schedule.patient_name,
        session_date: toISODate(cursor),
        start_time: schedule.start_time,
        duration_minutes: schedule.duration_minutes,
        session_type: schedule.session_type,
        status: "agendada",
      });
    }
    cursor = addDays(cursor, 1);
  }

  if (sessions.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, count: 0, message: "No sessions to generate in range" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Idempotente: ON CONFLICT DO NOTHING via upsert with ignoreDuplicates
  const { error: insertErr, count } = await supabase
    .from("clinic_sessions")
    .upsert(sessions, {
      onConflict: "clinic_id,therapist_user_id,session_date,start_time",
      ignoreDuplicates: true,
      count: "exact",
    });

  if (insertErr) {
    return new Response(
      JSON.stringify({ ok: false, error: insertErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, count: count ?? sessions.length }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
