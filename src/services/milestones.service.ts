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
} from "@/lib/milestones.functions";
import type { MilestoneInput } from "@/lib/validation";

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

// ─── Query key factory ────────────────────────────────────────────────────────

export const milestoneKeys = {
  list:   (childId: string)      => ["milestones", childId] as const,
  detail: (milestoneId: string)  => ["milestone", milestoneId] as const,
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
