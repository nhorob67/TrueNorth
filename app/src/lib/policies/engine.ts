import { SupabaseClient } from "@supabase/supabase-js";

export type PolicyEnforcement = "hard_block" | "soft_warning" | "override_allowed";

export interface PolicyDefinition {
  name: string;
  description: string;
  scope: "venture" | "organization";
  enforcement: PolicyEnforcement;
  overrideAllowed: boolean;
  userExplanation: string;
  check: (ctx: PolicyContext) => Promise<PolicyResult>;
}

export interface PolicyContext {
  supabase: SupabaseClient;
  organizationId: string;
  ventureId?: string;
  entityId?: string;
  entityType?: string;
  userId: string;
  kpiId?: string;
}

export interface PolicyResult {
  passed: boolean;
  violation?: string;
  currentValue?: number;
  limit?: number;
}

export interface PolicyCheckResult {
  policy: PolicyDefinition;
  result: PolicyResult;
}

// ============================================================
// Policy Definitions
// ============================================================

const MAX_ACTIVE_BETS: PolicyDefinition = {
  name: "max_active_bets",
  description: "Maximum 3 active bets per venture",
  scope: "venture",
  enforcement: "override_allowed",
  overrideAllowed: true,
  userExplanation:
    "Each venture can have at most 3 active bets at a time. This keeps the team focused on what matters most.",
  async check(ctx) {
    const { data } = await ctx.supabase
      .from("bets")
      .select("id", { count: "exact" })
      .eq("venture_id", ctx.ventureId!)
      .eq("lifecycle_status", "active");
    const count = data?.length ?? 0;
    return { passed: count < 3, currentValue: count, limit: 3 };
  },
};

const KPI_RANGE: PolicyDefinition = {
  name: "kpi_range",
  description: "5–15 KPIs per venture",
  scope: "venture",
  enforcement: "soft_warning",
  overrideAllowed: true,
  userExplanation:
    "Each venture should maintain between 5 and 15 KPIs. Too few misses signals; too many dilutes focus.",
  async check(ctx) {
    const { data } = await ctx.supabase
      .from("kpis")
      .select("id", { count: "exact" })
      .eq("venture_id", ctx.ventureId!)
      .eq("lifecycle_status", "active");
    const count = data?.length ?? 0;
    return {
      passed: count >= 5 && count <= 15,
      currentValue: count,
      limit: 15,
      violation:
        count < 5
          ? `Only ${count} KPIs — consider adding more for visibility.`
          : count > 15
            ? `${count} KPIs — consider consolidating to maintain focus.`
            : undefined,
    };
  },
};

const SINGLE_KPI_OWNERSHIP: PolicyDefinition = {
  name: "single_kpi_ownership",
  description: "Every KPI must have exactly one owner",
  scope: "venture",
  enforcement: "hard_block",
  overrideAllowed: false,
  userExplanation: "Every KPI must have a single owner accountable for its performance.",
  async check(ctx) {
    // Enforced at the schema level (owner_id NOT NULL), but check anyway
    if (!ctx.entityId) return { passed: true };
    const { data } = await ctx.supabase
      .from("kpis")
      .select("owner_id")
      .eq("id", ctx.entityId)
      .single();
    return { passed: !!data?.owner_id };
  },
};

const MAX_MOVES_PER_BET: PolicyDefinition = {
  name: "max_moves_per_bet",
  description: "Maximum 15 Moves per bet",
  scope: "venture",
  enforcement: "hard_block",
  overrideAllowed: false,
  userExplanation:
    "Each bet can have at most 15 Moves. Break work into meaningful milestones, not micro-tasks.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };
    const { data } = await ctx.supabase
      .from("moves")
      .select("id", { count: "exact" })
      .eq("bet_id", ctx.entityId)
      .neq("lifecycle_status", "cut");
    const count = data?.length ?? 0;
    return { passed: count < 15, currentValue: count, limit: 15 };
  },
};

const MOVE_OWNERSHIP_REQUIRED: PolicyDefinition = {
  name: "move_ownership_required",
  description: "Every Move must have an owner",
  scope: "venture",
  enforcement: "hard_block",
  overrideAllowed: false,
  userExplanation: "Every Move must have someone accountable for its completion.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };
    const { data } = await ctx.supabase
      .from("moves")
      .select("owner_id")
      .eq("id", ctx.entityId)
      .single();
    return { passed: !!data?.owner_id };
  },
};

const CUT_REASON_REQUIRED: PolicyDefinition = {
  name: "cut_reason_required",
  description: "Cutting a Move requires a reason",
  scope: "venture",
  enforcement: "hard_block",
  overrideAllowed: false,
  userExplanation:
    "When cutting a Move, you must explain why. This preserves organizational learning.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };
    const { data } = await ctx.supabase
      .from("moves")
      .select("lifecycle_status, cut_reason")
      .eq("id", ctx.entityId)
      .single();
    if (data?.lifecycle_status === "cut" && !data?.cut_reason) {
      return { passed: false, violation: "A reason is required when cutting a Move." };
    }
    return { passed: true };
  },
};

const MAX_RECURRING_MOVES_PER_BET: PolicyDefinition = {
  name: "max_recurring_moves_per_bet",
  description: "Maximum 5 recurring moves per bet",
  scope: "venture",
  enforcement: "hard_block",
  overrideAllowed: false,
  userExplanation:
    "Each bet can have at most 5 recurring moves to maintain execution focus. Consider consolidating rhythms if you need more.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };
    const { count } = await ctx.supabase
      .from("moves")
      .select("id", { count: "exact", head: true })
      .eq("bet_id", ctx.entityId)
      .eq("type", "recurring")
      .in("lifecycle_status", ["not_started", "in_progress"]);
    const current = count ?? 0;
    return {
      passed: current < 5,
      violation: current >= 5 ? "This bet already has 5 recurring moves" : undefined,
      currentValue: current,
      limit: 5,
    };
  },
};

const IDEA_QUARANTINE: PolicyDefinition = {
  name: "idea_quarantine",
  description: "14-day cooling period for new ideas",
  scope: "venture",
  enforcement: "override_allowed",
  overrideAllowed: true,
  userExplanation:
    "New ideas sit in quarantine for 14 days to prevent reactive decision-making.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };
    const { data } = await ctx.supabase
      .from("ideas")
      .select("submitted_at, cooling_expires_at")
      .eq("id", ctx.entityId)
      .single();
    if (!data) return { passed: true };
    const now = new Date();
    const expires = new Date(data.cooling_expires_at);
    return { passed: now >= expires };
  },
};

const FUNNEL_REQUIRES_IDEA: PolicyDefinition = {
  name: "funnel_requires_idea",
  description: "Funnels should be linked to an idea",
  scope: "venture",
  enforcement: "soft_warning",
  overrideAllowed: true,
  userExplanation:
    "Every funnel should originate from a validated idea. This ensures marketing efforts trace back to strategic thinking.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };
    const { data } = await ctx.supabase
      .from("funnels")
      .select("linked_idea_id")
      .eq("id", ctx.entityId)
      .single();
    return {
      passed: !!data?.linked_idea_id,
      violation: !data?.linked_idea_id
        ? "This funnel has no linked idea. Consider connecting it to a validated idea."
        : undefined,
    };
  },
};

const KPI_UPDATE_CADENCE: PolicyDefinition = {
  name: "kpi_update_cadence",
  description: "KPIs should be updated at their expected frequency",
  scope: "venture",
  enforcement: "soft_warning",
  overrideAllowed: true,
  userExplanation:
    "Each KPI has an expected update frequency. Stale data makes the scoreboard unreliable.",
  async check(ctx) {
    const kpiId = ctx.kpiId ?? ctx.entityId;
    if (!kpiId) return { passed: true };

    const { data: kpi } = await ctx.supabase
      .from("kpis")
      .select("id, name, cadence, lifecycle_status")
      .eq("id", kpiId)
      .single();

    if (!kpi || kpi.lifecycle_status !== "active") return { passed: true };

    const { data: entries } = await ctx.supabase
      .from("kpi_entries")
      .select("recorded_at")
      .eq("kpi_id", kpiId)
      .order("recorded_at", { ascending: false })
      .limit(1);

    if (!entries || entries.length === 0) {
      return {
        passed: false,
        violation: `KPI "${kpi.name}" has no entries recorded yet.`,
      };
    }

    const lastEntry = new Date(entries[0].recorded_at);
    const now = new Date();
    const daysSince = Math.floor(
      (now.getTime() - lastEntry.getTime()) / (1000 * 60 * 60 * 24)
    );

    const thresholds: Record<string, number> = {
      daily: 2,
      weekly: 10,
      monthly: 35,
      quarterly: 100,
    };

    const cadence = (kpi.cadence as string) ?? "weekly";
    const threshold = thresholds[cadence] ?? 10;

    return {
      passed: daysSince <= threshold,
      currentValue: daysSince,
      limit: threshold,
      violation:
        daysSince > threshold
          ? `KPI "${kpi.name}" last updated ${daysSince}d ago (expected every ${threshold}d for ${cadence} cadence).`
          : undefined,
    };
  },
};

const SACRED_WORK_PROTECTION: PolicyDefinition = {
  name: "sacred_work_protection",
  description: "Sacred processes cannot be automated",
  scope: "organization",
  enforcement: "hard_block",
  overrideAllowed: false,
  userExplanation:
    "This process is on the Sacred Work list and cannot have its automation level raised above 0. Sacred work must remain human-driven.",
  async check(ctx) {
    if (!ctx.entityId) return { passed: true };

    const { data: org } = await ctx.supabase
      .from("organizations")
      .select("settings")
      .eq("id", ctx.organizationId)
      .single();

    const settings = (org?.settings ?? {}) as Record<string, unknown>;
    const sacredIds = (settings.sacred_process_ids ?? []) as string[];

    if (!sacredIds.includes(ctx.entityId)) return { passed: true };

    // Check if the process is being set above L0
    const { data: process } = await ctx.supabase
      .from("processes")
      .select("automation_level")
      .eq("id", ctx.entityId)
      .single();

    // If it's currently at 0 and on the sacred list, block any change attempt
    // (the caller is trying to raise it)
    return {
      passed: false,
      violation:
        "This process is on the Sacred Work list and cannot be automated.",
    };
  },
};

const MAX_ACTIVE_PROJECTS_PER_PERSON: PolicyDefinition = {
  name: "max_active_projects_per_person",
  description: "Maximum 2 active bets owned per person",
  scope: "venture",
  enforcement: "soft_warning",
  overrideAllowed: true,
  userExplanation:
    "Each person should own at most 2 active bets to maintain focus and execution quality.",
  async check(ctx) {
    const { data } = await ctx.supabase
      .from("bets")
      .select("id", { count: "exact" })
      .eq("owner_id", ctx.userId)
      .eq("lifecycle_status", "active");
    const count = data?.length ?? 0;
    return {
      passed: count < 2,
      currentValue: count,
      limit: 2,
      violation:
        count >= 2
          ? `You already own ${count} active bets. Consider completing one before taking on more.`
          : undefined,
    };
  },
};

const MAX_NEW_INITIATIVES_PER_WEEK: PolicyDefinition = {
  name: "max_new_initiatives_per_week",
  description: "Maximum 1 new initiative selected per week",
  scope: "venture",
  enforcement: "soft_warning",
  overrideAllowed: true,
  userExplanation:
    "Limit new initiative selection to 1 per week to prevent reactive overload.",
  async check(ctx) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await ctx.supabase
      .from("ideas")
      .select("id", { count: "exact" })
      .eq("venture_id", ctx.ventureId!)
      .eq("lifecycle_status", "selected")
      .gte("updated_at", sevenDaysAgo);

    const count = data?.length ?? 0;
    return {
      passed: count < 1,
      currentValue: count,
      limit: 1,
      violation:
        count >= 1
          ? `${count} idea(s) already selected this week. Allow the team to absorb before adding more.`
          : undefined,
    };
  },
};

const VISION_EDIT_GATING: PolicyDefinition = {
  name: "vision_edit_gating",
  description: "Vision edits are gated outside quarterly summit windows",
  scope: "venture",
  enforcement: "override_allowed",
  overrideAllowed: true,
  userExplanation:
    "The vision is locked outside of quarterly summit windows to maintain strategic stability. Edits are allowed within 30 days of a quarterly summit.",
  async check(ctx) {
    if (!ctx.ventureId) return { passed: true };

    const { data: venture } = await ctx.supabase
      .from("ventures")
      .select("settings")
      .eq("id", ctx.ventureId)
      .single();

    const settings = (venture?.settings ?? {}) as Record<string, unknown>;
    const lastSummitStr = settings.last_quarterly_summit_date as string | undefined;

    // If no summit date recorded, block edits (need a summit first)
    if (!lastSummitStr) {
      return {
        passed: false,
        violation:
          "Vision is locked. No quarterly summit date recorded — schedule a summit to unlock edits.",
      };
    }

    const lastSummit = new Date(lastSummitStr);
    const now = new Date();
    const daysSinceSummit = Math.floor(
      (now.getTime() - lastSummit.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      passed: daysSinceSummit <= 30,
      currentValue: daysSinceSummit,
      limit: 30,
      violation:
        daysSinceSummit > 30
          ? `Vision is locked. Last quarterly summit was ${daysSinceSummit} days ago (edits allowed within 30 days).`
          : undefined,
    };
  },
};

// ============================================================
// Engine
// ============================================================

const ALL_POLICIES: PolicyDefinition[] = [
  MAX_ACTIVE_BETS,
  KPI_RANGE,
  SINGLE_KPI_OWNERSHIP,
  MAX_MOVES_PER_BET,
  MOVE_OWNERSHIP_REQUIRED,
  CUT_REASON_REQUIRED,
  MAX_RECURRING_MOVES_PER_BET,
  IDEA_QUARANTINE,
  FUNNEL_REQUIRES_IDEA,
  KPI_UPDATE_CADENCE,
  SACRED_WORK_PROTECTION,
  MAX_ACTIVE_PROJECTS_PER_PERSON,
  MAX_NEW_INITIATIVES_PER_WEEK,
  VISION_EDIT_GATING,
];

/**
 * Check whether a policy is disabled at the venture level.
 * Venture settings can contain `disabled_policies: string[]`.
 */
async function isPolicyDisabledForVenture(
  supabase: SupabaseClient,
  ventureId: string | undefined,
  policyName: string
): Promise<boolean> {
  if (!ventureId) return false;
  const { data } = await supabase
    .from("ventures")
    .select("settings")
    .eq("id", ventureId)
    .single();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const disabled = (settings.disabled_policies ?? []) as string[];
  return disabled.includes(policyName);
}

export async function checkPolicy(
  policyName: string,
  ctx: PolicyContext
): Promise<PolicyCheckResult | null> {
  const policy = ALL_POLICIES.find((p) => p.name === policyName);
  if (!policy) return null;

  // Check venture-level disable (only for overrideable policies)
  if (policy.overrideAllowed && ctx.ventureId) {
    const disabled = await isPolicyDisabledForVenture(
      ctx.supabase,
      ctx.ventureId,
      policyName
    );
    if (disabled) {
      return { policy, result: { passed: true } };
    }
  }

  const result = await policy.check(ctx);
  return { policy, result };
}

export async function checkPolicies(
  policyNames: string[],
  ctx: PolicyContext
): Promise<PolicyCheckResult[]> {
  const results = await Promise.all(
    policyNames.map((name) => checkPolicy(name, ctx))
  );
  return results.filter((r): r is PolicyCheckResult => r !== null);
}

export async function recordOverride(
  supabase: SupabaseClient,
  override: {
    policyName: string;
    userId: string;
    justification: string;
    entityId?: string;
    entityType?: string;
    organizationId: string;
  }
) {
  return supabase.from("policy_overrides").insert({
    policy_name: override.policyName,
    overridden_by: override.userId,
    justification: override.justification,
    entity_id: override.entityId,
    entity_type: override.entityType,
    organization_id: override.organizationId,
  });
}

export { ALL_POLICIES };
