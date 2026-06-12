// Server-only helpers para o fluxo Pai → Profissional.
// Nunca importar de código cliente.
import { randomBytes, createHash } from "crypto";
import { appBaseUrl } from "@/server/app-url";

// ─── Token ───────────────────────────────────────────────────────────────────

/** Gera token seguro de 32 bytes (base64url, ~43 chars). */
export function generateParentProfessionalInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 do raw token — armazenado no banco; o raw token vai apenas no e-mail. */
export function hashParentProfessionalInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ParentProfessionalInviteRow {
  id: string;
  parent_id: string;
  child_id: string;
  invitee_email: string;
  invitee_name: string | null;
  token_hash: string;
  status: "pending" | "accepted" | "revoked";
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ParentProfessionalAccessRow {
  id: string;
  parent_id: string;
  professional_id: string;
  child_id: string;
  invite_id: string | null;
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
}

// ─── Email ────────────────────────────────────────────────────────────────────

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

/**
 * E-mail enviado ao profissional com o link de convite para criar conta no TEAmo.
 * Inclui link OTP para acesso imediato (se houver share ativo) e link de cadastro.
 */
export async function sendParentProfessionalInviteEmail(params: {
  to: string;
  professionalName: string;
  parentName: string;
  childName: string;
  token: string;
  otpShareLink?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const inviteLink = `${appBaseUrl()}/convite-profissional/${encodeURIComponent(params.token)}`;
  const profName = params.professionalName || "Profissional";

  const otpSection = params.otpShareLink
    ? `
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:14px 16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#166534;">Acesso imediato (sem conta)</p>
        <p style="margin:0 0 10px;font-size:13px;color:#374151;">Você também pode ver o conteúdo agora pelo link de compartilhamento:</p>
        <div style="text-align:center;">
          <a href="${params.otpShareLink}" style="display:inline-block;background:#fff;border:1.5px solid #16A34A;color:#16A34A;font-size:13px;font-weight:600;text-decoration:none;border-radius:10px;padding:10px 22px;">
            Ver conteúdo agora
          </a>
        </div>
      </div>`
    : "";

  const html = `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D9488;">TEAmo</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Acompanhamento terapêutico para crianças com TEA</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Olá, <strong>${escapeHtml(profName)}</strong>!
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
        <strong>${escapeHtml(params.parentName)}</strong> te convidou para acompanhar o desenvolvimento de <strong>${escapeHtml(params.childName)}</strong> pelo TEAmo.
      </p>
      <p style="margin:0 0 16px;font-size:14px;color:#374151;">
        Com uma conta gratuita no TEAmo você poderá ver os registros e documentos compartilhados pela família e trocar recados sobre o desenvolvimento de <strong>${escapeHtml(params.childName)}</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${inviteLink}" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Criar conta gratuita no TEAmo
        </a>
      </div>
      ${otpSection}
      <p style="margin:16px 0 0;font-size:13px;color:#6C757D;">
        Se você não esperava este e-mail, pode ignorá-lo com segurança.
      </p>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · acompanhamento terapêutico</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `${escapeHtml(params.parentName)} te convidou para acompanhar ${escapeHtml(params.childName)} no TEAmo`,
    html,
  });
}

/** E-mail enviado ao pai quando o profissional aceita o convite. */
export async function sendParentInviteAcceptedEmail(params: {
  to: string;
  professionalName: string;
  childName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const html = `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D9488;">TEAmo</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Notificação de acompanhamento</p>
      <div style="background:#ECFDF5;border-radius:10px;padding:16px;margin:16px 0;text-align:center;">
        <span style="font-size:32px;">✅</span>
        <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#065F46;">Convite aceito!</p>
      </div>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;text-align:center;">
        <strong>${escapeHtml(params.professionalName)}</strong> aceitou seu convite e agora acompanha o desenvolvimento de <strong>${escapeHtml(params.childName)}</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appBaseUrl()}/compartilhamentos" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Ver profissionais vinculados
        </a>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · acompanhamento terapêutico</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `${escapeHtml(params.professionalName)} aceitou seu convite para acompanhar ${escapeHtml(params.childName)} no TEAmo`,
    html,
  });
}
