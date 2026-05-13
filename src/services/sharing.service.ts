import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createShare,
  listShares,
  revokeShare,
  renewShare,
  type ShareSummary,
} from "@/lib/sharing.functions";
import { supabase } from "@/integrations/supabase/client";

export type { ShareSummary };

export type ShareStatus = "active" | "expired" | "revoked";

export function deriveShareStatus(share: ShareSummary, now: Date = new Date()): ShareStatus {
  if (share.revoked_at) return "revoked";
  if (new Date(share.expires_at) <= now) return "expired";
  return "active";
}

export function buildPublicShareUrl(token: string): string {
  if (typeof window === "undefined") return `/compartilhamento/${token}`;
  return `${window.location.origin}/compartilhamento/${token}`;
}

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Hooks for components — auto-inject Supabase access token as Authorization header
export function useCreateShare() {
  const fn = useServerFn(createShare);
  return useCallback(
    async (opts: Parameters<typeof fn>[0]) =>
      fn({ ...(opts as any), headers: { ...(await authHeaders()), ...((opts as any)?.headers ?? {}) } }),
    [fn],
  );
}
export function useListShares() {
  const fn = useServerFn(listShares);
  return useCallback(
    async (opts?: Parameters<typeof fn>[0]) =>
      fn({ ...(opts as any), headers: { ...(await authHeaders()), ...((opts as any)?.headers ?? {}) } } as any),
    [fn],
  );
}
export function useRevokeShare() {
  const fn = useServerFn(revokeShare);
  return useCallback(
    async (opts: Parameters<typeof fn>[0]) =>
      fn({ ...(opts as any), headers: { ...(await authHeaders()), ...((opts as any)?.headers ?? {}) } }),
    [fn],
  );
}
export function useRenewShare() {
  const fn = useServerFn(renewShare);
  return useCallback(
    async (opts: Parameters<typeof fn>[0]) =>
      fn({ ...(opts as any), headers: { ...(await authHeaders()), ...((opts as any)?.headers ?? {}) } }),
    [fn],
  );
}
