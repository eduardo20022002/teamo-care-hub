// Edge Function · agenda-scheduler
//
// Invoca public.schedule_agenda_notifications() para materializar as
// notificações da Agenda nas próximas 36h.
//
// Deploy:
//   supabase functions deploy agenda-scheduler --project-ref oguqnqdqqqzvfrdztykz
//
// Trigger externo (opcional, caso pg_cron não esteja habilitado):
//   curl -X POST \
//     -H "Authorization: Bearer SERVICE_ROLE_KEY" \
//     https://oguqnqdqqqzvfrdztykz.supabase.co/functions/v1/agenda-scheduler
//
// Vercel Cron (vercel.json):
//   { "crons": [{ "path": "/api/agenda-scheduler", "schedule": "*/5 * * * *" }] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error } = await supabase.rpc("schedule_agenda_notifications");
  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ ok: true, ranAt: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
