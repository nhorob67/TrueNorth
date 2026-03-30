import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyHermesSecret } from "@/lib/hermes/verify-secret";

export const dynamic = "force-dynamic";

/**
 * POST /api/hermes/budget-check
 *
 * Hermes calls this before starting a task to check if the agent is within budget.
 * Returns { allowed: true } or { allowed: false, reason: "..." }.
 *
 * Body: { orgId, agentId?, hermesProfile }
 */
export async function POST(request: Request) {
  if (!verifyHermesSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, agentId, hermesProfile } = await request.json();

  if (!orgId || !hermesProfile) {
    return NextResponse.json(
      { error: "Missing required fields: orgId, hermesProfile" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Fetch all enabled budget policies for this org and agent
  const { data: policies } = await supabase
    .from("agent_budget_policies")
    .select("*")
    .eq("organization_id", orgId)
    .eq("enabled", true);

  if (!policies || policies.length === 0) {
    return NextResponse.json({ allowed: true, reason: "No budget policies configured" });
  }

  const now = new Date();

  for (const policy of policies) {
    // Skip agent-scoped policies that don't match this agent
    if (policy.scope === "agent" && policy.agent_id !== agentId) continue;

    // Compute the period start date
    const periodStart = computePeriodStart(now, policy.period);

    // Query total spend for this period
    let query = supabase
      .from("agent_token_usage")
      .select("estimated_cost")
      .eq("organization_id", orgId)
      .gte("created_at", periodStart.toISOString());

    if (policy.scope === "agent" && policy.agent_id) {
      query = query.eq("agent_id", policy.agent_id);
    }

    const { data: usageRows } = await query;

    const totalSpend = (usageRows ?? []).reduce(
      (sum, row) => sum + Number(row.estimated_cost ?? 0),
      0
    );

    const budgetCap = Number(policy.budget_cap);
    const thresholdAmount = budgetCap * (policy.alert_threshold_pct / 100);

    // Check if budget exceeded
    if (totalSpend >= budgetCap) {
      if (policy.action_on_exceed === "block") {
        return NextResponse.json({
          allowed: false,
          reason: `${policy.period} budget exceeded: $${totalSpend.toFixed(2)} / $${budgetCap.toFixed(2)} (${policy.scope === "agent" ? hermesProfile : "org-wide"})`,
          action: "block",
          spend: totalSpend,
          cap: budgetCap,
        });
      }
      if (policy.action_on_exceed === "pause") {
        return NextResponse.json({
          allowed: false,
          reason: `${policy.period} budget exceeded — agent paused: $${totalSpend.toFixed(2)} / $${budgetCap.toFixed(2)}`,
          action: "pause",
          spend: totalSpend,
          cap: budgetCap,
        });
      }
      // action === "alert": allowed but flagged
    }

    // Check if approaching threshold (return warning but still allowed)
    if (totalSpend >= thresholdAmount && totalSpend < budgetCap) {
      // Continue checking other policies, but note the warning
      // (we return the warning only if no policy blocks)
    }
  }

  return NextResponse.json({ allowed: true });
}

function computePeriodStart(now: Date, period: string): Date {
  const start = new Date(now);

  switch (period) {
    case "daily":
      start.setUTCHours(0, 0, 0, 0);
      break;
    case "weekly": {
      const day = start.getUTCDay();
      start.setUTCDate(start.getUTCDate() - day); // Start of week (Sunday)
      start.setUTCHours(0, 0, 0, 0);
      break;
    }
    case "monthly":
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      break;
    default:
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
  }

  return start;
}
