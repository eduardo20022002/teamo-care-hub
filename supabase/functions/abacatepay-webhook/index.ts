// Edge Function · abacatepay-webhook
//
// Recebe eventos de assinatura do AbacatePay e espelha o status na tabela
// `subscriptions` + campo de plano em `profiles`/`clinics`.
//
// Segurança: HMAC-SHA256 com o secret configurado por webhook no painel AbacatePay
//   (header X-Webhook-Signature, valor em base64).
//
// Deploy:
//   supabase functions deploy abacatepay-webhook --project-ref oguqnqdqqqzvfrdztykz
//
// Secrets necessários (supabase secrets set --project-ref oguqnqdqqqzvfrdztykz):
//   ABACATEPAY_WEBHOOK_SECRET, SUPABASE_URL (auto), SUPABASE_SERVICE_ROLE_KEY (auto)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

async function verifySignature(rawBody: string, sig: string): Promise<boolean> {
  try {
    const secret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET");
    if (!secret) {
      console.error("abacatepay-webhook: ABACATEPAY_WEBHOOK_SECRET não configurado");
      return false;
    }
    const enc = new TextEncoder();
    const keyBytes = enc.encode(secret);
    const msgBytes = enc.encode(rawBody);

    const verifyKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify("HMAC", verifyKey, sigBytes, msgBytes);
  } catch {
    return false;
  }
}

async function upsertSubscription(
  admin: ReturnType<typeof createClient>,
  params: {
    userId: string;
    scope: string;
    plan?: string;
    status: string;
    trialEndsAt?: string | null;
    providerSubId?: string;
    providerCustomerId?: string;
  },
) {
  const row: Record<string, unknown> = {
    user_id: params.userId,
    scope: params.scope,
    status: params.status,
    provider: "abacatepay",
    updated_at: new Date().toISOString(),
  };
  if (params.plan !== undefined) row.plan = params.plan;
  if (params.trialEndsAt !== undefined) row.trial_ends_at = params.trialEndsAt;
  if (params.providerSubId) row.provider_subscription_id = params.providerSubId;
  if (params.providerCustomerId) row.provider_customer_id = params.providerCustomerId;

  await (admin as any)
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id,scope" });
}

async function mirrorPlan(
  admin: ReturnType<typeof createClient>,
  userId: string,
  scope: string,
  plan: "free" | "premium",
) {
  if (scope === "therapist") {
    await (admin as any)
      .from("profiles")
      .update({ therapist_plan: plan })
      .eq("id", userId);
  } else if (scope === "parent") {
    await (admin as any)
      .from("profiles")
      .update({ parent_plan: plan })
      .eq("id", userId);
  } else if (scope === "clinic") {
    // userId aqui é o owner da clínica (externalId = "<ownerId>:clinic")
    await (admin as any)
      .from("clinics")
      .update({ clinic_plan: plan })
      .eq("owner_id", userId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("X-Webhook-Signature") ?? "";

  const valid = await verifySignature(rawBody, sig);
  if (!valid) {
    console.error("abacatepay-webhook: assinatura inválida");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event, data } = payload ?? {};
  if (!event || !data) {
    return new Response("Missing event or data", { status: 400 });
  }

  const providerSubId: string = data.subscription?.id ?? "";
  const providerCustomerId: string = data.customer?.id ?? "";
  const externalId: string = data.checkout?.externalId ?? data.subscription?.externalId ?? "";
  const [userId, scope] = externalId.split(":");

  if (!userId || !scope) {
    console.error("abacatepay-webhook: externalId inválido:", externalId);
    return new Response("Invalid externalId", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  console.log(`abacatepay-webhook: event=${event} userId=${userId} scope=${scope}`);

  switch (event) {
    case "subscription.trial_started":
      await upsertSubscription(admin, {
        userId,
        scope,
        plan: "free",
        status: "trialing",
        trialEndsAt: data.subscription?.trialEndsAt ?? null,
        providerSubId,
        providerCustomerId,
      });
      break;

    case "subscription.completed":
      await upsertSubscription(admin, {
        userId,
        scope,
        plan: "premium",
        status: "active",
        providerSubId,
        providerCustomerId,
      });
      await mirrorPlan(admin, userId, scope, "premium");
      break;

    case "subscription.renewed":
      await upsertSubscription(admin, {
        userId,
        scope,
        plan: "premium",
        status: "active",
        providerSubId,
        providerCustomerId,
      });
      break;

    case "subscription.cancelled":
      await upsertSubscription(admin, {
        userId,
        scope,
        status: "canceled",
        providerSubId,
        providerCustomerId,
      });
      await mirrorPlan(admin, userId, scope, "free");
      break;

    default:
      console.log(`abacatepay-webhook: evento ignorado: ${event}`);
  }

  return new Response("ok", { status: 200 });
});
