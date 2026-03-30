import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateMeetingAgenda } from "@/lib/ai/agenda-builder";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";
import { logCronExecution } from "@/lib/cron/execution-logger";
import { callVps } from "@/lib/hermes/vps-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/agenda-builder
 *
 * Daily cron (6 AM). Checks each org's ventures for upcoming meetings
 * in the next 48 hours. If found, generates an agenda and notifies admins.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const result = await logCronExecution(
      supabase,
      "/api/cron/agenda-builder",
      "0 6 * * *",
      async () => {
        const { data: orgs, error: orgError } = await supabase
          .from("organizations")
          .select("id");

        if (orgError) {
          throw new Error(`Failed to fetch organizations: ${orgError.message}`);
        }

        const results: Array<{ orgId: string; status: string; agendas: number; error?: string }> = [];

        for (const org of orgs ?? []) {
          try {
            // Check if this agent is Hermes-enabled for this org
            const { data: hermesAgent } = await supabase
              .from("agents")
              .select("hermes_enabled, hermes_profile_name")
              .eq("organization_id", org.id)
              .eq("category", "agenda_builder")
              .single();

            if (hermesAgent?.hermes_enabled && hermesAgent.hermes_profile_name) {
              // Delegate to Hermes VPS — one call per venture
              const { data: ventures } = await supabase
                .from("ventures")
                .select("id")
                .eq("organization_id", org.id);

              let hermesAgendas = 0;
              for (const venture of ventures ?? []) {
                try {
                  const vpsResult = await callVps("/api/trigger", {
                    profile: hermesAgent.hermes_profile_name,
                    orgId: org.id,
                    ventureId: venture.id,
                    mode: "one-shot",
                  }) as Record<string, unknown>;

                  console.log(
                    `Agenda Builder Hermes result for org ${org.id} venture ${venture.id}:`,
                    JSON.stringify(vpsResult)
                  );
                  hermesAgendas++;

                  // TODO: Parse VPS result to extract agenda and dispatch notifications
                  // to admins using sendNotification, matching the legacy path behavior.
                  // For now, the VPS agent handles agenda generation and notification internally.
                } catch (err) {
                  console.error(
                    `Agenda Builder Hermes failed for org ${org.id} venture ${venture.id}:`,
                    err instanceof Error ? err.message : err
                  );
                }
              }

              results.push({ orgId: org.id, status: "hermes", agendas: hermesAgendas });
            } else {
              // Legacy path: existing AI-based agenda generation
              const { data: ventures } = await supabase
                .from("ventures")
                .select("id, settings")
                .eq("organization_id", org.id);

              const { data: admins } = await supabase
                .from("organization_memberships")
                .select("user_id")
                .eq("organization_id", org.id)
                .eq("role", "admin");

              const adminIds = (admins ?? []).map((a) => a.user_id);
              let agendasGenerated = 0;

              for (const venture of ventures ?? []) {
                const settings = (venture.settings ?? {}) as Record<string, unknown>;
                const meetingsToGenerate: Array<"weekly_sync" | "monthly_review" | "quarterly_summit"> = [];

                // Check weekly sync — if within 48h window
                if (settings.weekly_sync_day) {
                  const dayMap: Record<string, number> = {
                    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
                    thursday: 4, friday: 5, saturday: 6,
                  };
                  const targetDay = dayMap[settings.weekly_sync_day as string] ?? -1;
                  if (targetDay >= 0) {
                    const now = new Date();
                    const currentDay = now.getDay();
                    const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
                    if (daysUntil <= 2) {
                      meetingsToGenerate.push("weekly_sync");
                    }
                  }
                }

                // Check monthly review — if within 48h of the 1st
                const now = new Date();
                const dayOfMonth = now.getDate();
                if (dayOfMonth >= 29 || dayOfMonth <= 1) {
                  meetingsToGenerate.push("monthly_review");
                }

                // Check quarterly summit — if within 48h of quarter start
                const month = now.getMonth();
                if ((month === 0 || month === 3 || month === 6 || month === 9) && dayOfMonth <= 2) {
                  meetingsToGenerate.push("quarterly_summit");
                }

                for (const meetingType of meetingsToGenerate) {
                  const agenda = await generateMeetingAgenda(
                    supabase,
                    org.id,
                    venture.id,
                    meetingType
                  );

                  // Store in meeting_logs
                  await supabase.from("meeting_logs").insert({
                    organization_id: org.id,
                    venture_id: venture.id,
                    meeting_type: meetingType,
                    started_at: new Date().toISOString(),
                    output: agenda as unknown as Record<string, unknown>,
                  });

                  // Notify admins
                  const typeLabel = meetingType.replace(/_/g, " ");
                  for (const userId of adminIds) {
                    await sendNotification(supabase, {
                      userId,
                      orgId: org.id,
                      type: "agenda_prepared",
                      tier: "urgent",
                      title: `Meeting agenda prepared for ${typeLabel}`,
                      body: agenda.ai_summary,
                    });
                  }

                  agendasGenerated++;
                }
              }

              results.push({ orgId: org.id, status: "success", agendas: agendasGenerated });
            }
          } catch (err) {
            results.push({
              orgId: org.id,
              status: "error",
              agendas: 0,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }

        return {
          orgsProcessed: results.length,
          summary: {
            organizations: results.length,
            totalAgendas: results.reduce((sum, r) => sum + r.agendas, 0),
            results,
          },
        };
      }
    );

    return NextResponse.json(result.summary ?? { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
