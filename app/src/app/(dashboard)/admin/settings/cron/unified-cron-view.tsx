"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VERCEL_CRONS, type VercelCronDefinition } from "@/lib/cron/vercel-registry";
import type { VercelCronExecution, HermesCronJob, HermesCronExecution } from "@/types/database";

type CronSection = "system" | "hermes" | "discord";

const SECTION_LABELS: Record<CronSection, string> = {
  system: "System Crons (Vercel)",
  hermes: "Agent Crons (Hermes)",
  discord: "Discord Broadcast Crons",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "green" | "red" | "yellow" | "neutral"> = {
    success: "green",
    error: "red",
    timeout: "yellow",
    skipped: "neutral",
  };
  return <Badge status={map[status] ?? "neutral"}>{status}</Badge>;
}

function humanSchedule(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, dom, , dow] = parts;

  if (min.startsWith("*/")) return `Every ${min.slice(2)} minutes`;
  if (hour.startsWith("*/")) return `Every ${hour.slice(2)} hours`;
  if (dom !== "*" && dom.includes(",")) return `${dom} of each month at ${hour}:${min.padStart(2, "0")} UTC`;
  if (dow === "1" && dom === "*") return `Mondays at ${hour}:${min.padStart(2, "0")} UTC`;
  if (dom === "1" && hour !== "*") return `1st of month at ${hour}:${min.padStart(2, "0")} UTC`;
  if (hour !== "*" && min !== "*") return `Daily at ${hour}:${min.padStart(2, "0")} UTC`;
  return cron;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ============================================================
// Vercel System Crons Section
// ============================================================

function VercelCronRow({
  cron,
  executions,
}: {
  cron: VercelCronDefinition;
  executions: VercelCronExecution[];
}) {
  const [expanded, setExpanded] = useState(false);
  const cronExecs = executions.filter((e) => e.cron_path === cron.path);
  const lastExec = cronExecs[0];

  return (
    <div className="border-b border-line last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-hovered transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-ink">{cron.name}</p>
            {cron.isAiAgent && (
              <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white">
                AI
              </span>
            )}
          </div>
          <p className="text-xs text-subtle">{cron.description}</p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-mono text-faded">{humanSchedule(cron.schedule)}</span>
          {lastExec ? (
            <>
              <StatusBadge status={lastExec.status} />
              <span className="text-xs text-faded w-16 text-right">{timeAgo(lastExec.started_at)}</span>
            </>
          ) : (
            <span className="text-xs text-faded">No runs</span>
          )}
          <span className="text-xs text-faded">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && cronExecs.length > 0 && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-faded">
                <th className="text-left py-1 font-normal">Started</th>
                <th className="text-left py-1 font-normal">Status</th>
                <th className="text-left py-1 font-normal">Duration</th>
                <th className="text-left py-1 font-normal">Orgs</th>
                <th className="text-left py-1 font-normal">Error</th>
              </tr>
            </thead>
            <tbody>
              {cronExecs.slice(0, 10).map((exec) => (
                <tr key={exec.id} className="border-t border-line/50">
                  <td className="py-1.5 text-subtle">{new Date(exec.started_at).toLocaleString()}</td>
                  <td className="py-1.5"><StatusBadge status={exec.status} /></td>
                  <td className="py-1.5 text-subtle">{exec.duration_ms ? `${exec.duration_ms}ms` : "-"}</td>
                  <td className="py-1.5 text-subtle">{exec.organizations_processed}</td>
                  <td className="py-1.5 text-semantic-brick truncate max-w-[200px]">{exec.error_message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Hermes Agent Crons Section
// ============================================================

function HermesCronRow({
  job,
  executions,
}: {
  job: HermesCronJob;
  executions: HermesCronExecution[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const jobExecs = executions.filter((e) => e.hermes_cron_job_id === job.id);
  const lastExec = jobExecs[0];

  async function handleToggle() {
    setToggling(true);
    await supabase
      .from("hermes_cron_jobs")
      .update({ enabled: !job.enabled })
      .eq("id", job.id);
    setToggling(false);
    router.refresh();
  }

  return (
    <div className="border-b border-line last:border-b-0">
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-sage px-1.5 py-0.5 text-[9px] font-mono text-white">
              {job.agent_profile}
            </span>
            <p className="text-sm font-medium text-ink">{job.name}</p>
          </div>
          {job.prompt && (
            <p className="text-xs text-subtle mt-0.5 truncate max-w-[400px]">{job.prompt}</p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-mono text-faded">{humanSchedule(job.schedule)}</span>
          <span className="text-xs text-faded">{job.delivery_target}</span>
          {lastExec ? (
            <>
              <StatusBadge status={lastExec.status} />
              <span className="text-xs text-faded">{timeAgo(lastExec.started_at)}</span>
            </>
          ) : job.last_run_status ? (
            <>
              <StatusBadge status={job.last_run_status} />
              {job.last_run_at && <span className="text-xs text-faded">{timeAgo(job.last_run_at)}</span>}
            </>
          ) : (
            <span className="text-xs text-faded">No runs</span>
          )}

          {/* Enable/disable toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              job.enabled ? "bg-accent" : "bg-well"
            } ${toggling ? "opacity-50" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                job.enabled ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>

          <button onClick={() => setExpanded(!expanded)} className="text-xs text-faded">
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {expanded && jobExecs.length > 0 && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-faded">
                <th className="text-left py-1 font-normal">Started</th>
                <th className="text-left py-1 font-normal">Status</th>
                <th className="text-left py-1 font-normal">Duration</th>
                <th className="text-left py-1 font-normal">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobExecs.slice(0, 10).map((exec) => (
                <tr key={exec.id} className="border-t border-line/50">
                  <td className="py-1.5 text-subtle">{new Date(exec.started_at).toLocaleString()}</td>
                  <td className="py-1.5"><StatusBadge status={exec.status} /></td>
                  <td className="py-1.5 text-subtle">{exec.duration_ms ? `${exec.duration_ms}ms` : "-"}</td>
                  <td className="py-1.5 text-semantic-brick truncate max-w-[200px]">{exec.error_message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Unified Cron View
// ============================================================

interface UnifiedCronViewProps {
  vercelExecs: VercelCronExecution[];
  hermesCrons: HermesCronJob[];
  hermesExecs: HermesCronExecution[];
  children: React.ReactNode; // Existing CronView component
}

export function UnifiedCronView({
  vercelExecs,
  hermesCrons,
  hermesExecs,
  children,
}: UnifiedCronViewProps) {
  const [activeSection, setActiveSection] = useState<CronSection>("system");

  const sections: CronSection[] = ["system", "hermes", "discord"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-[28px] font-bold tracking-[-0.03em] text-ink">
          Cron & Schedules
        </h2>
        <p className="text-subtle text-sm mt-1">
          Monitor system crons, Hermes agent schedules, and Discord broadcast jobs
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-line">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeSection === section
                ? "border-accent text-ink"
                : "border-transparent text-subtle hover:text-ink"
            }`}
          >
            {SECTION_LABELS[section]}
            {section === "hermes" && hermesCrons.length > 0 && (
              <span className="ml-1.5 text-xs font-mono text-faded">{hermesCrons.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* System Crons */}
      {activeSection === "system" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">
                Vercel System Crons
              </p>
              <span className="text-xs font-mono text-subtle">{VERCEL_CRONS.length} jobs</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {VERCEL_CRONS.map((cron) => (
              <VercelCronRow
                key={cron.path}
                cron={cron}
                executions={vercelExecs}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Hermes Agent Crons */}
      {activeSection === "hermes" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">
                Hermes Agent Cron Jobs
              </p>
              <span className="text-xs font-mono text-subtle">{hermesCrons.length} jobs</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {hermesCrons.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-subtle">No Hermes cron jobs configured.</p>
                <p className="text-xs text-faded mt-1">
                  Hermes agent schedules will appear here once agents are deployed on the VPS.
                </p>
              </div>
            ) : (
              hermesCrons.map((job) => (
                <HermesCronRow
                  key={job.id}
                  job={job}
                  executions={hermesExecs}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Discord Broadcast Crons (existing CronView) */}
      {activeSection === "discord" && children}
    </div>
  );
}
