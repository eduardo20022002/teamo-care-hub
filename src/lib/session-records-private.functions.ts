// A-01: ServerFn para campos privados de session_records.
// approach_adjustment e professional_observations foram REVOKEd de authenticated
// (migration 20260607200000). Apenas terapeutas donos do registro podem lê-los,
// via supabaseAdmin com verificação explícita de therapist_id = userId.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getSessionRecordPrivateServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as any;

    const { data: rec } = await (supabaseAdmin.from("session_records") as any)
      .select("id, therapist_id, approach_adjustment, professional_observations")
      .eq("event_id", data.eventId)
      .eq("therapist_id", userId)
      .maybeSingle();

    if (!rec) return { ok: false as const };

    return {
      ok: true as const,
      approachAdjustment: (rec as any).approach_adjustment as string | null,
      professionalObservations: (rec as any).professional_observations as unknown[],
    };
  });
