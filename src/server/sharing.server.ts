// Server-only helpers for sharing (C7). Never import from client code.
import { createHash, randomBytes, createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ShareItemType = "record" | "document_record" | "document_child";

export interface ShareRow {
  id: string;
  user_id: string;
  professional_id: string;
  token: string;
  otp_hash: string | null;
  otp_expires_at: string | null;
  otp_attempts: number;
  expires_at: string;
  revoked_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareItemRow {
  id: string;
  share_id: string;
  user_id: string;
  item_type: ShareItemType;
  item_id: string;
  created_at: string;
}

const TABLES = {
  shares: "shares",
  share_items: "share_items",
  audit_logs: "audit_logs",
  professionals: "professionals",
  attendance_records: "attendance_records",
  record_attachments: "record_attachments",
  child_attachments: "child_attachments",
  children: "children",
} as const;

// ---------- Tokens, OTP, JWT ----------

export function generateShareToken(): string {
  // 32 bytes -> 43-char base64url (>192 bits entropy)
  return randomBytes(32).toString("base64url");
}

// Store this in the DB, never the raw token. If the DB is leaked, raw tokens stay safe.
export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateOtp(): string {
  // 6 digits, leading zeros allowed
  const buf = randomBytes(4);
  const n = buf.readUInt32BE(0) % 1_000_000;
  return n.toString().padStart(6, "0");
}

function getOtpHmacSecret(): string {
  const s = process.env.OTP_HMAC_SECRET;
  if (!s) throw new Error("OTP_HMAC_SECRET is not configured");
  return s;
}

// HMAC-SHA256 with server secret — prevents rainbow table attacks on 6-digit OTPs.
// Plain SHA-256 is precomputable across all 1M values in milliseconds.
export function hashOtp(otp: string): string {
  return createHmac("sha256", getOtpHmacSecret()).update(otp).digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function getJwtSecret(): string {
  const s = process.env.SHARE_JWT_SECRET;
  if (!s) throw new Error("SHARE_JWT_SECRET is not configured");
  return s;
}

function b64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export interface ShareJwtPayload {
  share_id: string;
  exp: number; // seconds since epoch
}

export function signShareJwt(payload: ShareJwtPayload): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = b64url(createHmac("sha256", getJwtSecret()).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyShareJwt(token: string): ShareJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = b64url(
    createHmac("sha256", getJwtSecret()).update(`${header}.${body}`).digest(),
  );
  if (
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as ShareJwtPayload;
    if (typeof payload.share_id !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Audit ----------

export async function logShareEvent(
  userId: string | null,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    const safe = { ...metadata };
    delete (safe as Record<string, unknown>).otp;
    delete (safe as Record<string, unknown>).otp_hash;
    await (supabaseAdmin.from(TABLES.audit_logs) as any).insert({
      user_id: userId,
      event_type: eventType,
      metadata: safe,
    });
  } catch {
    /* silencioso */
  }
}

// ---------- Resend ----------

const RESEND_FROM = "TEAmo <noreply@teamotech.online>";

export async function sendOtpEmail(params: {
  to: string;
  otp: string;
  professionalName: string;
  parentName: string;
  expiresInMinutes: number;
  shareExpiresAt: string;
}): Promise<{ ok: boolean; error?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not configured" };

  const subject = `Seu código de acesso TEAmo: ${params.otp}`;
  const html = `
<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#4F46E5;">TEAmo</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#6C757D;">
          Olá ${escapeHtml(params.professionalName)},
        </p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.55;">
          ${escapeHtml(params.parentName)} compartilhou conteúdo com você no TEAmo.
          Para acessar, use o código abaixo na página que recebeu por mensagem:
        </p>
        <div style="text-align:center;margin:24px 0;">
          <div style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:8px;color:#212529;background:#F8F9FA;border:1px solid #DEE2E6;border-radius:10px;padding:14px 22px;">
            ${escapeHtml(params.otp)}
          </div>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6C757D;">
          • Código válido por <strong>${params.expiresInMinutes} minutos</strong>.
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#6C757D;">
          • Acesso ao conteúdo expira em <strong>${formatDateTimeBR(params.shareExpiresAt)}</strong>.
        </p>
        <p style="margin:24px 0 0;font-size:12px;color:#6C757D;">
          Se você não esperava este e-mail, pode ignorá-lo com segurança.
        </p>
      </div>
      <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">
        TEAmo · Cuidado coordenado para crianças com TEA
      </p>
    </div>
  </body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateTimeBR(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

// ---------- Share lifecycle helpers ----------

export type ShareStatus = "active" | "expired" | "revoked";

export function deriveStatus(share: ShareRow, now: Date = new Date()): ShareStatus {
  if (share.revoked_at) return "revoked";
  if (new Date(share.expires_at) <= now) return "expired";
  return "active";
}

export async function fetchShareByToken(rawToken: string): Promise<ShareRow | null> {
  const tokenHash = hashShareToken(rawToken);
  const { data } = await (supabaseAdmin.from(TABLES.shares) as any)
    .select("*")
    .eq("token", tokenHash)
    .maybeSingle();
  return (data as ShareRow | null) ?? null;
}

export async function fetchShareById(id: string): Promise<ShareRow | null> {
  const { data } = await (supabaseAdmin.from(TABLES.shares) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ShareRow | null) ?? null;
}

export async function fetchShareItems(shareId: string): Promise<ShareItemRow[]> {
  const { data } = await (supabaseAdmin.from(TABLES.share_items) as any)
    .select("*")
    .eq("share_id", shareId);
  return (data as ShareItemRow[] | null) ?? [];
}

export async function fetchProfessional(
  id: string,
): Promise<{ id: string; name: string; email: string; specialty: string } | null> {
  const { data } = await supabaseAdmin
    .from(TABLES.professionals)
    .select("id, name, email, specialty")
    .eq("id", id)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function fetchParentName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "Um responsável";
  return (data as any).full_name || ((data as any).email ?? "Um responsável").split("@")[0];
}

// Loads the actual content referenced by share items (records + documents) using admin client.
export interface SharedRecord {
  id: string;
  category: string;
  content: string;
  professional_name: string;
  record_date: string;
  child_name: string | null;
  attachments: SharedDocument[];
}

export interface SharedDocument {
  id: string;
  source: "child" | "record";
  
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  child_name: string | null;
  record_id?: string;
}

export async function loadSharedContent(items: ShareItemRow[]): Promise<{
  records: SharedRecord[];
  documents: SharedDocument[];
}> {
  const recordIds = items.filter((i) => i.item_type === "record").map((i) => i.item_id);
  const recDocIds = items
    .filter((i) => i.item_type === "document_record")
    .map((i) => i.item_id);
  const childDocIds = items
    .filter((i) => i.item_type === "document_child")
    .map((i) => i.item_id);

  const [recordsRes, recDocsRes, childDocsRes] = await Promise.all([
    recordIds.length
      ? supabaseAdmin
          .from(TABLES.attendance_records)
          .select("id, category, content, professional_name, record_date, child:children(id, name)")
          .in("id", recordIds)
      : Promise.resolve({ data: [], error: null } as any),
    recDocIds.length
      ? supabaseAdmin
          .from(TABLES.record_attachments)
          .select(
            "id, storage_path, file_name, mime_type, size_bytes, created_at, record_id, record:attendance_records(id, child:children(id, name))",
          )
          .in("id", recDocIds)
      : Promise.resolve({ data: [], error: null } as any),
    childDocIds.length
      ? supabaseAdmin
          .from(TABLES.child_attachments)
          .select(
            "id, storage_path, file_name, mime_type, size_bytes, created_at, child:children(id, name)",
          )
          .in("id", childDocIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  // Inline attachments for records (only the ones the parent included)
  const recordRows = ((recordsRes.data as any[]) ?? []).map((r) => ({
    id: r.id as string,
    category: r.category as string,
    content: r.content as string,
    professional_name: r.professional_name as string,
    record_date: r.record_date as string,
    child_name: (r.child?.name as string | null) ?? null,
    attachments: [] as SharedDocument[],
  }));

  const recDocRows = ((recDocsRes.data as any[]) ?? []).map((d) => ({
    id: d.id as string,
    source: "record" as const,
    file_name: d.file_name as string,
    mime_type: d.mime_type as string,
    size_bytes: Number(d.size_bytes),
    created_at: d.created_at as string,
    child_name: (d.record?.child?.name as string | null) ?? null,
    record_id: d.record_id as string,
  }));

  const childDocRows = ((childDocsRes.data as any[]) ?? []).map((d) => ({
    id: d.id as string,
    source: "child" as const,
    file_name: d.file_name as string,
    mime_type: d.mime_type as string,
    size_bytes: Number(d.size_bytes),
    created_at: d.created_at as string,
    child_name: (d.child?.name as string | null) ?? null,
  }));

  // Attach record-scoped docs that belong to a record we are also showing
  const recIndex = new Map(recordRows.map((r) => [r.id, r]));
  const standaloneRecDocs: SharedDocument[] = [];
  for (const d of recDocRows) {
    if (d.record_id && recIndex.has(d.record_id)) {
      recIndex.get(d.record_id)!.attachments.push(d);
    } else {
      standaloneRecDocs.push(d);
    }
  }

  return {
    records: recordRows,
    documents: [...standaloneRecDocs, ...childDocRows],
  };
}

export const SHARING_TABLES = TABLES;
