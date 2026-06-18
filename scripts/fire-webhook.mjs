// Dispara um evento de webhook AbacatePay assinado com HMAC real para a Edge Function.
// Não acessa o banco — apenas assina e faz POST. A verificação é feita via `supabase db query`.
//
// Uso: source .env && node scripts/fire-webhook.mjs <event> <userId> <scope>
//   event: subscription.completed | subscription.cancelled | subscription.trial_started
import { createHmac } from "node:crypto";

const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET;
const PROJECT_REF = "oguqnqdqqqzvfrdztykz";
const WEBHOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/abacatepay-webhook`;

const [event, userId, scope] = process.argv.slice(2);
if (!WEBHOOK_SECRET) { console.error("FALTA ABACATEPAY_WEBHOOK_SECRET no env"); process.exit(1); }
if (!event || !userId || !scope) { console.error("Uso: node fire-webhook.mjs <event> <userId> <scope>"); process.exit(1); }

const payload = {
  id: "log_test_" + Date.now(),
  event,
  apiVersion: 2,
  devMode: true,
  data: {
    subscription: { id: "subs_e2e_test", trialEndsAt: new Date(Date.now() + 7 * 864e5).toISOString() },
    customer: { id: "cust_e2e_test" },
    checkout: { externalId: `${userId}:${scope}` },
  },
};
const rawBody = JSON.stringify(payload);
const signature = createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("base64");

const resp = await fetch(WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Webhook-Signature": signature },
  body: rawBody,
});
console.log(`event=${event} → HTTP ${resp.status} :: ${await resp.text()}`);
if (resp.status !== 200) process.exit(1);
