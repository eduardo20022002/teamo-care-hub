// Hooks React Query para o módulo de Evolução — Marcos de Desenvolvimento.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listMilestonesServer,
  getMilestoneServer,
  createMilestoneServer,
  updateMilestoneServer,
  achieveMilestoneServer,
  pauseResumeMilestoneServer,
  listAllGoalsForChildServer,
  getMilestoneGoalCountsServer,
  listMilestoneGoalsServer,
  createMilestoneGoalServer,
  updateMilestoneGoalServer,
  achieveMilestoneGoalServer,
  deleteMilestoneGoalServer,
  getMilestoneGoalProgressServer,
  getMilestoneProgressServer,
} from "@/lib/milestones.functions";
import type { MilestoneInput, MilestoneGoalInput } from "@/lib/validation";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  therapist_id: string;
  child_id: string;
  title: string;
  description: string | null;
  area: string;
  status: "em_progresso" | "atingido" | "pausado";
  is_shared_with_parents: boolean;
  started_at: string;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Tipos — Metas ────────────────────────────────────────────────────────────

export interface GoalPickerItem {
  goalId: string;
  goalTitle: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneArea: string;
  milestoneStatus: string;
}

export interface MilestoneGoal {
  id: string;
  milestone_id: string;
  child_id: string;
  therapist_id: string;
  title: string;
  description: string | null;
  status: "em_progresso" | "atingido";
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalAttempt {
  sessionId: string;
  sessionDate: string;
  sessionTitle: string;
  status: "achieved" | "partial" | "not_achieved";
  notes: string | null;
}

export interface MilestoneProgressEntry {
  sessionId: string;
  sessionDate: string;
  sessionTitle: string;
  goalId: string;
  goalTitle: string;
  status: "achieved" | "partial" | "not_achieved";
  notes: string | null;
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const milestoneKeys = {
  list:   (childId: string)      => ["milestones", childId] as const,
  detail: (milestoneId: string)  => ["milestone", milestoneId] as const,
};

export const milestoneGoalKeys = {
  allForChild:      (childId: string)     => ["all-goals-for-child", childId] as const,
  counts:           (childId: string)     => ["milestone-goal-counts", childId] as const,
  list:             (milestoneId: string) => ["milestone-goals", milestoneId] as const,
  progress:         (goalId: string)      => ["goal-progress", goalId] as const,
  milestoneProgress:(milestoneId: string) => ["milestone-progress", milestoneId] as const,
};

// ─── Auth headers helper ──────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── 1. useMilestones ─────────────────────────────────────────────────────────

export function useMilestones(childId: string) {
  const fn = useServerFn(listMilestonesServer);
  return useQuery({
    queryKey: milestoneKeys.list(childId),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { childId }, headers: h });
      return (res.milestones ?? []) as unknown as Milestone[];
    },
    enabled: !!childId,
    staleTime: 30_000,
  });
}

// ─── 2. useMilestone ──────────────────────────────────────────────────────────

export function useMilestone(milestoneId: string) {
  const fn = useServerFn(getMilestoneServer);
  return useQuery({
    queryKey: milestoneKeys.detail(milestoneId),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { milestoneId }, headers: h });
      return res.milestone as unknown as Milestone;
    },
    enabled: !!milestoneId,
    staleTime: 30_000,
  });
}

// ─── 3. useCreateMilestone ────────────────────────────────────────────────────

export function useCreateMilestone(childId: string) {
  const fn = useServerFn(createMilestoneServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MilestoneInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: milestoneKeys.list(childId) }),
  });
}

// ─── 4. useUpdateMilestone ────────────────────────────────────────────────────

export function useUpdateMilestone(childId: string) {
  const fn = useServerFn(updateMilestoneServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MilestoneInput & { milestoneId: string }) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: (res) => {
      const m = (res as any)?.milestone as Milestone | undefined;
      qc.invalidateQueries({ queryKey: milestoneKeys.list(childId) });
      if (m?.id) qc.invalidateQueries({ queryKey: milestoneKeys.detail(m.id) });
    },
  });
}

// ─── 5. useAchieveMilestone ───────────────────────────────────────────────────

export function useAchieveMilestone(childId: string) {
  const fn = useServerFn(achieveMilestoneServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const h = await authHeaders();
      return fn({ data: { milestoneId }, headers: h });
    },
    onSuccess: (res) => {
      const m = (res as any)?.milestone as Milestone | undefined;
      qc.invalidateQueries({ queryKey: milestoneKeys.list(childId) });
      if (m?.id) qc.invalidateQueries({ queryKey: milestoneKeys.detail(m.id) });
    },
  });
}

// ─── 6. usePauseResumeMilestone ───────────────────────────────────────────────

export function usePauseResumeMilestone(childId: string) {
  const fn = useServerFn(pauseResumeMilestoneServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (milestoneId: string) => {
      const h = await authHeaders();
      return fn({ data: { milestoneId }, headers: h });
    },
    onSuccess: (res) => {
      const m = (res as any)?.milestone as Milestone | undefined;
      qc.invalidateQueries({ queryKey: milestoneKeys.list(childId) });
      if (m?.id) qc.invalidateQueries({ queryKey: milestoneKeys.detail(m.id) });
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS — METAS TERAPÊUTICAS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── 7. useAllGoalsForChild ───────────────────────────────────────────────────

export function useAllGoalsForChild(childId: string | undefined) {
  const fn = useServerFn(listAllGoalsForChildServer);
  return useQuery({
    queryKey: milestoneGoalKeys.allForChild(childId ?? ""),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { childId: childId! }, headers: h });
      return (res.goals ?? []) as unknown as GoalPickerItem[];
    },
    enabled: !!childId,
    staleTime: 30_000,
  });
}

// ─── 8. useMilestoneGoalCounts ───────────────────────────────────────────────

export function useMilestoneGoalCounts(childId: string) {
  const fn = useServerFn(getMilestoneGoalCountsServer);
  return useQuery({
    queryKey: milestoneGoalKeys.counts(childId),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { childId }, headers: h });
      return (res.counts ?? {}) as Record<string, number>;
    },
    enabled: !!childId,
    staleTime: 30_000,
  });
}

// ─── 8. useMilestoneGoals ─────────────────────────────────────────────────────

export function useMilestoneGoals(milestoneId: string) {
  const fn = useServerFn(listMilestoneGoalsServer);
  return useQuery({
    queryKey: milestoneGoalKeys.list(milestoneId),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { milestoneId }, headers: h });
      return (res.goals ?? []) as unknown as MilestoneGoal[];
    },
    enabled: !!milestoneId,
    staleTime: 30_000,
  });
}

// ─── 8. useCreateMilestoneGoal ────────────────────────────────────────────────

export function useCreateMilestoneGoal(milestoneId: string) {
  const fn = useServerFn(createMilestoneGoalServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MilestoneGoalInput) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: milestoneGoalKeys.list(milestoneId) }),
  });
}

// ─── 9. useUpdateMilestoneGoal ────────────────────────────────────────────────

export function useUpdateMilestoneGoal(milestoneId: string) {
  const fn = useServerFn(updateMilestoneGoalServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MilestoneGoalInput & { goalId: string }) => {
      const h = await authHeaders();
      return fn({ data: input, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: milestoneGoalKeys.list(milestoneId) }),
  });
}

// ─── 10. useDeleteMilestoneGoal ───────────────────────────────────────────────

export function useDeleteMilestoneGoal(milestoneId: string) {
  const fn = useServerFn(deleteMilestoneGoalServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const h = await authHeaders();
      return fn({ data: { goalId }, headers: h });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: milestoneGoalKeys.list(milestoneId) }),
  });
}

// ─── 11. useAchieveMilestoneGoal ─────────────────────────────────────────────

export function useAchieveMilestoneGoal(milestoneId: string, childId: string) {
  const fn = useServerFn(achieveMilestoneGoalServer);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: string) => {
      const h = await authHeaders();
      return fn({ data: { goalId }, headers: h });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: milestoneGoalKeys.list(milestoneId) });
      qc.invalidateQueries({ queryKey: milestoneGoalKeys.counts(childId) });
      qc.invalidateQueries({ queryKey: milestoneGoalKeys.allForChild(childId) });
    },
  });
}

// ─── 12. useGoalProgress ──────────────────────────────────────────────────────

export function useGoalProgress(goalId: string, childId: string) {
  const fn = useServerFn(getMilestoneGoalProgressServer);
  return useQuery({
    queryKey: milestoneGoalKeys.progress(goalId),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { goalId, childId }, headers: h });
      return (res.attempts ?? []) as unknown as GoalAttempt[];
    },
    enabled: !!goalId && !!childId,
    staleTime: 30_000,
  });
}

// ─── 12. useMilestoneProgress ────────────────────────────────────────────────

export function useMilestoneProgress(milestoneId: string, childId: string) {
  const fn = useServerFn(getMilestoneProgressServer);
  return useQuery({
    queryKey: milestoneGoalKeys.milestoneProgress(milestoneId),
    queryFn:  async () => {
      const h = await authHeaders();
      const res = await fn({ data: { milestoneId, childId }, headers: h });
      return (res.entries ?? []) as unknown as MilestoneProgressEntry[];
    },
    enabled: !!milestoneId && !!childId,
    staleTime: 30_000,
  });
}
