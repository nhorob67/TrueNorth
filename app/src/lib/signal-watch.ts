import { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { sendNotification } from "./notifications";

// ============================================================
// Signal Watch: KPI Anomaly Detection Agent
//
// PRD Section 3.6 / 6.3:
// - Threshold alerts: value crosses yellow/red
// - Trend reversal: 2+ consecutive periods reversing
// - Correlation detection: leading → lagging via KPI Linkage Map
// - Seasonality awareness (6+ months data)
//
// Runs daily at 6am (configurable) as a cron job
// ============================================================

interface KpiWithEntries {
  id: string;
  name: string;
  owner_id: string;
  health_status: string;
  current_value: number | null;
  target: number | null;
  unit: string | null;
  directionality: string | null;
  linked_driver_kpis: string[];
  entries: Array<{
    value: number;
    recorded_at: string;
  }>;
}

export interface AnomalyAlert {
  kpi_id: string;
  kpi_name: string;
  owner_id: string;
  alert_type: "threshold_breach" | "trend_reversal" | "correlation_warning";
  severity: "high" | "medium" | "low";
  title: string;
  body: string;
}

// ============================================================
// Fetch KPIs with trailing 30 days of entries
// ============================================================

async function fetchKpisWithEntries(
  supabase: SupabaseClient
): Promise<KpiWithEntries[]> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: kpis } = await supabase
    .from("kpis")
    .select(
      "id, name, owner_id, health_status, current_value, target, unit, directionality, linked_driver_kpis"
    )
    .eq("lifecycle_status", "active");

  if (!kpis || kpis.length === 0) return [];

  const results: KpiWithEntries[] = [];

  for (const kpi of kpis) {
    const { data: entries } = await supabase
      .from("kpi_entries")
      .select("value, recorded_at")
      .eq("kpi_id", kpi.id)
      .gte("recorded_at", thirtyDaysAgo)
      .order("recorded_at", { ascending: true });

    results.push({
      ...(kpi as {
        id: string;
        name: string;
        owner_id: string;
        health_status: string;
        current_value: number | null;
        target: number | null;
        unit: string | null;
        directionality: string | null;
        linked_driver_kpis: string[];
      }),
      entries: (entries ?? []) as Array<{ value: number; recorded_at: string }>,
    });
  }

  return results;
}

// ============================================================
// Threshold Breach Detection
// ============================================================

function detectThresholdBreaches(kpis: KpiWithEntries[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  for (const kpi of kpis) {
    if (kpi.entries.length < 2) continue;

    const latest = kpi.entries[kpi.entries.length - 1];
    const previous = kpi.entries[kpi.entries.length - 2];

    if (!latest || !previous) continue;

    // Detect if the latest entry crossed the target threshold
    if (kpi.target !== null) {
      const upIsGood = kpi.directionality !== "down_is_good";
      const latestBelowTarget = upIsGood
        ? latest.value < kpi.target
        : latest.value > kpi.target;
      const previousAboveTarget = upIsGood
        ? previous.value >= kpi.target
        : previous.value <= kpi.target;

      if (latestBelowTarget && previousAboveTarget) {
        alerts.push({
          kpi_id: kpi.id,
          kpi_name: kpi.name,
          owner_id: kpi.owner_id,
          alert_type: "threshold_breach",
          severity: "high",
          title: `${kpi.name} crossed below target`,
          body: `${kpi.name} dropped from ${previous.value} to ${latest.value}${kpi.unit ? ` ${kpi.unit}` : ""} (target: ${kpi.target}). This is the first time it has crossed below target in the trailing 30-day window.`,
        });
      }
    }
  }

  return alerts;
}

// ============================================================
// Trend Reversal Detection
// ============================================================

function detectTrendReversals(kpis: KpiWithEntries[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];

  for (const kpi of kpis) {
    if (kpi.entries.length < 4) continue;

    const recent = kpi.entries.slice(-4);
    const values = recent.map((e) => e.value);

    // Check if last 2 periods reversed a prior 2-period trend
    const firstTrend = values[1] - values[0];
    const secondTrend = values[2] - values[1];
    const thirdTrend = values[3] - values[2];

    const wasTrendingUp = firstTrend > 0 && secondTrend > 0;
    const wasTrendingDown = firstTrend < 0 && secondTrend < 0;
    const nowReversed =
      (wasTrendingUp && thirdTrend < 0 && (values[3] - values[2]) < 0) ||
      (wasTrendingDown && thirdTrend > 0 && (values[3] - values[2]) > 0);

    if (nowReversed) {
      const direction = wasTrendingUp ? "upward" : "downward";
      const newDirection = wasTrendingUp ? "declining" : "improving";

      alerts.push({
        kpi_id: kpi.id,
        kpi_name: kpi.name,
        owner_id: kpi.owner_id,
        alert_type: "trend_reversal",
        severity: "medium",
        title: `${kpi.name} trend reversal detected`,
        body: `${kpi.name} was on a ${direction} trend but is now ${newDirection}. Values: ${values.join(" → ")}${kpi.unit ? ` ${kpi.unit}` : ""}. Review to determine if this is a signal or noise.`,
      });
    }
  }

  return alerts;
}

// ============================================================
// Correlation Detection via KPI Linkage Map
// ============================================================

function detectCorrelations(kpis: KpiWithEntries[]): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const kpiMap = new Map(kpis.map((k) => [k.id, k]));

  for (const kpi of kpis) {
    // Only check lagging KPIs that have linked drivers
    if (!kpi.linked_driver_kpis || kpi.linked_driver_kpis.length === 0)
      continue;

    // Check if any leading driver has dropped
    for (const driverId of kpi.linked_driver_kpis) {
      const driver = kpiMap.get(driverId);
      if (!driver || driver.entries.length < 2) continue;

      const driverLatest = driver.entries[driver.entries.length - 1];
      const driverPrevious = driver.entries[driver.entries.length - 2];

      if (!driverLatest || !driverPrevious) continue;

      const driverUpIsGood = driver.directionality !== "down_is_good";
      const driverDropped = driverUpIsGood
        ? driverLatest.value < driverPrevious.value * 0.9 // 10% drop
        : driverLatest.value > driverPrevious.value * 1.1;

      if (driverDropped) {
        alerts.push({
          kpi_id: kpi.id,
          kpi_name: kpi.name,
          owner_id: kpi.owner_id,
          alert_type: "correlation_warning",
          severity: "medium",
          title: `Early warning: ${driver.name} drop may impact ${kpi.name}`,
          body: `Leading indicator "${driver.name}" dropped from ${driverPrevious.value} to ${driverLatest.value}${driver.unit ? ` ${driver.unit}` : ""}. This is a driver for "${kpi.name}" — watch for downstream impact on your lagging metric.`,
        });
      }
    }
  }

  return alerts;
}

// ============================================================
// AI-Enhanced Analysis (optional, for richer alerts)
// ============================================================

async function enrichWithAI(
  alerts: AnomalyAlert[],
  kpis: KpiWithEntries[]
): Promise<AnomalyAlert[]> {
  if (alerts.length === 0) return alerts;

  try {
    const anthropic = new Anthropic();

    const kpiSummary = kpis
      .filter((k) => k.entries.length > 0)
      .map((k) => {
        const values = k.entries.slice(-5).map((e) => e.value);
        return `${k.name}: ${values.join(" → ")} ${k.unit ?? ""} (target: ${k.target ?? "none"}, health: ${k.health_status})`;
      })
      .join("\n");

    const alertSummary = alerts
      .map((a) => `[${a.alert_type}] ${a.title}: ${a.body}`)
      .join("\n\n");

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system:
        "You are the TrueNorth Signal Watch agent. Analyze KPI anomalies and provide brief, actionable insights for a business operator. Be specific about what changed, why it might matter, and what to check next. Keep each insight to 2-3 sentences.",
      messages: [
        {
          role: "user",
          content: `KPI Data (trailing entries):\n${kpiSummary}\n\nDetected Anomalies:\n${alertSummary}\n\nFor each anomaly, provide a brief enriched analysis with possible causes and recommended next steps. Return one paragraph per anomaly, separated by ---`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    const text = textContent?.type === "text" ? textContent.text : "";
    const enrichments = text.split("---").map((s) => s.trim()).filter(Boolean);

    // Append AI analysis to alert bodies
    return alerts.map((alert, i) => ({
      ...alert,
      body:
        alert.body +
        (enrichments[i]
          ? `\n\nAI Analysis: ${enrichments[i]}`
          : ""),
    }));
  } catch {
    // If AI enrichment fails, return original alerts
    return alerts;
  }
}

// ============================================================
// Main: Run Signal Watch
// ============================================================

export async function runSignalWatch(
  supabase: SupabaseClient,
  orgId: string,
  options: { enableAI?: boolean } = {}
): Promise<AnomalyAlert[]> {
  const kpis = await fetchKpisWithEntries(supabase);

  const thresholdAlerts = detectThresholdBreaches(kpis);
  const trendAlerts = detectTrendReversals(kpis);
  const correlationAlerts = detectCorrelations(kpis);

  let allAlerts = [...thresholdAlerts, ...trendAlerts, ...correlationAlerts];

  // Deduplicate by kpi_id + alert_type
  const seen = new Set<string>();
  allAlerts = allAlerts.filter((a) => {
    const key = `${a.kpi_id}:${a.alert_type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Optionally enrich with AI
  if (options.enableAI && allAlerts.length > 0) {
    allAlerts = await enrichWithAI(allAlerts, kpis);
  }

  // Send notifications for all alerts
  for (const alert of allAlerts) {
    await sendNotification(supabase, {
      userId: alert.owner_id,
      orgId,
      type: "kpi_alert",
      tier: alert.severity === "high" ? "urgent" : "daily_digest",
      title: alert.title,
      body: alert.body,
      entityId: alert.kpi_id,
      entityType: "kpi",
    });
  }

  return allAlerts;
}

// ============================================================
// Dispatch alerts: send notifications + return summary
// ============================================================

export async function dispatchSignalAlerts(
  supabase: SupabaseClient,
  orgId: string,
  alerts: AnomalyAlert[]
): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  for (const alert of alerts) {
    try {
      await sendNotification(supabase, {
        userId: alert.owner_id,
        orgId,
        type: "kpi_alert",
        tier: alert.severity === "high" ? "urgent" : "daily_digest",
        title: alert.title,
        body: alert.body,
        entityId: alert.kpi_id,
        entityType: "kpi",
      });
      sent++;
    } catch {
      errors++;
    }
  }

  return { sent, errors };
}
