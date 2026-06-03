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
  saveTherapistProfileQuestionsServer,
  createPatientWithGuardiansServer,
  saveSessionPlanServer,
  confirmSessionServer,
  saveSessionRecordServer,
  getSessionRecordServer,
} from "@/lib/therapist.functions";
import type {
  TherapistProfileInput,
  TherapistInviteInput,
  TherapistPatientInput,
  TherapistProfileQuestionsInput,
  TherapistPatientWithGuardiansInput,
  SessionPlanInput,
  SessionConfirmInput,
  SessionRecordInput,
} from "@/lib/validation";

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

// ════════════════════════════════════════════════════════════════════
// MÓDULO AGENDA — Onboarding + Sessões
// ════════════════════════════════════════════════════════════════════

// ─── 12. useSaveTherapistProfileQuestions ────────────────────────────────────

export function useSaveTherapistProfileQuestions() {
  const fn = useServerFn(saveTherapistProfileQuestionsServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapistProfileQuestionsInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.profile() }),
  });
}

// ─── 13. useCreatePatientWithGuardians ───────────────────────────────────────

export function useCreatePatientWithGuardians() {
  const fn = useServerFn(createPatientWithGuardiansServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TherapistPatientWithGuardiansInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: therapistKeys.patients() }),
  });
}

// ─── 14. useSaveSessionPlan ──────────────────────────────────────────────────

export function useSaveSessionPlan() {
  const fn = useServerFn(saveSessionPlanServer);
  return useMutation({
    mutationFn: async (input: SessionPlanInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
  });
}

// ─── 15. useConfirmSession ───────────────────────────────────────────────────

export function useConfirmSession() {
  const fn = useServerFn(confirmSessionServer);
  return useMutation({
    mutationFn: async (input: SessionConfirmInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
  });
}

// ─── 16. useSaveSessionRecord ────────────────────────────────────────────────

export function useSaveSessionRecord() {
  const fn = useServerFn(saveSessionRecordServer);
  return useMutation({
    mutationFn: async (input: SessionRecordInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
  });
}

// ─── 17. useGetSessionRecord ─────────────────────────────────────────────────

/** Dados retornados por getSessionRecordServer */
export interface UpcomingSession {
  id: string;
  start_at: string;
  title: string;
}

export interface SessionRecordQueryData {
  event:         Record<string, unknown>;
  sessionRecord: Record<string, unknown> | null;
  child:         { name: string; birth_date: string } | null;
  previousPoints: string | null;
  upcomingSessions: UpcomingSession[];
}

export function useGetSessionRecord(eventId: string | undefined) {
  const fn = useServerFn(getSessionRecordServer);
  return useQuery<SessionRecordQueryData>({
    queryKey: ["session-record", eventId],
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ data: { eventId: eventId! }, headers: h }) as Promise<SessionRecordQueryData>;
    },
    enabled: !!eventId,
    staleTime: 30_000,
  });
}
