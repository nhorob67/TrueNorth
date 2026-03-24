import { SupabaseClient } from "@supabase/supabase-js";
import { checkStaleness } from "@/lib/staleness";

// ============================================================
// Cron Query Templates
// ============================================================
// Pre-built queries that fetch data and return structured results
// for broadcast via Discord webhooks or inline display.

export interface CronTemplateResult {
  hasData: boolean;
  title: string;
  sections: Array<{
    heading: string;
    items: Array<{
      label: string;
      value: string;
      status?: "green" | "yellow" | "red";
    }>;
  }>;
}

type TemplateFn = (
  supabase: SupabaseClient,
  orgId: string,
  ventureId?: string | null
) => Promise<CronTemplateResult>;

// ============================================================
// KPI Scoreboard — red/yellow KPIs needing attention
// ============================================================

const kpiScoreboard: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("kpis")
    .select("id, name, current_value, target, unit, health_status")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .in("health_status", ["red", "yellow"])
    .order("health_status", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: kpis } = await query;
  const items = (kpis ?? []).map((k) => ({
    label: k.name,
    value: `${k.current_value ?? "N/A"} / ${k.target ?? "N/A"} ${k.unit ?? ""}`.trim(),
    status: k.health_status as "green" | "yellow" | "red",
  }));

  return {
    hasData: items.length > 0,
    title: "KPI Scoreboard — Needs Attention",
    sections: [
      {
        heading: `${items.length} KPI${items.length !== 1 ? "s" : ""} off-track`,
        items,
      },
    ],
  };
};

// ============================================================
// Weekly Priorities — active bets + in-progress/not-started moves due within 7 days
// ============================================================

const weeklyPriorities: TemplateFn = async (supabase, orgId, ventureId) => {
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  let betQuery = supabase
    .from("bets")
    .select("id, outcome, lifecycle_status")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");

  if (ventureId) {
    betQuery = betQuery.eq("venture_id", ventureId);
  }

  const { data: bets } = await betQuery;
  const betIds = (bets ?? []).map((b) => b.id);

  if (betIds.length === 0) {
    return {
      hasData: false,
      title: "Weekly Priorities",
      sections: [],
    };
  }

  const { data: moves } = await supabase
    .from("moves")
    .select("id, title, bet_id, lifecycle_status, due_date")
    .in("bet_id", betIds)
    .in("lifecycle_status", ["in_progress", "not_started"])
    .lte("due_date", sevenDaysOut)
    .gte("due_date", today)
    .order("due_date", { ascending: true });

  const betMap = new Map((bets ?? []).map((b) => [b.id, b.outcome]));
  const grouped = new Map<string, typeof moves>();

  for (const move of moves ?? []) {
    const betName = betMap.get(move.bet_id) ?? "Unknown Bet";
    if (!grouped.has(betName)) grouped.set(betName, []);
    grouped.get(betName)!.push(move);
  }

  const sections = Array.from(grouped.entries()).map(([betName, betMoves]) => ({
    heading: betName,
    items: (betMoves ?? []).map((m) => ({
      label: m.title,
      value: `Due ${m.due_date ?? "TBD"} — ${m.lifecycle_status}`,
      status: m.lifecycle_status === "not_started" ? ("yellow" as const) : undefined,
    })),
  }));

  const totalMoves = (moves ?? []).length;
  return {
    hasData: totalMoves > 0,
    title: "Weekly Priorities",
    sections,
  };
};

// ============================================================
// Daily Work Summary — who posted pulses today vs. who hasn't
// ============================================================

const dailyWorkSummary: TemplateFn = async (supabase, orgId) => {
  const today = new Date().toISOString().split("T")[0];

  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id, user_profiles(full_name)")
    .eq("organization_id", orgId);

  const { data: pulses } = await supabase
    .from("pulses")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("date", today);

  const pulsedUserIds = new Set((pulses ?? []).map((p) => p.user_id));

  const posted: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];
  const missing: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];

  for (const m of members ?? []) {
    const profile = Array.isArray(m.user_profiles)
      ? (m.user_profiles as Array<{ full_name: string }>)[0]
      : (m.user_profiles as { full_name: string } | null);
    const name = profile?.full_name ?? "Unknown";

    if (pulsedUserIds.has(m.user_id)) {
      posted.push({ label: name, value: "Posted", status: "green" });
    } else {
      missing.push({ label: name, value: "No pulse yet", status: "red" });
    }
  }

  const sections = [];
  if (posted.length > 0) {
    sections.push({ heading: `Posted (${posted.length})`, items: posted });
  }
  if (missing.length > 0) {
    sections.push({ heading: `Missing (${missing.length})`, items: missing });
  }

  return {
    hasData: (members ?? []).length > 0,
    title: `Daily Pulse Summary — ${today}`,
    sections,
  };
};

// ============================================================
// Blocker Report — open blockers sorted by severity, with age
// ============================================================

const blockerReport: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("blockers")
    .select("id, description, severity, owner_id, created_at")
    .eq("organization_id", orgId)
    .eq("resolution_state", "open")
    .order("severity", { ascending: false })
    .order("created_at", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: blockers } = await query;

  const items = (blockers ?? []).map((b) => {
    const ageDays = Math.floor(
      (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const status: "green" | "yellow" | "red" =
      b.severity === "critical" || b.severity === "high"
        ? "red"
        : b.severity === "medium"
          ? "yellow"
          : "green";

    return {
      label: (b.description ?? "").slice(0, 80),
      value: `${b.severity} — ${ageDays}d old`,
      status,
    };
  });

  return {
    hasData: items.length > 0,
    title: "Open Blockers Report",
    sections: [
      {
        heading: `${items.length} open blocker${items.length !== 1 ? "s" : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Cockpit Summary — aggregate health snapshot
// ============================================================

const cockpitSummary: TemplateFn = async (supabase, orgId, ventureId) => {
  // Red/yellow KPI count
  let kpiQuery = supabase
    .from("kpis")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .in("health_status", ["red", "yellow"]);
  if (ventureId) kpiQuery = kpiQuery.eq("venture_id", ventureId);
  const { count: offTrackKpis } = await kpiQuery;

  // Open blockers count
  let blockerQuery = supabase
    .from("blockers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("resolution_state", "open");
  if (ventureId) blockerQuery = blockerQuery.eq("venture_id", ventureId);
  const { count: openBlockers } = await blockerQuery;

  // Overdue commitments
  const today = new Date().toISOString().split("T")[0];
  let commitQuery = supabase
    .from("commitments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .lt("due_date", today);
  if (ventureId) commitQuery = commitQuery.eq("venture_id", ventureId);
  const { count: overdueCommitments } = await commitQuery;

  // Members with no pulse today
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", orgId);

  const { data: todayPulses } = await supabase
    .from("pulses")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("date", today);

  const pulsedSet = new Set((todayPulses ?? []).map((p) => p.user_id));
  const missingPulse = (members ?? []).filter((m) => !pulsedSet.has(m.user_id)).length;

  const items = [
    {
      label: "Off-track KPIs",
      value: String(offTrackKpis ?? 0),
      status: (offTrackKpis ?? 0) > 0 ? ("red" as const) : ("green" as const),
    },
    {
      label: "Open Blockers",
      value: String(openBlockers ?? 0),
      status: (openBlockers ?? 0) > 0 ? ("yellow" as const) : ("green" as const),
    },
    {
      label: "Overdue Commitments",
      value: String(overdueCommitments ?? 0),
      status: (overdueCommitments ?? 0) > 0 ? ("red" as const) : ("green" as const),
    },
    {
      label: "Missing Pulse Today",
      value: `${missingPulse} of ${(members ?? []).length}`,
      status: missingPulse > 0 ? ("yellow" as const) : ("green" as const),
    },
  ];

  return {
    hasData: true,
    title: "Cockpit Summary",
    sections: [{ heading: "Health Snapshot", items }],
  };
};

// ============================================================
// Stale Artifacts — artifacts past their update threshold
// ============================================================

const staleArtifacts: TemplateFn = async (supabase, orgId, ventureId) => {
  if (!ventureId) {
    return {
      hasData: false,
      title: "Stale Artifacts",
      sections: [],
    };
  }

  const results = await checkStaleness(supabase, ventureId, orgId);
  const stale = results.filter((a) => a.is_stale);

  const items = stale.map((a) => {
    const overdueDays =
      a.days_since_update !== null
        ? a.days_since_update - a.staleness_threshold_days
        : null;

    return {
      label: a.name,
      value:
        overdueDays !== null && overdueDays > 0
          ? `${overdueDays}d overdue`
          : "needs update",
      status: "red" as const,
    };
  });

  return {
    hasData: items.length > 0,
    title: "Stale Artifacts",
    sections: [
      {
        heading: `${items.length} artifact${items.length !== 1 ? "s" : ""} stale`,
        items,
      },
    ],
  };
};

// ============================================================
// Moves Progress — per-bet move status distribution + overdue milestones
// ============================================================

const movesProgress: TemplateFn = async (supabase, orgId, ventureId) => {
  let betQuery = supabase
    .from("bets")
    .select("id, outcome")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");

  if (ventureId) {
    betQuery = betQuery.eq("venture_id", ventureId);
  }

  const { data: bets } = await betQuery;
  const betIds = (bets ?? []).map((b) => b.id);

  if (betIds.length === 0) {
    return { hasData: false, title: "Moves Progress", sections: [] };
  }

  const { data: moves } = await supabase
    .from("moves")
    .select("id, title, bet_id, lifecycle_status, type, due_date")
    .in("bet_id", betIds)
    .neq("lifecycle_status", "cut");

  const today = new Date().toISOString().split("T")[0];
  const betMap = new Map((bets ?? []).map((b) => [b.id, b.outcome]));

  type MoveRow = { id: string; title: string; bet_id: string; lifecycle_status: string; type: string; due_date: string | null };
  const allMoves = (moves ?? []) as MoveRow[];
  const grouped = new Map<string, MoveRow[]>();
  for (const move of allMoves) {
    const betName = betMap.get(move.bet_id) ?? "Unknown Bet";
    if (!grouped.has(betName)) grouped.set(betName, []);
    grouped.get(betName)!.push(move);
  }

  const sections = Array.from(grouped.entries()).map(([betName, betMoves]) => {
    const shipped = betMoves.filter((m) => m.lifecycle_status === "shipped").length;
    const inProgress = betMoves.filter((m) => m.lifecycle_status === "in_progress").length;
    const notStarted = betMoves.filter((m) => m.lifecycle_status === "not_started").length;
    const overdue = betMoves.filter(
      (m) =>
        m.type === "milestone" &&
        m.due_date &&
        m.due_date < today &&
        m.lifecycle_status !== "shipped"
    ).length;

    const status: "green" | "yellow" | "red" =
      overdue > 0
        ? "red"
        : notStarted > (shipped + inProgress + notStarted) * 0.5
          ? "yellow"
          : "green";

    return {
      heading: betName,
      items: [
        {
          label: "Status distribution",
          value: `${shipped} shipped, ${inProgress} in progress, ${notStarted} not started`,
          status,
        },
        ...(overdue > 0
          ? [
              {
                label: "Overdue milestones",
                value: `${overdue} past due date`,
                status: "red" as const,
              },
            ]
          : []),
      ],
    };
  });

  return {
    hasData: sections.length > 0,
    title: "Moves Progress",
    sections,
  };
};

// ============================================================
// Rhythm Health — active recurring moves with cycle completion status
// ============================================================

const rhythmHealth: TemplateFn = async (supabase, orgId, ventureId) => {
  let moveQuery = supabase
    .from("moves")
    .select("id, title, bet_id, cadence, target_per_cycle, health_status, bets(outcome)")
    .eq("organization_id", orgId)
    .eq("type", "recurring")
    .in("lifecycle_status", ["not_started", "in_progress"]);

  if (ventureId) {
    moveQuery = moveQuery.eq("venture_id", ventureId);
  }

  const { data: moves } = await moveQuery;

  if (!moves || moves.length === 0) {
    return { hasData: false, title: "Rhythm Health", sections: [] };
  }

  const today = new Date().toISOString().split("T")[0];
  const moveIds = moves.map((m) => m.id);

  // Fetch recent instances for these moves
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: instances } = await supabase
    .from("move_instances")
    .select("move_id, status, cycle_start, cycle_end")
    .in("move_id", moveIds)
    .gte("cycle_end", thirtyDaysAgo);

  const instancesByMove = new Map<string, Array<{ status: string; cycle_start: string; cycle_end: string }>>();
  for (const inst of instances ?? []) {
    if (!instancesByMove.has(inst.move_id)) instancesByMove.set(inst.move_id, []);
    instancesByMove.get(inst.move_id)!.push(inst);
  }

  const items = moves.map((move) => {
    const moveInstances = instancesByMove.get(move.id) ?? [];
    const total = moveInstances.length;
    const completed = moveInstances.filter((i) => i.status === "completed").length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const bets = Array.isArray(move.bets)
      ? (move.bets as Array<{ outcome: string }>)[0]
      : (move.bets as { outcome: string } | null);

    const status: "green" | "yellow" | "red" =
      move.health_status === "red"
        ? "red"
        : move.health_status === "yellow" || rate < 50
          ? "yellow"
          : "green";

    return {
      label: `${move.title}${bets ? ` (${bets.outcome})` : ""}`,
      value: `${move.cadence ?? "—"} · ${rate}% completion (${completed}/${total})`,
      status,
    };
  });

  // Separate healthy from unhealthy
  const unhealthy = items.filter((i) => i.status === "red" || i.status === "yellow");
  const healthy = items.filter((i) => i.status === "green");

  const sections = [];
  if (unhealthy.length > 0) {
    sections.push({
      heading: `${unhealthy.length} rhythm${unhealthy.length !== 1 ? "s" : ""} need attention`,
      items: unhealthy,
    });
  }
  if (healthy.length > 0) {
    sections.push({
      heading: `${healthy.length} rhythm${healthy.length !== 1 ? "s" : ""} on track`,
      items: healthy,
    });
  }

  return {
    hasData: items.length > 0,
    title: "Rhythm Health",
    sections,
  };
};

// ============================================================
// KPI Single — detailed view of all active KPIs for a venture
// ============================================================

const kpiSingle: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("kpis")
    .select("id, name, current_value, target, unit, health_status, updated_at")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .order("health_status", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: kpis } = await query;

  if (!kpis || kpis.length === 0) {
    return { hasData: false, title: "KPI Detail View", sections: [] };
  }

  const items = kpis.map((k) => {
    const lastDate = k.updated_at
      ? new Date(k.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "N/A";
    return {
      label: (k.name ?? "").slice(0, 50),
      value: `${k.current_value ?? "N/A"} / ${k.target ?? "N/A"} ${k.unit ?? ""} · last ${lastDate}`.trim(),
      status: (k.health_status ?? "green") as "green" | "yellow" | "red",
    };
  });

  return {
    hasData: true,
    title: "KPI Detail View",
    sections: [
      {
        heading: `${items.length} active KPI${items.length !== 1 ? "s" : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Bet Status — active bets health overview
// ============================================================

const betStatus: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("bets")
    .select("id, outcome, health_status, owner_id, user_profiles:owner_id(full_name)")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .order("health_status", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: bets } = await query;

  if (!bets || bets.length === 0) {
    return { hasData: false, title: "Bet Status Overview", sections: [] };
  }

  const betIds = bets.map((b) => b.id);

  // Fetch move counts per bet
  const { data: moves } = await supabase
    .from("moves")
    .select("bet_id, lifecycle_status")
    .in("bet_id", betIds)
    .neq("lifecycle_status", "cut");

  const moveCounts = new Map<string, { shipped: number; total: number }>();
  for (const m of moves ?? []) {
    if (!moveCounts.has(m.bet_id)) moveCounts.set(m.bet_id, { shipped: 0, total: 0 });
    const counts = moveCounts.get(m.bet_id)!;
    counts.total++;
    if (m.lifecycle_status === "shipped") counts.shipped++;
  }

  const items = bets.map((b) => {
    const profile = Array.isArray(b.user_profiles)
      ? (b.user_profiles as Array<{ full_name: string }>)[0]
      : (b.user_profiles as { full_name: string } | null);
    const owner = profile?.full_name ?? "Unassigned";
    const counts = moveCounts.get(b.id) ?? { shipped: 0, total: 0 };

    return {
      label: ((b.outcome ?? "") as string).slice(0, 50),
      value: `${b.health_status} · ${counts.shipped}/${counts.total} moves shipped · ${owner}`,
      status: (b.health_status ?? "green") as "green" | "yellow" | "red",
    };
  });

  return {
    hasData: true,
    title: "Bet Status Overview",
    sections: [
      {
        heading: `${items.length} active bet${items.length !== 1 ? "s" : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Idea Vault New — ideas in quarantine or filter review
// ============================================================

const ideaVaultNew: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("ideas")
    .select("id, name, classification, cooling_expires_at, lifecycle_status, submitted_at")
    .eq("organization_id", orgId)
    .in("lifecycle_status", ["quarantine", "filter_review"])
    .order("cooling_expires_at", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: ideas } = await query;

  if (!ideas || ideas.length === 0) {
    return { hasData: false, title: "Idea Vault — New Ideas", sections: [] };
  }

  const now = Date.now();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

  const items = ideas.map((idea) => {
    const daysInQuarantine = Math.floor(
      (now - new Date(idea.submitted_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const expiresAt = idea.cooling_expires_at
      ? new Date(idea.cooling_expires_at).getTime()
      : null;
    const aboutToExit = expiresAt !== null && expiresAt - now <= twoDaysMs && expiresAt > now;
    const expired = expiresAt !== null && expiresAt <= now;

    const coolingLabel = expired
      ? "cooling complete"
      : aboutToExit
        ? "exits soon"
        : `${daysInQuarantine}d in quarantine`;

    const status: "green" | "yellow" | "red" = expired
      ? "green"
      : aboutToExit
        ? "yellow"
        : "red";

    return {
      label: (idea.name ?? "").slice(0, 50),
      value: `${idea.classification ?? "unclassified"} · ${idea.lifecycle_status} · ${coolingLabel}`,
      status,
    };
  });

  const exitingSoon = items.filter((i) => i.status === "yellow").length;
  const sections = [
    {
      heading: `${items.length} idea${items.length !== 1 ? "s" : ""} in pipeline${exitingSoon > 0 ? ` (${exitingSoon} exiting soon)` : ""}`,
      items,
    },
  ];

  return {
    hasData: true,
    title: "Idea Vault — New Ideas",
    sections,
  };
};

// ============================================================
// Funnel Health — funnel registry health check
// ============================================================

const funnelHealth: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("funnels")
    .select("id, name, health_status, owner_id, last_result_at, user_profiles:owner_id(full_name)")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active")
    .order("health_status", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: funnels } = await query;

  if (!funnels || funnels.length === 0) {
    return { hasData: false, title: "Funnel Health", sections: [] };
  }

  const items = funnels.map((f) => {
    const profile = Array.isArray(f.user_profiles)
      ? (f.user_profiles as Array<{ full_name: string }>)[0]
      : (f.user_profiles as { full_name: string } | null);
    const owner = profile?.full_name ?? "Unassigned";
    const lastResult = f.last_result_at
      ? new Date(f.last_result_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "never";

    const status: "green" | "yellow" | "red" =
      f.health_status === "orphaned" || f.health_status === "stalled"
        ? "red"
        : f.health_status === "underperforming"
          ? "yellow"
          : "green";

    return {
      label: (f.name ?? "").slice(0, 50),
      value: `${f.health_status} · ${owner} · last result ${lastResult}`,
      status,
    };
  });

  const unhealthy = items.filter((i) => i.status !== "green").length;

  return {
    hasData: true,
    title: "Funnel Health",
    sections: [
      {
        heading: `${items.length} funnel${items.length !== 1 ? "s" : ""}${unhealthy > 0 ? ` (${unhealthy} need attention)` : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Pulse Streaks — team pulse streak leaderboard
// ============================================================

const pulseStreaks: TemplateFn = async (supabase, orgId) => {
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id, user_profiles(full_name, pulse_streak)")
    .eq("organization_id", orgId);

  if (!members || members.length === 0) {
    return { hasData: false, title: "Pulse Streak Leaderboard", sections: [] };
  }

  const items = members
    .map((m) => {
      const profile = Array.isArray(m.user_profiles)
        ? (m.user_profiles as Array<{ full_name: string; pulse_streak: number }>)[0]
        : (m.user_profiles as { full_name: string; pulse_streak: number } | null);
      const name = profile?.full_name ?? "Unknown";
      const streak = profile?.pulse_streak ?? 0;

      const status: "green" | "yellow" | "red" =
        streak > 5 ? "green" : streak >= 1 ? "yellow" : "red";

      return {
        label: name.slice(0, 50),
        value: `${streak} day${streak !== 1 ? "s" : ""}`,
        status,
        _streak: streak,
      };
    })
    .sort((a, b) => b._streak - a._streak)
    .map(({ _streak: _, ...rest }) => rest);

  return {
    hasData: true,
    title: "Pulse Streak Leaderboard",
    sections: [
      {
        heading: `${items.length} team member${items.length !== 1 ? "s" : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Commitment Tracker — commitments due this week or overdue
// ============================================================

const commitmentTracker: TemplateFn = async (supabase, orgId, ventureId) => {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysOut = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let query = supabase
    .from("commitments")
    .select("id, description, owner_id, due_date, status, user_profiles:owner_id(full_name)")
    .eq("organization_id", orgId)
    .in("status", ["pending", "in_progress"])
    .lte("due_date", sevenDaysOut)
    .order("due_date", { ascending: true });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: commitments } = await query;

  if (!commitments || commitments.length === 0) {
    return { hasData: false, title: "Commitment Tracker", sections: [] };
  }

  const overdue: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];
  const dueToday: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];
  const upcoming: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];

  for (const c of commitments) {
    const profile = Array.isArray(c.user_profiles)
      ? (c.user_profiles as Array<{ full_name: string }>)[0]
      : (c.user_profiles as { full_name: string } | null);
    const owner = profile?.full_name ?? "Unassigned";
    const dueDate = c.due_date
      ? new Date(c.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "No date";

    const item = {
      label: ((c.description ?? "") as string).slice(0, 50),
      value: `${owner} · due ${dueDate}`,
    };

    if (c.due_date && c.due_date < today) {
      overdue.push({ ...item, status: "red" as const });
    } else if (c.due_date === today) {
      dueToday.push({ ...item, status: "yellow" as const });
    } else {
      upcoming.push({ ...item, status: "green" as const });
    }
  }

  const sections = [];
  if (overdue.length > 0) {
    sections.push({ heading: `${overdue.length} overdue`, items: overdue });
  }
  if (dueToday.length > 0) {
    sections.push({ heading: `${dueToday.length} due today`, items: dueToday });
  }
  if (upcoming.length > 0) {
    sections.push({ heading: `${upcoming.length} upcoming this week`, items: upcoming });
  }

  return {
    hasData: true,
    title: "Commitment Tracker",
    sections,
  };
};

// ============================================================
// Content Pipeline — content pieces by lifecycle stage
// ============================================================

const contentPipeline: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("content_pieces")
    .select("id, title, lifecycle_status")
    .eq("organization_id", orgId);

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: pieces } = await query;

  if (!pieces || pieces.length === 0) {
    return { hasData: false, title: "Content Pipeline", sections: [] };
  }

  const stages = ["ideation", "drafting", "review", "scheduled", "published"] as const;
  const counts: Record<string, number> = {};
  for (const s of stages) counts[s] = 0;

  for (const p of pieces) {
    const stage = p.lifecycle_status as string;
    if (stage in counts) {
      counts[stage]++;
    }
  }

  const items = stages.map((stage) => {
    let status: "green" | "yellow" | "red" = "green";
    if (stage === "scheduled" && counts[stage] === 0) status = "red";
    if (stage === "review" && counts[stage] > 3) status = "yellow";

    return {
      label: stage.charAt(0).toUpperCase() + stage.slice(1),
      value: `${counts[stage]} piece${counts[stage] !== 1 ? "s" : ""}`,
      status,
    };
  });

  const hasFlag = counts["scheduled"] === 0 || counts["review"] > 3;

  return {
    hasData: true,
    title: "Content Pipeline",
    sections: [
      {
        heading: `${pieces.length} total pieces${hasFlag ? " — needs attention" : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Kill Switch Report — bet execution assessment
// ============================================================

const killSwitchReport: TemplateFn = async (supabase, orgId, ventureId) => {
  let betQuery = supabase
    .from("bets")
    .select("id, outcome, health_status, created_at")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");

  if (ventureId) {
    betQuery = betQuery.eq("venture_id", ventureId);
  }

  const { data: bets } = await betQuery;

  if (!bets || bets.length === 0) {
    return { hasData: false, title: "Kill Switch Report", sections: [] };
  }

  const betIds = bets.map((b) => b.id);

  // Fetch moves for progress calculation
  const { data: moves } = await supabase
    .from("moves")
    .select("bet_id, lifecycle_status, type, cadence")
    .in("bet_id", betIds)
    .neq("lifecycle_status", "cut");

  // Fetch open blockers per bet
  const { data: blockers } = await supabase
    .from("blockers")
    .select("id, linked_entity_id")
    .eq("organization_id", orgId)
    .eq("resolution_state", "open");

  const movesByBet = new Map<string, Array<{ lifecycle_status: string; type: string; cadence: string | null }>>();
  for (const m of moves ?? []) {
    if (!movesByBet.has(m.bet_id)) movesByBet.set(m.bet_id, []);
    movesByBet.get(m.bet_id)!.push(m);
  }

  const blockersByEntity = new Map<string, number>();
  for (const b of blockers ?? []) {
    if (b.linked_entity_id) {
      blockersByEntity.set(b.linked_entity_id, (blockersByEntity.get(b.linked_entity_id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  const concerning: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];
  const healthy: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];

  for (const bet of bets) {
    const betMoves = movesByBet.get(bet.id) ?? [];
    const total = betMoves.length;
    const shipped = betMoves.filter((m) => m.lifecycle_status === "shipped").length;
    const progressPct = total > 0 ? Math.round((shipped / total) * 100) : 0;
    const blockerCount = blockersByEntity.get(bet.id) ?? 0;
    const ageWeeks = Math.floor(
      (now - new Date(bet.created_at).getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    const recurringMoves = betMoves.filter((m) => m.type === "recurring").length;
    const rhythmCompliance = total > 0
      ? `${recurringMoves} recurring`
      : "no moves";

    const isStalled = total > 0 && shipped === 0 && ageWeeks > 2;
    const hasManyBlockers = blockerCount >= 3;
    const isRed = bet.health_status === "red";

    const signals: string[] = [];
    if (isStalled) signals.push("stalled");
    if (hasManyBlockers) signals.push(`${blockerCount} blockers`);
    if (isRed) signals.push("red health");

    const item = {
      label: ((bet.outcome ?? "") as string).slice(0, 50),
      value: `${progressPct}% shipped · ${rhythmCompliance} · ${ageWeeks}w old${signals.length > 0 ? ` · ${signals.join(", ")}` : ""}`,
    };

    if (signals.length > 0) {
      concerning.push({
        ...item,
        status: signals.length >= 2 || isRed ? "red" : "yellow",
      });
    } else {
      healthy.push({ ...item, status: "green" });
    }
  }

  const sections = [];
  if (concerning.length > 0) {
    sections.push({
      heading: `${concerning.length} bet${concerning.length !== 1 ? "s" : ""} with concerning signals`,
      items: concerning,
    });
  }
  if (healthy.length > 0) {
    sections.push({
      heading: `${healthy.length} bet${healthy.length !== 1 ? "s" : ""} executing well`,
      items: healthy,
    });
  }

  return {
    hasData: sections.length > 0,
    title: "Kill Switch Report",
    sections,
  };
};

// ============================================================
// Decision Log — recent decisions from last 30 days
// ============================================================

const decisionLog: TemplateFn = async (supabase, orgId) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: decisions } = await supabase
    .from("decisions")
    .select("id, title, decided_at, owner_id, created_at, user_profiles:owner_id(full_name)")
    .eq("organization_id", orgId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  if (!decisions || decisions.length === 0) {
    return { hasData: false, title: "Decision Log", sections: [] };
  }

  const decided: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];
  const pending: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];

  for (const d of decisions) {
    const profile = Array.isArray(d.user_profiles)
      ? (d.user_profiles as Array<{ full_name: string }>)[0]
      : (d.user_profiles as { full_name: string } | null);
    const who = profile?.full_name ?? "Unknown";
    const dateStr = (d.decided_at ?? d.created_at)
      ? new Date(d.decided_at ?? d.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "N/A";

    const item = {
      label: ((d.title ?? "") as string).slice(0, 50),
      value: `${who} · ${dateStr}`,
    };

    if (d.decided_at) {
      decided.push({ ...item, status: "green" });
    } else {
      pending.push({ ...item, status: "yellow" });
    }
  }

  const sections = [];
  if (pending.length > 0) {
    sections.push({ heading: `${pending.length} pending decision${pending.length !== 1 ? "s" : ""}`, items: pending });
  }
  if (decided.length > 0) {
    sections.push({ heading: `${decided.length} decided`, items: decided });
  }

  return {
    hasData: true,
    title: "Decision Log — Last 30 Days",
    sections,
  };
};

// ============================================================
// Portfolio Summary — cross-venture overview
// ============================================================

const portfolioSummary: TemplateFn = async (supabase, orgId, ventureId) => {
  // If ventureId is provided, this template isn't useful — it's a cross-venture view
  let ventureQuery = supabase
    .from("ventures")
    .select("id, name")
    .eq("organization_id", orgId);

  if (ventureId) {
    ventureQuery = ventureQuery.eq("id", ventureId);
  }

  const { data: ventures } = await ventureQuery;

  if (!ventures || ventures.length === 0) {
    return { hasData: false, title: "Portfolio Summary", sections: [] };
  }

  const sections = [];

  for (const venture of ventures) {
    // Active bets
    const { count: activeBets } = await supabase
      .from("bets")
      .select("id", { count: "exact", head: true })
      .eq("venture_id", venture.id)
      .eq("lifecycle_status", "active");

    // Red KPIs
    const { count: redKpis } = await supabase
      .from("kpis")
      .select("id", { count: "exact", head: true })
      .eq("venture_id", venture.id)
      .eq("lifecycle_status", "active")
      .eq("health_status", "red");

    // Open blockers
    const { count: openBlockers } = await supabase
      .from("blockers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("venture_id", venture.id)
      .eq("resolution_state", "open");

    // Today's pulses (org-wide, not per-venture, but we count for context)
    const today = new Date().toISOString().split("T")[0];
    const { count: pulseCount } = await supabase
      .from("pulses")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("date", today);

    const betsVal = activeBets ?? 0;
    const redVal = redKpis ?? 0;
    const blockersVal = openBlockers ?? 0;

    const status: "green" | "yellow" | "red" =
      redVal > 0 || blockersVal >= 3
        ? "red"
        : blockersVal > 0
          ? "yellow"
          : "green";

    sections.push({
      heading: (venture.name ?? "").slice(0, 50),
      items: [
        {
          label: "Active bets",
          value: String(betsVal),
          status: betsVal > 0 ? ("green" as const) : ("yellow" as const),
        },
        {
          label: "Red KPIs",
          value: String(redVal),
          status: redVal > 0 ? ("red" as const) : ("green" as const),
        },
        {
          label: "Open blockers",
          value: String(blockersVal),
          status: blockersVal > 0 ? ("yellow" as const) : ("green" as const),
        },
        {
          label: "Pulses today",
          value: String(pulseCount ?? 0),
          status: (pulseCount ?? 0) > 0 ? ("green" as const) : ("yellow" as const),
        },
      ],
    });

    // Add an overall status item at the start
    sections[sections.length - 1].items.unshift({
      label: "Overall health",
      value: status,
      status,
    });
  }

  return {
    hasData: sections.length > 0,
    title: "Portfolio Summary",
    sections,
  };
};

// ============================================================
// Cadence Compliance — meeting cadence tracking
// ============================================================

const cadenceCompliance: TemplateFn = async (supabase, orgId, ventureId) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString();

  let query = supabase
    .from("meeting_logs")
    .select("id, meeting_type, started_at")
    .eq("organization_id", orgId)
    .gte("started_at", thirtyDaysAgo)
    .order("started_at", { ascending: false });

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: meetings } = await query;

  // Group meetings by type and count
  const meetingsByType = new Map<string, string[]>();
  for (const m of meetings ?? []) {
    const type = m.meeting_type ?? "unknown";
    if (!meetingsByType.has(type)) meetingsByType.set(type, []);
    meetingsByType.get(type)!.push(m.started_at);
  }

  if (meetingsByType.size === 0) {
    return {
      hasData: false,
      title: "Cadence Compliance",
      sections: [],
    };
  }

  // Expected cadences: weekly sync should happen ~4 times in 30 days
  const expectedWeekly = 4;

  const items: Array<{ label: string; value: string; status?: "green" | "yellow" | "red" }> = [];

  for (const [type, dates] of meetingsByType.entries()) {
    const count = dates.length;
    const typeName = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // Determine compliance based on type
    let expected = expectedWeekly; // default assumption
    if (type.includes("daily")) expected = 20; // ~20 weekdays in 30 days
    if (type.includes("monthly")) expected = 1;
    if (type.includes("biweekly")) expected = 2;

    const compliance = Math.min(100, Math.round((count / expected) * 100));
    const status: "green" | "yellow" | "red" =
      compliance >= 75 ? "green" : compliance >= 50 ? "yellow" : "red";

    items.push({
      label: typeName,
      value: `${count} sessions · ${compliance}% compliance`,
      status,
    });
  }

  // Also check pulse compliance
  const today = new Date().toISOString().split("T")[0];
  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", orgId);

  const { data: todayPulses } = await supabase
    .from("pulses")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("date", today);

  const totalMembers = (members ?? []).length;
  const pulsed = (todayPulses ?? []).length;
  const pulseRate = totalMembers > 0 ? Math.round((pulsed / totalMembers) * 100) : 0;

  items.push({
    label: "Pulse Compliance (today)",
    value: `${pulsed}/${totalMembers} · ${pulseRate}%`,
    status: pulseRate >= 75 ? "green" : pulseRate >= 50 ? "yellow" : "red",
  });

  const missedCadences = items.filter((i) => i.status === "red").length;

  return {
    hasData: true,
    title: "Cadence Compliance",
    sections: [
      {
        heading: `${items.length} cadence${items.length !== 1 ? "s" : ""} tracked${missedCadences > 0 ? ` (${missedCadences} below target)` : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Automation Ladder — process count per level + L0 candidates
// ============================================================

const automationLadder: TemplateFn = async (supabase, orgId, ventureId) => {
  let query = supabase
    .from("processes")
    .select("id, name, automation_level, lifecycle_status, owner_id")
    .eq("organization_id", orgId)
    .eq("lifecycle_status", "active");

  if (ventureId) {
    query = query.eq("venture_id", ventureId);
  }

  const { data: processes } = await query;
  const all = processes ?? [];

  // Count per level
  const counts = [0, 0, 0, 0, 0];
  for (const p of all) {
    const level = Math.min(4, Math.max(0, p.automation_level as number));
    counts[level]++;
  }

  const distributionItems = counts.map((count, level) => ({
    label: `L${level} ${
      level === 0 ? "Manual" : level === 1 ? "Assisted" : level === 2 ? "Partial" : level === 3 ? "Conditional" : "Full"
    }`,
    value: `${count} process${count !== 1 ? "es" : ""}`,
    status: level === 0 && count > 0 ? ("yellow" as const) : ("green" as const),
  }));

  // L0 processes that could potentially be advanced
  const l0Processes = all.filter((p) => (p.automation_level as number) === 0);
  const candidateItems = l0Processes.slice(0, 10).map((p) => ({
    label: p.name as string,
    value: "L0 — Manual (consider advancing)",
    status: "yellow" as const,
  }));

  const sections = [
    { heading: "Distribution", items: distributionItems },
  ];

  if (candidateItems.length > 0) {
    sections.push({
      heading: `${candidateItems.length} L0 Process${candidateItems.length !== 1 ? "es" : ""} — Candidates for Advancement`,
      items: candidateItems,
    });
  }

  return {
    hasData: all.length > 0,
    title: "Automation Ladder",
    sections,
  };
};

// ============================================================
// Agent Performance — per-agent action counts and acceptance rates
// ============================================================

const agentPerformance: TemplateFn = async (supabase, orgId) => {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, automation_level, status")
    .eq("organization_id", orgId)
    .eq("status", "active");

  if (!agents || agents.length === 0) {
    return { hasData: false, title: "Agent Performance", sections: [] };
  }

  const agentIds = agents.map((a) => a.id as string);

  // Fetch ai_actions for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: actions } = await supabase
    .from("ai_actions")
    .select("agent_id, status")
    .in("agent_id", agentIds)
    .gte("created_at", thirtyDaysAgo);

  // Group by agent
  const agentStats = new Map<
    string,
    { total: number; accepted: number; rejected: number }
  >();

  for (const a of actions ?? []) {
    const id = a.agent_id as string;
    if (!agentStats.has(id)) {
      agentStats.set(id, { total: 0, accepted: 0, rejected: 0 });
    }
    const stats = agentStats.get(id)!;
    stats.total++;
    if (a.status === "accepted" || a.status === "applied") stats.accepted++;
    if (a.status === "rejected" || a.status === "dismissed") stats.rejected++;
  }

  const items = agents.map((agent) => {
    const stats = agentStats.get(agent.id as string) ?? {
      total: 0,
      accepted: 0,
      rejected: 0,
    };
    const acceptRate =
      stats.total > 0
        ? Math.round((stats.accepted / stats.total) * 100)
        : 0;
    const status: "green" | "yellow" | "red" =
      acceptRate >= 70 ? "green" : acceptRate >= 40 ? "yellow" : "red";

    return {
      label: `${agent.name} (L${agent.automation_level})`,
      value: `${stats.total} actions, ${acceptRate}% accepted`,
      status: stats.total === 0 ? ("yellow" as const) : status,
    };
  });

  return {
    hasData: items.length > 0,
    title: "Agent Performance (Last 30 Days)",
    sections: [
      {
        heading: `${agents.length} Active Agent${agents.length !== 1 ? "s" : ""}`,
        items,
      },
    ],
  };
};

// ============================================================
// Template Registry
// ============================================================

export const TEMPLATE_REGISTRY: Record<string, { label: string; fn: TemplateFn }> = {
  kpi_scoreboard: { label: "KPI Scoreboard", fn: kpiScoreboard },
  weekly_priorities: { label: "Weekly Priorities", fn: weeklyPriorities },
  daily_work_summary: { label: "Daily Work Summary", fn: dailyWorkSummary },
  blocker_report: { label: "Blocker Report", fn: blockerReport },
  cockpit_summary: { label: "Cockpit Summary", fn: cockpitSummary },
  stale_artifacts: { label: "Stale Artifacts", fn: staleArtifacts },
  moves_progress: { label: "Moves Progress", fn: movesProgress },
  rhythm_health: { label: "Rhythm Health", fn: rhythmHealth },
  kpi_single: { label: "KPI Detail View", fn: kpiSingle },
  bet_status: { label: "Bet Status Overview", fn: betStatus },
  idea_vault_new: { label: "Idea Vault — New Ideas", fn: ideaVaultNew },
  funnel_health: { label: "Funnel Health", fn: funnelHealth },
  pulse_streaks: { label: "Pulse Streak Leaderboard", fn: pulseStreaks },
  commitment_tracker: { label: "Commitment Tracker", fn: commitmentTracker },
  content_pipeline: { label: "Content Pipeline", fn: contentPipeline },
  kill_switch_report: { label: "Kill Switch Report", fn: killSwitchReport },
  decision_log: { label: "Decision Log", fn: decisionLog },
  portfolio_summary: { label: "Portfolio Summary", fn: portfolioSummary },
  cadence_compliance: { label: "Cadence Compliance", fn: cadenceCompliance },
  automation_ladder: { label: "Automation Ladder", fn: automationLadder },
  agent_performance: { label: "Agent Performance", fn: agentPerformance },
};

export function getTemplateNames(): Array<{ value: string; label: string }> {
  return Object.entries(TEMPLATE_REGISTRY).map(([key, { label }]) => ({
    value: key,
    label,
  }));
}

export async function executeTemplate(
  templateKey: string,
  supabase: SupabaseClient,
  orgId: string,
  ventureId?: string | null
): Promise<CronTemplateResult> {
  const template = TEMPLATE_REGISTRY[templateKey];
  if (!template) {
    return {
      hasData: false,
      title: "Unknown Template",
      sections: [
        {
          heading: "Error",
          items: [{ label: "Template not found", value: templateKey }],
        },
      ],
    };
  }
  return template.fn(supabase, orgId, ventureId);
}
