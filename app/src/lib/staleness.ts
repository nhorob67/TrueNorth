import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Default artifact definitions from TrueNorth PRD
// ============================================================

export interface ArtifactDefinition {
  artifact_type: string;
  name: string;
  update_cadence_days: number;
  staleness_threshold_days: number;
  description: string;
}

export const DEFAULT_ARTIFACTS: ArtifactDefinition[] = [
  {
    artifact_type: "vision_page",
    name: "Vision Page",
    update_cadence_days: 365,
    staleness_threshold_days: 395, // 13 months
    description: "BHAG, strategic filters, annual outcomes, Not Doing list",
  },
  {
    artifact_type: "quarterly_bets",
    name: "Quarterly Bets Page",
    update_cadence_days: 90,
    staleness_threshold_days: 100,
    description: "Active quarterly bets and War Room",
  },
  {
    artifact_type: "scoreboard",
    name: "Scoreboard",
    update_cadence_days: 7,
    staleness_threshold_days: 10,
    description: "KPI values and health statuses",
  },
  {
    artifact_type: "meeting_cadence",
    name: "Meeting Cadence Doc",
    update_cadence_days: 90,
    staleness_threshold_days: 100,
    description: "Weekly sync, monthly review, quarterly summit schedules",
  },
  {
    artifact_type: "role_cards",
    name: "Role Cards",
    update_cadence_days: 90,
    staleness_threshold_days: 100,
    description: "Team member role cards with outcomes and metrics",
  },
  {
    artifact_type: "process_library",
    name: "Process Library",
    update_cadence_days: 60,
    staleness_threshold_days: 60,
    description: "Documented operational processes",
  },
  {
    artifact_type: "media_calendar",
    name: "Media Calendar",
    update_cadence_days: 30,
    staleness_threshold_days: 35,
    description: "Content output plan across all machines",
  },
];

// ============================================================
// Staleness checking
// ============================================================

export interface StalenessResult {
  artifact_type: string;
  name: string;
  owner_id: string | null;
  last_updated_at: string | null;
  staleness_threshold_days: number;
  days_since_update: number | null;
  is_stale: boolean;
}

export async function checkStaleness(
  supabase: SupabaseClient,
  ventureId: string,
  organizationId: string
): Promise<StalenessResult[]> {
  const { data: artifacts } = await supabase
    .from("core_artifacts")
    .select("*")
    .eq("organization_id", organizationId);

  if (!artifacts || artifacts.length === 0) {
    // No artifacts registered yet — compute from live data
    return computeStalenessFromLiveData(supabase, ventureId, organizationId);
  }

  const now = new Date();
  return artifacts.map((a: Record<string, unknown>) => {
    const lastUpdated = a.last_updated_at
      ? new Date(a.last_updated_at as string)
      : null;
    const daysSince = lastUpdated
      ? Math.floor(
          (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;
    const threshold = (a.staleness_threshold_days as number) ?? 30;

    return {
      artifact_type: a.artifact_type as string,
      name: a.name as string,
      owner_id: (a.owner_id as string) ?? null,
      last_updated_at: (a.last_updated_at as string) ?? null,
      staleness_threshold_days: threshold,
      days_since_update: daysSince,
      is_stale: daysSince !== null ? daysSince > threshold : true,
    };
  });
}

async function computeStalenessFromLiveData(
  supabase: SupabaseClient,
  ventureId: string,
  _organizationId: string
): Promise<StalenessResult[]> {
  const results: StalenessResult[] = [];
  const now = new Date();

  // Vision Page — check visions table
  const { data: vision } = await supabase
    .from("visions")
    .select("updated_at")
    .eq("venture_id", ventureId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  results.push(
    buildResult("vision_page", "Vision Page", 395, vision?.updated_at, now)
  );

  // Quarterly Bets — check most recent bet activity
  const { data: latestBet } = await supabase
    .from("bets")
    .select("created_at")
    .eq("venture_id", ventureId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  results.push(
    buildResult("quarterly_bets", "Quarterly Bets Page", 100, latestBet?.created_at, now)
  );

  // Scoreboard — check most recent KPI entry
  const { data: latestEntry } = await supabase
    .from("kpi_entries")
    .select("recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  results.push(
    buildResult("scoreboard", "Scoreboard", 10, latestEntry?.recorded_at, now)
  );

  // Role Cards — check most recent role card update
  const { data: latestRoleCard } = await supabase
    .from("role_cards")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  results.push(
    buildResult("role_cards", "Role Cards", 100, latestRoleCard?.updated_at, now)
  );

  // Meeting Cadence — placeholder (no meetings table yet)
  results.push(
    buildResult("meeting_cadence", "Meeting Cadence Doc", 100, null, now)
  );

  // Process Library — placeholder
  results.push(
    buildResult("process_library", "Process Library", 60, null, now)
  );

  // Media Calendar — placeholder
  results.push(
    buildResult("media_calendar", "Media Calendar", 35, null, now)
  );

  return results;
}

function buildResult(
  artifactType: string,
  name: string,
  thresholdDays: number,
  lastUpdated: string | null | undefined,
  now: Date
): StalenessResult {
  const daysSince = lastUpdated
    ? Math.floor(
        (now.getTime() - new Date(lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return {
    artifact_type: artifactType,
    name,
    owner_id: null,
    last_updated_at: lastUpdated ?? null,
    staleness_threshold_days: thresholdDays,
    days_since_update: daysSince,
    is_stale: daysSince !== null ? daysSince > thresholdDays : true,
  };
}
