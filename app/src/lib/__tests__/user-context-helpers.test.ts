import { describe, expect, it, vi } from "vitest";
import {
  getDefaultDashboardPath,
  resolveActiveVenture,
} from "../user-context-helpers";
import { checkAndTriggerFilterGuardian } from "../ai/filter-guardian-trigger";

describe("user-context helpers", () => {
  it("maps org roles to the correct default dashboard paths", () => {
    expect(getDefaultDashboardPath("admin")).toBe("/cockpit");
    expect(getDefaultDashboardPath("manager")).toBe("/cockpit/team");
    expect(getDefaultDashboardPath("member")).toBe("/cockpit/my");
    expect(getDefaultDashboardPath("viewer")).toBe("/strategy/scoreboard");
  });

  it("resolves the selected venture when it is accessible", () => {
    const ventures = [
      { id: "venture-a", name: "Venture A", role: "member" as const },
      { id: "venture-b", name: "Venture B", role: "admin" as const },
    ];

    expect(resolveActiveVenture(ventures, "venture-b")).toEqual(ventures[1]);
  });

  it("falls back to the first accessible venture when the selected venture is not accessible", () => {
    const ventures = [
      { id: "venture-a", name: "Venture A", role: "member" as const },
      { id: "venture-b", name: "Venture B", role: "admin" as const },
    ];

    expect(resolveActiveVenture(ventures, "venture-c")).toEqual(ventures[0]);
    expect(resolveActiveVenture([], "venture-c")).toBeNull();
  });
});

describe("checkAndTriggerFilterGuardian", () => {
  it("applies org exclusions before executing the legacy query", async () => {
    const queryChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => void) =>
        resolve({ data: [], error: null }),
    };

    const supabase = {
      from: vi.fn().mockReturnValue(queryChain),
    };

    const processed = await checkAndTriggerFilterGuardian(
      supabase as never,
      { excludeOrganizationIds: ["org-a", "org-b"] }
    );

    expect(processed).toBe(0);
    expect(queryChain.not).toHaveBeenCalledWith(
      "organization_id",
      "in",
      "(org-a,org-b)"
    );
  });
});
