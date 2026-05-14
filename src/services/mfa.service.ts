import { supabase } from "@/integrations/supabase/client";

export interface MfaFactor {
  id: string;
  friendly_name?: string | null;
  factor_type: "totp" | "phone";
  status: "verified" | "unverified";
  created_at: string;
}

export interface MfaEnrollResponse {
  factorId: string;
  qrCode: string;   // SVG data URI
  secret: string;   // base32, mostrado uma única vez
  uri: string;      // otpauth://
}

export async function listFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  const all = [...(data?.totp ?? []), ...(data?.phone ?? [])] as MfaFactor[];
  return all;
}

export async function enrollTotp(friendlyName?: string): Promise<MfaEnrollResponse> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: friendlyName ?? `TEAmo · ${new Date().toLocaleDateString("pt-BR")}`,
  });
  if (error) throw new Error(error.message);
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function challengeAndVerify(factorId: string, code: string): Promise<void> {
  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) throw new Error(challenge.error.message);
  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) throw new Error(verify.error.message);
}

export async function unenroll(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error(error.message);
}

export async function getAal(): Promise<{
  current: "aal1" | "aal2";
  next: "aal1" | "aal2";
}> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(error.message);
  return {
    current: (data?.currentLevel as "aal1" | "aal2") ?? "aal1",
    next: (data?.nextLevel as "aal1" | "aal2") ?? "aal1",
  };
}
