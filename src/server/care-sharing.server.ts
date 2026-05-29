// Server-only helpers para Cuidado Compartilhado (C8).
// Nunca importar de código cliente.
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Token ───────────────────────────────────────────────────────────────────

/** Gera token seguro de 32 bytes (base64url, ~43 chars). */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface CareInviteRow {
  id: string;
  owner_id: string;
  child_id: string;
  invitee_email: string;
  invitee_alias: string;
  relation: string;
  role: "admin" | "viewer";
  token: string;
  status: "pending" | "accepted" | "approved" | "denied" | "revoked";
  accepted_by: string | null;
  accepted_at: string | null;
  approved_at: string | null;
  denied_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface CareAccessRow {
  id: string;
  owner_id: string;
  caregiver_id: string;
  child_id: string;
  invite_id: string;
  role: "admin" | "viewer";
  relation: string;
  alias: string;
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface CareInviteWithContext {
  invite: CareInviteRow;
  ownerName: string;
  childName: string;
  childBirthDate: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Carrega invite pelo token raw. Usado na landing pública (sem auth). */
export async function fetchInviteByToken(
  token: string,
): Promise<CareInviteWithContext | null> {
  const { data: invite } = await (supabaseAdmin as any)
    .from("care_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return null;

  // Dados do owner (profiles)
  const { data: ownerProfile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", (invite as CareInviteRow).owner_id)
    .maybeSingle();

  const ownerName: string =
    (ownerProfile as any)?.full_name ||
    ((ownerProfile as any)?.email ?? "").split("@")[0] ||
    "Um responsável";

  // Dados da criança
  const { data: child } = await supabaseAdmin
    .from("children")
    .select("name, birth_date")
    .eq("id", (invite as CareInviteRow).child_id)
    .maybeSingle();

  const childName: string = (child as any)?.name ?? "Criança";
  const childBirthDate: string = (child as any)?.birth_date ?? "";

  return {
    invite: invite as CareInviteRow,
    ownerName,
    childName,
    childBirthDate,
  };
}

// ─── createCareAccess ─────────────────────────────────────────────────────────

export async function createCareAccess(params: {
  inviteId: string;
  ownerId: string;
  caregiverId: string;
  childId: string;
  role: "admin" | "viewer";
  relation: string;
  alias: string;
}): Promise<void> {
  const { error } = await (supabaseAdmin as any).from("care_access").insert({
    owner_id: params.ownerId,
    caregiver_id: params.caregiverId,
    child_id: params.childId,
    invite_id: params.inviteId,
    role: params.role,
    relation: params.relation,
    alias: params.alias,
    status: "active",
    granted_at: new Date().toISOString(),
  });

  if (error) throw new Error(`createCareAccess: ${error.message}`);
}

// ─── Email helpers ────────────────────────────────────────────────────────────

const RESEND_FROM = "TEAmo <noreply@teamotech.online>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY not configured" };

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    clearTimeout(tid);
    if ((e as Error).name === "AbortError")
      return { ok: false, error: "Timeout ao enviar e-mail." };
    return { ok: false, error: (e as Error).message };
  }
}

/** E-mail enviado ao co-cuidador com o link do convite. */
export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  alias: string;
  childName: string;
  token: string;
  expiresAt: string;
}): Promise<{ ok: boolean; error?: string }> {
  const appUrl = process.env.VITE_APP_URL ?? "https://teamo.vercel.app";
  // Link vai diretamente para login com o token como search param.
  // O login mostra banner de contexto e redireciona para /convite/{token}/aceitar após auth.
  const link = `${appUrl}/login?invite=${encodeURIComponent(params.token)}`;
  const expiresFormatted = formatDateBR(params.expiresAt);

  const html = `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D9488;">TEAmo</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Cuidado coordenado para crianças com TEA</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Olá, <strong>${escapeHtml(params.alias)}</strong>!
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
        <strong>${escapeHtml(params.inviterName)}</strong> te convidou para fazer parte do cuidado de <strong>${escapeHtml(params.childName)}</strong> no TEAmo.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;">
        Com acesso ao TEAmo, você poderá acompanhar registros, agenda e mais — sempre com o consentimento do responsável principal.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Aceitar convite
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#6C757D;">
        ⏱ Este convite expira em <strong>${expiresFormatted}</strong>.
      </p>
      <p style="margin:0;font-size:13px;color:#6C757D;">
        Se você não esperava este e-mail, pode ignorá-lo com segurança.
      </p>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · cuidado compartilhado</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `${escapeHtml(params.inviterName)} te convidou para cuidar de ${escapeHtml(params.childName)} no TEAmo`,
    html,
  });
}

/** E-mail enviado ao owner quando co-cuidador aceita o convite (aguardando aprovação). */
export async function sendAcceptedNotificationEmail(params: {
  to: string;
  alias: string;
  childName: string;
  approveUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D9488;">TEAmo</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Notificação de cuidado compartilhado</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        <strong>${escapeHtml(params.alias)}</strong> aceitou seu convite para acompanhar <strong>${escapeHtml(params.childName)}</strong>!
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;">
        Revise os dados e aprove o acesso para que ${escapeHtml(params.alias)} possa entrar no app.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${params.approveUrl}" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Revisar e aprovar
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6C757D;">
        Se não quiser conceder acesso, ignore este e-mail ou negue dentro do app.
      </p>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · cuidado compartilhado</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `${escapeHtml(params.alias)} aceitou seu convite no TEAmo`,
    html,
  });
}

/** E-mail enviado ao co-cuidador quando o owner aprova o acesso. */
export async function sendApprovedEmail(params: {
  to: string;
  inviterName: string;
  childName: string;
  appUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D9488;">TEAmo</h1>
      <div style="background:#ECFDF5;border-radius:10px;padding:16px;margin:16px 0;text-align:center;">
        <span style="font-size:32px;">✅</span>
        <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#065F46;">Acesso aprovado!</p>
      </div>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;text-align:center;">
        <strong>${escapeHtml(params.inviterName)}</strong> aprovou seu acesso ao perfil de <strong>${escapeHtml(params.childName)}</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${params.appUrl}/dashboard" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Acessar o TEAmo
        </a>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · cuidado compartilhado</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `Acesso aprovado! Você já pode acompanhar ${escapeHtml(params.childName)} no TEAmo`,
    html,
  });
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function formatDateBR(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
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
