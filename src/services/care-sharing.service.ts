// Hooks React Query para Cuidado Compartilhado.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

import {
  sendCareInviteServer,
  cancelCareInviteServer,
  resendCareInviteServer,
  approveAccessServer,
  denyAccessServer,
  revokeAccessServer,
  listCareInvitesServer,
  acceptCareInviteServer,
  listMyCareAccessServer,
  getCareInviteForApprovalServer,
} from "@/lib/care-sharing.functions";
import type { CareInviteInput } from "@/lib/validation";

// ─── Auth header helper ───────────────────────────────────────────────────────

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const careKeys = {
  invites: (childId: string) => ["care-invites", childId] as const,
  myAccesses: () => ["my-care-access"] as const,
  approvalDetail: (inviteId: string) => ["care-invite-approval", inviteId] as const,
} as const;

// ─── Owner: listar co-cuidadores ──────────────────────────────────────────────

export function useCareInvites(childId: string) {
  const fn = useServerFn(listCareInvitesServer);
  return useQuery({
    queryKey: careKeys.invites(childId),
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ data: { childId }, headers: h } as any);
    },
    enabled: Boolean(childId),
    staleTime: 30_000,
  });
}

// ─── Owner: enviar convite ────────────────────────────────────────────────────

export function useSendCareInvite(childId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(sendCareInviteServer);
  return useMutation({
    mutationFn: async (input: CareInviteInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h } as any);
    },
    // Aguarda o refetch concluir antes de resolver a mutation → a lista já
    // reflete o novo convite quanto o sheet fecha.
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: careKeys.invites(childId), refetchType: "all" });
    },
  });
}

// ─── Owner: cancelar convite ──────────────────────────────────────────────────

export function useCancelCareInvite(childId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(cancelCareInviteServer);
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h } as any);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: careKeys.invites(childId), refetchType: "all" });
    },
  });
}

// ─── Owner: reenviar convite ──────────────────────────────────────────────────

export function useResendCareInvite(childId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(resendCareInviteServer);
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h } as any);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: careKeys.invites(childId), refetchType: "all" });
    },
  });
}

// ─── Owner: aprovar acesso ────────────────────────────────────────────────────

export function useApproveAccess(childId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(approveAccessServer);
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h } as any);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: careKeys.invites(childId) });
    },
  });
}

// ─── Owner: negar acesso ──────────────────────────────────────────────────────

export function useDenyAccess(childId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(denyAccessServer);
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h } as any);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: careKeys.invites(childId) });
    },
  });
}

// ─── Owner: revogar acesso ────────────────────────────────────────────────────

export function useRevokeAccess(childId: string) {
  const qc = useQueryClient();
  const fn = useServerFn(revokeAccessServer);
  return useMutation({
    mutationFn: async (accessId: string) => {
      const h = await authHeaders();
      return fn({ data: { accessId }, headers: h } as any);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: careKeys.invites(childId) });
    },
  });
}

// ─── Owner: detalhe de aprovação ─────────────────────────────────────────────

export function useCareInviteForApproval(inviteId: string) {
  const fn = useServerFn(getCareInviteForApprovalServer);
  return useQuery({
    queryKey: careKeys.approvalDetail(inviteId),
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h } as any);
    },
    enabled: Boolean(inviteId),
    staleTime: 0,
  });
}

// ─── Co-cuidador: aceitar convite ─────────────────────────────────────────────

export function useAcceptCareInvite() {
  const qc = useQueryClient();
  const fn = useServerFn(acceptCareInviteServer);
  return useMutation({
    mutationFn: async (token: string) => {
      const h = await authHeaders();
      return fn({ data: { token }, headers: h } as any);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: careKeys.myAccesses() });
    },
  });
}

// ─── Co-cuidador: listar acessos ─────────────────────────────────────────────

export function useMyCarAccesses() {
  const fn = useServerFn(listMyCareAccessServer);
  return useQuery({
    queryKey: careKeys.myAccesses(),
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ data: undefined, headers: h } as any);
    },
    staleTime: 60_000,
  });
}
