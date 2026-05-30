// Server-only helpers para o módulo de Terapeutas (Phase 1).
// Nunca importar de código cliente.
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { appBaseUrl } from "@/server/app-url";

// ─── Token ───────────────────────────────────────────────────────────────────

/** Gera token seguro de 32 bytes (base64url, ~43 chars). */
export function generateTherapistInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface TherapistInviteRow {
  id: string;
  therapist_id: string;
  child_id: string;
  invitee_email: string;
  invitee_alias: string;
  relation: string;
  token: string;
  status: "pending" | "accepted" | "revoked";
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface TherapistParentAccessRow {
  id: string;
  therapist_id: string;
  parent_id: string;
  child_id: string;
  invite_id: string;
  relation: string;
  alias: string;
  status: "active" | "revoked";
  granted_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface TherapistInviteWithContext {
  invite: TherapistInviteRow;
  therapistName: string;
  therapistSpecialty: string;
  childName: string;
  childBirthDate: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/** Carrega invite pelo token (sem auth — usa supabaseAdmin). */
export async function fetchTherapistInviteByToken(
  token: string,
): Promise<TherapistInviteWithContext | null> {
  const { data: invite } = await (supabaseAdmin as any)
    .from("therapist_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return null;

  // Perfil do terapeuta
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", (invite as TherapistInviteRow).therapist_id)
    .maybeSingle();

  const therapistName: string =
    (profile as any)?.full_name ||
    ((profile as any)?.email ?? "").split("@")[0] ||
    "Um terapeuta";

  // Especialidade do terapeuta
  const { data: tProfile } = await (supabaseAdmin as any)
    .from("therapist_profiles")
    .select("specialty")
    .eq("user_id", (invite as TherapistInviteRow).therapist_id)
    .maybeSingle();

  const therapistSpecialty: string = (tProfile as any)?.specialty ?? "";

  // Dados da criança
  const { data: child } = await supabaseAdmin
    .from("children")
    .select("name, birth_date")
    .eq("id", (invite as TherapistInviteRow).child_id)
    .maybeSingle();

  const childName: string = (child as any)?.name ?? "Paciente";
  const childBirthDate: string = (child as any)?.birth_date ?? "";

  return {
    invite: invite as TherapistInviteRow,
    therapistName,
    therapistSpecialty,
    childName,
    childBirthDate,
  };
}

// ─── createTherapistParentAccess ──────────────────────────────────────────────

export async function createTherapistParentAccess(params: {
  inviteId: string;
  therapistId: string;
  parentId: string;
  childId: string;
  relation: string;
  alias: string;
}): Promise<void> {
  const { error } = await (supabaseAdmin as any).from("therapist_parent_access").upsert(
    {
      therapist_id: params.therapistId,
      parent_id: params.parentId,
      child_id: params.childId,
      invite_id: params.inviteId,
      relation: params.relation,
      alias: params.alias,
      status: "active",
      granted_at: new Date().toISOString(),
    },
    { onConflict: "therapist_id,parent_id,child_id" },
  );
  if (error) throw new Error(`createTherapistParentAccess: ${error.message}`);
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

/** E-mail enviado ao responsável com o link do convite do terapeuta. */
export async function sendTherapistInviteEmail(params: {
  to: string;
  therapistName: string;
  therapistSpecialty: string;
  alias: string;
  childName: string;
  token: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Link vai direto para login com o token como search param
  const link = `${appBaseUrl()}/login?therapistInvite=${encodeURIComponent(params.token)}`;

  const specialtyLabel = params.therapistSpecialty
    ? `<span style="color:#0D9488;font-weight:600">${escapeHtml(params.therapistSpecialty)}</span>`
    : "um profissional";

  const html = `
<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#212529;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#fff;border:1px solid #DEE2E6;border-radius:14px;padding:28px;">
      <h1 style="margin:0 0 4px;font-size:22px;font-weight:800;color:#0D9488;">TEAmo</h1>
      <p style="margin:0 0 20px;font-size:13px;color:#6C757D;">Acompanhamento terapêutico para crianças com TEA</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Olá, <strong>${escapeHtml(params.alias)}</strong>!
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
        <strong>${escapeHtml(params.therapistName)}</strong>, ${specialtyLabel}, te convidou para acompanhar a evolução de <strong>${escapeHtml(params.childName)}</strong> pelo TEAmo.
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;">
        Com acesso ao TEAmo, você poderá ver registros de sessão, evolução e agenda — sempre com controle do profissional responsável.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Ver convite e criar conta
        </a>
      </div>
      <p style="margin:0;font-size:13px;color:#6C757D;">
        Se você não esperava este e-mail, pode ignorá-lo com segurança.
      </p>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · acompanhamento terapêutico</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `${escapeHtml(params.therapistName)} te convidou para acompanhar ${escapeHtml(params.childName)} no TEAmo`,
    html,
  });
}

/** E-mail enviado ao terapeuta quando o responsável aceita o convite. */
export async function sendTherapistInviteAcceptedEmail(params: {
  to: string;
  parentAlias: string;
  childName: string;
  appUrl: string;
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
        <strong>${escapeHtml(params.parentAlias)}</strong> aceitou seu convite e agora pode acompanhar a evolução de <strong>${escapeHtml(params.childName)}</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${params.appUrl}/dashboard" style="display:inline-block;background:#0D9488;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;padding:14px 32px;">
          Acessar o TEAmo
        </a>
      </div>
    </div>
    <p style="margin:18px 0 0;text-align:center;font-size:11px;color:#ADB5BD;">TEAmo · acompanhamento terapêutico</p>
  </div>
</body></html>`;

  return sendEmail({
    to: params.to,
    subject: `${escapeHtml(params.parentAlias)} aceitou seu convite para acompanhar ${escapeHtml(params.childName)} no TEAmo`,
    html,
  });
}
