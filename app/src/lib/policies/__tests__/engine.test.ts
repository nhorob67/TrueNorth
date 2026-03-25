import { describe, it, expect, vi } from "vitest";
import { checkPolicy, type PolicyContext } from "../engine";

// ============================================================
// Mock Supabase client
// ============================================================

function createMockSupabase(responses: Record<string, unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() => {
      const table = (chain as unknown as { _table: string })._table;
      return Promise.resolve({ data: responses[`${table}_single`] ?? null, error: null });
    }),
  };

  // Make chainable methods resolve to data when awaited
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    (chain as unknown as { _table: string })._table = table;

    // Default resolution for non-single queries
    const proxy = new Proxy(chain, {
      get(target, prop) {
        if (prop === "then") {
          const table = (target as unknown as { _table: string })._table;
          const data = responses[table];
          return (resolve: (v: unknown) => void) =>
            resolve({ data: data ?? [], error: null, count: Array.isArray(data) ? data.length : 0 });
        }
        return (target as Record<string, unknown>)[prop as string];
      },
    });

    return proxy;
  });

  return { from: mockFrom } as unknown as PolicyContext["supabase"];
}

function makeCtx(
  overrides: Partial<PolicyContext> = {},
  responses: Record<string, unknown> = {}
): PolicyContext {
  return {
    supabase: createMockSupabase(responses),
    organizationId: "org-1",
    ventureId: "venture-1",
    userId: "user-1",
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("Policy Engine", () => {
  describe("max_active_bets", () => {
    it("passes when fewer than 3 bets", async () => {
      const ctx = makeCtx({}, { bets: [{ id: "1" }, { id: "2" }] });
      const result = await checkPolicy("max_active_bets", ctx);
      expect(result?.result.passed).toBe(true);
      expect(result?.result.currentValue).toBe(2);
    });

    it("fails when 3 or more bets", async () => {
      const ctx = makeCtx({}, { bets: [{ id: "1" }, { id: "2" }, { id: "3" }] });
      const result = await checkPolicy("max_active_bets", ctx);
      expect(result?.result.passed).toBe(false);
      expect(result?.result.currentValue).toBe(3);
      expect(result?.result.limit).toBe(3);
    });
  });

  describe("kpi_range", () => {
    it("passes with 5-15 KPIs", async () => {
      const kpis = Array.from({ length: 8 }, (_, i) => ({ id: String(i) }));
      const ctx = makeCtx({}, { kpis });
      const result = await checkPolicy("kpi_range", ctx);
      expect(result?.result.passed).toBe(true);
    });

    it("fails with fewer than 5 KPIs", async () => {
      const ctx = makeCtx({}, { kpis: [{ id: "1" }, { id: "2" }] });
      const result = await checkPolicy("kpi_range", ctx);
      expect(result?.result.passed).toBe(false);
      expect(result?.result.violation).toContain("Only 2 KPIs");
    });

    it("fails with more than 15 KPIs", async () => {
      const kpis = Array.from({ length: 18 }, (_, i) => ({ id: String(i) }));
      const ctx = makeCtx({}, { kpis });
      const result = await checkPolicy("kpi_range", ctx);
      expect(result?.result.passed).toBe(false);
      expect(result?.result.violation).toContain("18 KPIs");
    });
  });

  describe("max_moves_per_bet", () => {
    it("passes when under 15 moves", async () => {
      const moves = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }));
      const ctx = makeCtx({ entityId: "bet-1" }, { moves });
      const result = await checkPolicy("max_moves_per_bet", ctx);
      expect(result?.result.passed).toBe(true);
    });

    it("fails at 15 moves", async () => {
      const moves = Array.from({ length: 15 }, (_, i) => ({ id: String(i) }));
      const ctx = makeCtx({ entityId: "bet-1" }, { moves });
      const result = await checkPolicy("max_moves_per_bet", ctx);
      expect(result?.result.passed).toBe(false);
      expect(result?.result.limit).toBe(15);
    });

    it("passes when no entityId provided", async () => {
      const ctx = makeCtx({}, {});
      const result = await checkPolicy("max_moves_per_bet", ctx);
      expect(result?.result.passed).toBe(true);
    });
  });

  describe("idea_quarantine", () => {
    it("passes when cooling period is over", async () => {
      const past = new Date(Date.now() - 15 * 86400000).toISOString();
      const ctx = makeCtx(
        { entityId: "idea-1" },
        { ideas_single: { submitted_at: past, cooling_expires_at: past } }
      );
      const result = await checkPolicy("idea_quarantine", ctx);
      expect(result?.result.passed).toBe(true);
    });

    it("fails when still in cooling period", async () => {
      const future = new Date(Date.now() + 5 * 86400000).toISOString();
      const ctx = makeCtx(
        { entityId: "idea-1" },
        {
          ideas_single: {
            submitted_at: new Date().toISOString(),
            cooling_expires_at: future,
          },
        }
      );
      const result = await checkPolicy("idea_quarantine", ctx);
      expect(result?.result.passed).toBe(false);
    });
  });

  describe("max_active_projects_per_person", () => {
    it("passes when user owns fewer than 2 bets", async () => {
      const ctx = makeCtx({}, { bets: [{ id: "1" }] });
      const result = await checkPolicy("max_active_projects_per_person", ctx);
      expect(result?.result.passed).toBe(true);
    });

    it("fails when user owns 2 or more bets", async () => {
      const ctx = makeCtx({}, { bets: [{ id: "1" }, { id: "2" }] });
      const result = await checkPolicy("max_active_projects_per_person", ctx);
      expect(result?.result.passed).toBe(false);
      expect(result?.result.violation).toContain("2 active bets");
    });
  });

  describe("max_new_initiatives_per_week", () => {
    it("passes when no ideas selected this week", async () => {
      const ctx = makeCtx({}, { ideas: [] });
      const result = await checkPolicy("max_new_initiatives_per_week", ctx);
      expect(result?.result.passed).toBe(true);
    });

    it("fails when 1 or more ideas selected this week", async () => {
      const ctx = makeCtx({}, { ideas: [{ id: "1" }] });
      const result = await checkPolicy("max_new_initiatives_per_week", ctx);
      expect(result?.result.passed).toBe(false);
      expect(result?.result.limit).toBe(1);
    });
  });

  describe("single_kpi_ownership", () => {
    it("passes when KPI has an owner", async () => {
      const ctx = makeCtx(
        { entityId: "kpi-1" },
        { kpis_single: { owner_id: "user-1" } }
      );
      const result = await checkPolicy("single_kpi_ownership", ctx);
      expect(result?.result.passed).toBe(true);
    });

    it("fails when KPI has no owner", async () => {
      const ctx = makeCtx(
        { entityId: "kpi-1" },
        { kpis_single: { owner_id: null } }
      );
      const result = await checkPolicy("single_kpi_ownership", ctx);
      expect(result?.result.passed).toBe(false);
    });
  });

  describe("unknown policy", () => {
    it("returns null for non-existent policy", async () => {
      const ctx = makeCtx();
      const result = await checkPolicy("nonexistent_policy", ctx);
      expect(result).toBeNull();
    });
  });
});
