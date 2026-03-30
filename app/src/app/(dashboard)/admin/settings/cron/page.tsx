import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CronView } from "./cron-view";
import { UnifiedCronView } from "./unified-cron-view";

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

  // Fetch all data in parallel
  const serviceClient = createServiceClient();
  const [
    { data: cronJobs },
    { data: ventures },
    { data: vercelExecs },
    { data: hermesCrons },
  ] = await Promise.all([
    supabase
      .from("cron_jobs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ventures")
      .select("id, name")
      .eq("organization_id", orgId),
    // Vercel cron executions — use service client (no RLS on this table)
    serviceClient
      .from("vercel_cron_executions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100),
    // Hermes cron jobs for this org
    supabase
      .from("hermes_cron_jobs")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch executions for Discord cron jobs
  const jobIds = (cronJobs ?? []).map((j: Record<string, unknown>) => j.id as string);
  const { data: executions } = jobIds.length > 0
    ? await supabase
        .from("cron_executions")
        .select("*")
        .in("cron_job_id", jobIds)
        .order("started_at", { ascending: false })
        .limit(50)
    : { data: [] };

  // Fetch executions for Hermes cron jobs
  const hermesCronIds = (hermesCrons ?? []).map((j: Record<string, unknown>) => j.id as string);
  const { data: hermesExecs } = hermesCronIds.length > 0
    ? await supabase
        .from("hermes_cron_executions")
        .select("*")
        .in("hermes_cron_job_id", hermesCronIds)
        .order("started_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <UnifiedCronView
      vercelExecs={vercelExecs ?? []}
      hermesCrons={hermesCrons ?? []}
      hermesExecs={hermesExecs ?? []}
      orgId={orgId}
    >
      <CronView
        cronJobs={cronJobs ?? []}
        executions={executions ?? []}
        orgId={orgId}
        ventures={ventures ?? []}
      />
    </UnifiedCronView>
  );
}
