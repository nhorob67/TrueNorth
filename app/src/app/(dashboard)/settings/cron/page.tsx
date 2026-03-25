import { createClient } from "@/lib/supabase/server";
import { CronView } from "./cron-view";

export const dynamic = "force-dynamic";

export default async function CronSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user?.id ?? "")
    .limit(1)
    .single();

  if (!membership || membership.role !== "admin") {
    return (
      <div className="p-8">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Access Denied</h2>
        <p className="mt-2 text-subtle">
          Only administrators can manage cron jobs.
        </p>
      </div>
    );
  }

  const orgId = membership.organization_id;

  const { data: cronJobs } = await supabase
    .from("cron_jobs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  // Fetch last 5 executions per job
  const jobIds = (cronJobs ?? []).map((j: Record<string, unknown>) => j.id as string);
  const { data: executions } = jobIds.length > 0
    ? await supabase
        .from("cron_executions")
        .select("*")
        .in("cron_job_id", jobIds)
        .order("started_at", { ascending: false })
        .limit(50)
    : { data: [] };

  // Fetch ventures for the org (for venture_id dropdown)
  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, name")
    .eq("organization_id", orgId);

  return (
    <CronView
      cronJobs={cronJobs ?? []}
      executions={executions ?? []}
      orgId={orgId}
      ventures={ventures ?? []}
    />
  );
}
