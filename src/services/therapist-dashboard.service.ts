// React Query hooks para o Dashboard de Evolução.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getTherapistPatientDashboardServer,
  getParentPatientDashboardServer,
} from "@/lib/therapist-dashboard.functions";
import type { DashboardData } from "@/lib/therapist-dashboard.functions";

export type { DashboardData, AreaStats, MilestoneArea } from "@/lib/therapist-dashboard.functions";

// ─── Auth headers ─────────────────────────────────────────────────────────────

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── 1. useTherapistPatientDashboard ─────────────────────────────────────────

export function useTherapistPatientDashboard(childId?: string) {
  const fn = useServerFn(getTherapistPatientDashboardServer);
  return useQuery<DashboardData>({
    queryKey: ["therapist-patient-dashboard", childId],
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ data: { childId: childId! }, headers: h }) as Promise<DashboardData>;
    },
    enabled: !!childId,
    staleTime: 60_000,
  });
}

// ─── 2. useParentPatientDashboard ─────────────────────────────────────────────

export function useParentPatientDashboard(accessId?: string) {
  const fn = useServerFn(getParentPatientDashboardServer);
  return useQuery<DashboardData>({
    queryKey: ["parent-patient-dashboard", accessId],
    queryFn: async () => {
      const h = await authHeaders();
      return fn({ data: { accessId: accessId! }, headers: h }) as Promise<DashboardData>;
    },
    enabled: !!accessId,
    staleTime: 60_000,
  });
}
