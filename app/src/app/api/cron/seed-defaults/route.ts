import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const DEFAULT_CRON_JOBS = [
  {
    name: "Morning Scoreboard",
    description: "Red and yellow KPIs that need attention",
    schedule: "0 7 * * 1-5",
    query_template: "kpi_scoreboard",
  },
  {
    name: "Weekly Priorities",
    description: "Active bets and upcoming moves for the week",
    schedule: "0 8 * * 1",
    query_template: "weekly_priorities",
  },
  {
    name: "Daily Recap",
    description: "Who posted pulses today and who hasn't",
    schedule: "0 17 * * 1-5",
    query_template: "daily_work_summary",
  },
  {
    name: "Blocker Nag",
    description: "Open blockers sorted by severity",
    schedule: "0 9 * * 1-5",
    query_template: "blocker_report",
  },
  {
    name: "Cockpit Daily",
    description: "Operator cockpit health snapshot",
    schedule: "0 7 * * *",
    query_template: "cockpit_summary",
  },
];

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get org membership and verify admin role
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership || membership.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = membership.organization_id;

  // Check if org already has cron jobs
  const { count } = await supabase
    .from("cron_jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Organization already has cron jobs", skipped: true },
      { status: 200 }
    );
  }

  // Create default cron jobs
  const rows = DEFAULT_CRON_JOBS.map((job) => ({
    organization_id: orgId,
    name: job.name,
    description: job.description,
    schedule: job.schedule,
    query_template: job.query_template,
    enabled: false,
  }));

  const { error } = await supabase.from("cron_jobs").insert(rows);

  if (error) {
    console.error("Failed to seed default cron jobs:", error.message);
    return NextResponse.json({ error: "Failed to seed defaults" }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: rows.length });
}
