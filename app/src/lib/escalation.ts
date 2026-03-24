import { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification, NotificationType, NotificationTier } from "./notifications";

// ============================================================
// Escalation Rules (PRD Section 4.7)
// ============================================================
//
// Yellow → Red KPI: yellow for 2+ weeks → escalate from daily_digest to urgent
// Blocker aging: open 3+ days → escalate from urgent to immediate
// Pulse drift: 3 missed consecutive → send Discord DM (immediate)
// Commitment miss: past due with no update → surface in weekly sync agenda

export interface EscalationResult {
  type: string;
  entityId: string;
  entityType: string;
  userId: string;
  title: string;
  body: string;
  tier: NotificationTier;
}

// ============================================================
// KPI Escalation: Yellow → Red over time
// ============================================================

export async function checkKpiEscalations(
  supabase: SupabaseClient,
  orgId: string
): Promise<EscalationResult[]> {
  const results: EscalationResult[] = [];
  const twoWeeksAgo = new Date(
    Date.now() - 14 * 24 * 60 * 60 * 1000
  ).toISOString();

  // KPIs that have been yellow for 2+ weeks (based on updated_at or a status change log)
  // Simplified: check KPIs that are yellow and haven't been updated in 14+ days
  const { data: staleYellowKpis } = await supabase
    .from("kpis")
    .select("id, name, owner_id, health_status, updated_at")
    .eq("lifecycle_status", "active")
    .eq("health_status", "yellow")
    .lt("updated_at", twoWeeksAgo);

  for (const kpi of staleYellowKpis ?? []) {
    results.push({
      type: "kpi_escalation",
      entityId: kpi.id,
      entityType: "kpi",
      userId: kpi.owner_id,
      title: `KPI "${kpi.name}" has been yellow for 2+ weeks`,
      body: "This KPI needs attention. Review the action playbook or update the metric.",
      tier: "urgent",
    });
  }

  // KPIs that have been red for 2+ weeks
  const { data: staleRedKpis } = await supabase
    .from("kpis")
    .select("id, name, owner_id, health_status, updated_at")
    .eq("lifecycle_status", "active")
    .eq("health_status", "red")
    .lt("updated_at", twoWeeksAgo);

  for (const kpi of staleRedKpis ?? []) {
    results.push({
      type: "kpi_critical",
      entityId: kpi.id,
      entityType: "kpi",
      userId: kpi.owner_id,
      title: `KPI "${kpi.name}" has been red for 2+ weeks — action required`,
      body: "A corrective action plan is required. This KPI cannot be marked as reviewed until one is attached.",
      tier: "immediate",
    });
  }

  return results;
}

// ============================================================
// Blocker Aging Escalation
// ============================================================

export async function checkBlockerEscalations(
  supabase: SupabaseClient,
  _orgId: string
): Promise<EscalationResult[]> {
  const results: EscalationResult[] = [];
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: agedBlockers } = await supabase
    .from("blockers")
    .select("id, description, owner_id, severity, created_at")
    .eq("resolution_state", "open")
    .lt("created_at", threeDaysAgo);

  for (const blocker of agedBlockers ?? []) {
    const isCritical =
      blocker.severity === "critical" || blocker.severity === "high";
    results.push({
      type: "blocker_aging",
      entityId: blocker.id,
      entityType: "blocker",
      userId: blocker.owner_id,
      title: `Blocker unresolved for 3+ days: "${blocker.description.slice(0, 60)}"`,
      body: `This ${blocker.severity} blocker has been open since ${new Date(blocker.created_at).toLocaleDateString()}.`,
      tier: isCritical ? "immediate" : "urgent",
    });
  }

  return results;
}

// ============================================================
// Pulse Drift Escalation
// ============================================================

export async function checkPulseDriftEscalations(
  supabase: SupabaseClient,
  orgId: string
): Promise<EscalationResult[]> {
  const results: EscalationResult[] = [];

  // Get all team members
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", orgId);

  if (!members) return results;

  // Check last 3 days of pulses
  const threeDaysAgo = new Date(
    Date.now() - 3 * 24 * 60 * 60 * 1000
  ).toISOString().split("T")[0];

  const { data: recentPulses } = await supabase
    .from("pulses")
    .select("user_id, date")
    .gte("date", threeDaysAgo);

  const pulsesByUser = new Set(
    (recentPulses ?? []).map((p: Record<string, unknown>) => p.user_id as string)
  );

  for (const member of members) {
    if (!pulsesByUser.has(member.user_id)) {
      results.push({
        type: "pulse_drift",
        entityId: member.user_id,
        entityType: "user",
        userId: member.user_id,
        title: "You've missed 3+ days of pulses",
        body: "Your daily pulse keeps the team informed. Take 2 minutes to share what you shipped, your focus, and any blockers.",
        tier: "immediate",
      });
    }
  }

  return results;
}

// ============================================================
// Commitment Miss Escalation
// ============================================================

export async function checkCommitmentEscalations(
  supabase: SupabaseClient,
  _orgId: string
): Promise<EscalationResult[]> {
  const results: EscalationResult[] = [];
  const today = new Date().toISOString().split("T")[0];

  const { data: overdueCommitments } = await supabase
    .from("commitments")
    .select("id, description, owner_id, due_date")
    .eq("status", "pending")
    .lt("due_date", today);

  for (const commitment of overdueCommitments ?? []) {
    results.push({
      type: "commitment_overdue",
      entityId: commitment.id,
      entityType: "commitment",
      userId: commitment.owner_id,
      title: `Commitment overdue: "${commitment.description.slice(0, 60)}"`,
      body: `This commitment was due ${new Date(commitment.due_date).toLocaleDateString()}. Update its status or discuss in the weekly sync.`,
      tier: "urgent",
    });
  }

  return results;
}

// ============================================================
// Run all escalation checks
// ============================================================

export async function runEscalationChecks(
  supabase: SupabaseClient,
  orgId: string
): Promise<EscalationResult[]> {
  const [kpis, blockers, pulses, commitments] = await Promise.all([
    checkKpiEscalations(supabase, orgId),
    checkBlockerEscalations(supabase, orgId),
    checkPulseDriftEscalations(supabase, orgId),
    checkCommitmentEscalations(supabase, orgId),
  ]);

  return [...kpis, ...blockers, ...pulses, ...commitments];
}

// ============================================================
// Dispatch escalation notifications
// ============================================================

export async function dispatchEscalations(
  supabase: SupabaseClient,
  orgId: string,
  escalations: EscalationResult[]
) {
  for (const esc of escalations) {
    await sendNotification(supabase, {
      userId: esc.userId,
      orgId,
      type: esc.type as NotificationType,
      tier: esc.tier,
      title: esc.title,
      body: esc.body,
      entityId: esc.entityId,
      entityType: esc.entityType,
    });
  }
}
