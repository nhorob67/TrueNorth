import type { UserContext } from "@/lib/user-context";

interface VentureSummary {
  id: string;
  name: string;
  role: UserContext["ventureRole"];
}

export function getDefaultDashboardPath(
  orgRole: UserContext["orgRole"]
): string {
  switch (orgRole) {
    case "manager":
      return "/cockpit/team";
    case "member":
      return "/cockpit/my";
    case "viewer":
      return "/strategy/scoreboard";
    case "admin":
    default:
      return "/cockpit";
  }
}

export function resolveActiveVenture(
  ventures: VentureSummary[],
  selectedVentureId: string | null | undefined
): VentureSummary | null {
  if (ventures.length === 0) return null;

  return ventures.find((venture) => venture.id === selectedVentureId) ?? ventures[0];
}
