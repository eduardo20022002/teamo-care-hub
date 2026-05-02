// Public-facing service for the shared content view.
// These endpoints are unauthenticated (the caller is the recipient professional).

export interface RequestOtpResponse {
  ok: boolean;
  professionalEmailMasked?: string;
  ttlMinutes?: number;
  error?: string;
  detail?: string;
}

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
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  child_name: string | null;
  record_id?: string;
}

export interface ValidateOtpResponse {
  ok: boolean;
  accessToken?: string;
  accessTtlMinutes?: number;
  shareExpiresAt?: string;
  professional?: { name: string; specialty: string } | null;
  content?: { records: SharedRecord[]; documents: SharedDocument[] };
  error?: string;
  attemptsRemaining?: number;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  // Always return the parsed body — caller inspects ok/error
  (json as any)._status = res.status;
  return json;
}

export function requestShareOtp(token: string): Promise<RequestOtpResponse> {
  return postJson<RequestOtpResponse>("/api/public/share/request-otp", { token });
}

export function validateShareOtp(
  token: string,
  otp: string,
): Promise<ValidateOtpResponse> {
  return postJson<ValidateOtpResponse>("/api/public/share/validate-otp", { token, otp });
}

export async function getSharedDocumentUrl(
  accessToken: string,
  source: "record" | "child",
  documentId: string,
): Promise<string | null> {
  const res = await postJson<{ url?: string; error?: string }>(
    "/api/public/share/document-url",
    { accessToken, source, documentId },
  );
  return res.url ?? null;
}
