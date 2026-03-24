import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendNotification } from "@/lib/notifications";
import {
  detectMissedInstances,
  generateNewCycleInstances,
  updateRecurringMoveHealth,
} from "@/lib/cron/recurring-moves";

// ============================================================
// Recurring Moves Cron — GET /api/cron/recurring-moves
//
// Runs daily at 1am UTC via Vercel Cron.
// 1. Detect and mark missed instances → send notifications
// 2. Generate new cycle instances for the current period
// 3. Update recurring move health based on rolling completion rate
//
// Protected by CRON_SECRET env var.
// ============================================================

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Authenticate: check for CRON_SECRET in Authorization header
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET environment variable is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Step 1: Detect missed instances and send notifications
    const missed = await detectMissedInstances(supabase);

    for (const m of missed) {
      await sendNotification(supabase, {
        userId: m.ownerId,
        orgId: m.organizationId,
        type: "move_overdue",
        tier: "urgent",
        title: `Recurring move "${m.moveTitle}" missed a cycle`,
        body: `The cycle ending ${m.cycleEnd} was not completed.`,
        entityId: m.moveId,
        entityType: "move",
      });
    }

    // Step 2: Generate new cycle instances
    const generated = await generateNewCycleInstances(supabase);

    // Step 3: Update recurring move health
    await updateRecurringMoveHealth(supabase);

    return NextResponse.json({
      ok: true,
      summary: {
        missed_instances: missed.length,
        cycles_generated: generated.length,
        total_instances_created: generated.reduce(
          (sum, g) => sum + g.instancesCreated,
          0
        ),
      },
      missed: missed.map((m) => ({
        move_id: m.moveId,
        move_title: m.moveTitle,
        cycle_end: m.cycleEnd,
      })),
      generated: generated.map((g) => ({
        move_id: g.moveId,
        move_title: g.moveTitle,
        instances_created: g.instancesCreated,
        cycle_start: g.cycleStart,
        cycle_end: g.cycleEnd,
      })),
    });
  } catch (error) {
    console.error("Recurring moves cron error:", error);
    const message =
      error instanceof Error ? error.message : "Cron job failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
