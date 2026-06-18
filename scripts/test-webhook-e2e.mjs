// Teste E2E do webhook AbacatePay → ativação de Premium.
// Simula o evento subscription.completed assinado com o HMAC real e verifica
// se o plano do terapeuta de teste vira "premium" no banco.
//
// NÃO imprime credenciais — apenas resultados (status, plano antes/depois).
// Uso: source .env && source .env.test && node scripts/test-webhook-e2e.mjs [revert]
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;
const TEST_EMAIL = process.env.TEAMO_TEST_THERAPIST_EMAIL;
const PROJECT_REF = "oguqnqdqqqzvfrdztykz";
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/abacatepay-webhook`;
const REVERT = process.argv.includes("revert");

function need(name, val) {
  if (!val) { console.error(`FALTA env: ${name}`); process.exit(1); }
}
need("SUPABASE_URL", SUPABASE_URL);
need("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);
need("ABACATEPAY_WEBHOOK_SECRET", WEBHOOK_SECRET);
need("TEAMO_TEST_THERAPIST_EMAIL", TEST_EMAIL);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// 1. Achar o user de teste pelo e-mail (sem imprimir o e-mail)
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listErr) { console.error("Erro listUsers:", listErr.message); process.exit(1); }
const user = list.users.find((u) => u.email === TEST_EMAIL);
if (!user) { console.error("Usuário de teste não encontrado."); process.exit(1); }
const userId = user.id;
console.log("✓ Usuário de teste encontrado (id ofuscado):", userId.slice(0, 8) + "…");

// 2. Plano atual
const { data: before } = await admin.from("profiles").select("therapist_plan").eq("id", userId).maybeSingle();
console.log("Plano ANTES:", before?.therapist_plan ?? "(null)");

if (REVERT) {
  await admin.from("profiles").update({ therapist_plan: "free" }).eq("id", userId);
  await admin.from("subscriptions").update({ status: "canceled", plan: "free" }).eq("user_id", userId).eq("scope", "therapist");
  console.log("↩ Revertido para free.");
  process.exit(0);
}

// 3. Montar payload do webhook (subscription.completed)
const payload = {
  id: "log_test_" + Date.now(),
  event: "subscription.completed",
  apiVersion: 2,
  devMode: true,
  data: {
    subscription: { id: "subs_test_e2e" },
    customer: { id: "cust_test_e2e" },
    checkout: { externalId: `${userId}:therapist` },
  },
};
const rawBody = JSON.stringify(payload);

// 4. Assinar com HMAC-SHA256 → base64 (igual ao verifySignature do edge)
const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("base64");

// 5. POST para a Edge Function
const resp = await fetch(WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
  body: rawBody,
});
console.log(`Webhook HTTP ${resp.status} → ${await resp.text()}`);

// 6. Verificar resultado
await new Promise((r) => setTimeout(r, 1200));
const { data: after } = await admin.from("profiles").select("therapist_plan").eq("id", userId).maybeSingle();
const { data: sub } = await admin.from("subscriptions").select("status, plan, provider, provider_subscription_id").eq("user_id", userId).eq("scope", "therapist").maybeSingle();
console.log("Plano DEPOIS:", after?.therapist_plan ?? "(null)");
console.log("Subscription:", JSON.stringify(sub));

if (after?.therapist_plan === "premium") {
  console.log("\n✅ SUCESSO: webhook ativou o Premium corretamente.");
} else {
  console.log("\n❌ FALHA: plano não virou premium. Ver logs do webhook.");
  process.exit(1);
}
