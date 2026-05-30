// Hooks React Query para o módulo de Terapeutas.
// Wrappam os ServerFns de therapist.functions.ts.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  upsertTherapistProfileServer,
  getTherapistProfileServer,
  createPatientServer,
  listPatientsServer,
  sendTherapistInviteServer,
  cancelTherapistInviteServer,
  resendTherapistInviteServer,
  acceptTherapistInviteServer,
  listTherapistInvitesServer,
  listMyTherapistAccessServer,
  revokeTherapistParentAccessServer,
} from "@/lib/therapist.functions";
import type { TherapistProfileInput, TherapistInviteInput, TherapistPatientInput } from "@/lib/validation";

// ─── Query key factory ────────────────────────────────────────────────────────

export const therapistKeys = {
  profile:      ()             => ["therapist-profile"] as const,
  patients:     ()             => ["therapist-patients"] as const,
  invites:      (childId: string) => ["therapist-invites", childId] as const,
  myAccesses:   ()             => ["my-therapist-accesses"] as const,
};

// ─── Auth headers helper ──────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── 1. useTherapistProfile ────────────────────────────────────────────────────

export function useTherapistProfile() {
  const fn = useServerFn(getTherapistProfileServer);
  return useQuery({
    queryKey: therapistKeys.profile(),
    queryFn:  async () => {
      const h = await authHeaders();
      return fn({ headers: h });
    },
    staleTime: 60_000,
  });
}

// ─── 2. useUpsertTherapistProfile ─────────────────────────────────────────────

export function useUpsertTherapistProfile() {
  const fn = useServerFn(upsertTherapistProfileServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapistProfileInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.profile() }),
  });
}

// ─── 3. usePatients ───────────────────────────────────────────────────────────

export function usePatients() {
  const fn = useServerFn(listPatientsServer);
  return useQuery({
    queryKey: therapistKeys.patients(),
    queryFn:  async () => {
      const h = await authHeaders();
      return fn({ headers: h });
    },
    staleTime: 30_000,
  });
}

// ─── 4. useCreatePatient ──────────────────────────────────────────────────────

export function useCreatePatient() {
  const fn = useServerFn(createPatientServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapistPatientInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.patients() }),
  });
}

// ─── 5. useTherapistInvites ───────────────────────────────────────────────────

export function useTherapistInvites(childId: string) {
  const fn = useServerFn(listTherapistInvitesServer);
  return useQuery({
    queryKey: therapistKeys.invites(childId),
    queryFn:  async () => {
      const h = await authHeaders();
      return fn({ data: { childId }, headers: h });
    },
    enabled:  !!childId,
    staleTime: 30_000,
  });
}

// ─── 6. useSendTherapistInvite ────────────────────────────────────────────────

export function useSendTherapistInvite(childId: string) {
  const fn = useServerFn(sendTherapistInviteServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapistInviteInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.invites(childId) }),
  });
}

// ─── 7. useCancelTherapistInvite ──────────────────────────────────────────────

export function useCancelTherapistInvite(childId: string) {
  const fn = useServerFn(cancelTherapistInviteServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.invites(childId) }),
  });
}

// ─── 8. useResendTherapistInvite ──────────────────────────────────────────────

export function useResendTherapistInvite(childId: string) {
  const fn = useServerFn(resendTherapistInviteServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const h = await authHeaders();
      return fn({ data: { inviteId }, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.invites(childId) }),
  });
}

// ─── 9. useAcceptTherapistInvite — usado pelo responsável ─────────────────────

export function useAcceptTherapistInvite() {
  const fn = useServerFn(acceptTherapistInviteServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const h = await authHeaders();
      return fn({ data: { token }, headers: h });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: therapistKeys.myAccesses() });
    },
  });
}

// ─── 10. useMyTherapistAccesses — usado pelo responsável ─────────────────────

export function useMyTherapistAccesses() {
  const fn = useServerFn(listMyTherapistAccessServer);
  return useQuery({
    queryKey: therapistKeys.myAccesses(),
    queryFn:  async () => {
      const h = await authHeaders();
      return fn({ headers: h });
    },
    staleTime: 30_000,
  });
}

// ─── 11. useRevokeTherapistParentAccess ──────────────────────────────────────

export function useRevokeTherapistParentAccess(childId?: string) {
  const fn = useServerFn(revokeTherapistParentAccessServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accessId: string) => {
      const h = await authHeaders();
      return fn({ data: { accessId }, headers: h });
    },
    onSuccess: () => {
      if (childId) qc.invalidateQueries({ queryKey: therapistKeys.invites(childId) });
    },
  });
}
