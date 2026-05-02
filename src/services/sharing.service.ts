import { useServerFn } from "@tanstack/react-start";
import {
  createShare,
  listShares,
  revokeShare,
  renewShare,
  type ShareSummary,
} from "@/server/sharing.functions";

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

// Hooks for components
export function useCreateShare() {
  return useServerFn(createShare);
}
export function useListShares() {
  return useServerFn(listShares);
}
export function useRevokeShare() {
  return useServerFn(revokeShare);
}
export function useRenewShare() {
  return useServerFn(renewShare);
}
