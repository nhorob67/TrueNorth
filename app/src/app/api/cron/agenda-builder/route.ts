import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateMeetingAgenda } from "@/lib/ai/agenda-builder";
import { sendNotification } from "@/lib/notifications";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

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

    const { data: orgs, error: orgError } = await supabase
      .from("organizations")
      .select("id");

    if (orgError) {
      return NextResponse.json(
        { error: "Failed to fetch organizations", details: orgError.message },
        { status: 500 }
      );
    }

    const results: Array<{ orgId: string; status: string; agendas: number; error?: string }> = [];

    for (const org of orgs ?? []) {
      try {
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
      } catch (err) {
        results.push({
          orgId: org.id,
          status: "error",
          agendas: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      organizations: results.length,
      totalAgendas: results.reduce((sum, r) => sum + r.agendas, 0),
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
