import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock controlável do supabaseAdmin: a cadeia .select().eq().eq().not()
// .maybeSingle() resolve com `mockRow`, que cada teste define.
let mockRow: { role: string } | null = null;
vi.mock("@/integrations/supabase/client.server", () => {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    maybeSingle: async () => ({ data: mockRow, error: null }),
  };
  return { supabaseAdmin: { from: () => chain } };
});

import {
  getClinicMembership,
  assertClinicMember,
  assertClinicCoordinator,
} from "@/lib/clinic-auth.server";

beforeEach(() => {
  mockRow = null;
});

describe("clinic-auth — isolamento de tenant (ADR-003 / LGPD)", () => {
  it("getClinicMembership retorna null quando não há vínculo ativo", async () => {
    mockRow = null;
    expect(await getClinicMembership("clinic-1", "user-x")).toBeNull();
  });

  it("getClinicMembership retorna o papel quando há vínculo", async () => {
    mockRow = { role: "recepcao" };
    expect(await getClinicMembership("clinic-1", "user-x")).toEqual({ role: "recepcao" });
  });

  it("assertClinicMember lança Response 403 sem vínculo", async () => {
    mockRow = null;
    await expect(assertClinicMember("clinic-1", "user-x")).rejects.toBeInstanceOf(Response);
  });

  it("assertClinicMember passa para membro com qualquer papel", async () => {
    mockRow = { role: "recepcao" };
    await expect(assertClinicMember("clinic-1", "user-x")).resolves.toEqual({ role: "recepcao" });
  });

  it("assertClinicCoordinator lança 403 para membro não-coordinator", async () => {
    mockRow = { role: "recepcao" };
    await expect(assertClinicCoordinator("clinic-1", "user-x")).rejects.toBeInstanceOf(Response);
  });

  it("assertClinicCoordinator passa para coordinator", async () => {
    mockRow = { role: "coordinator" };
    await expect(assertClinicCoordinator("clinic-1", "user-x")).resolves.toEqual({ role: "coordinator" });
  });
});
