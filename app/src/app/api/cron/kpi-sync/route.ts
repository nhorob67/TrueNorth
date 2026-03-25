import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncKpiIntegration } from "@/lib/kpi-integrations/sync";
import type { KpiIntegration } from "@/types/database";
import { verifyCronSecret } from "@/lib/cron/verify-secret";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/kpi-sync
 *
 * Runs every 4 hours. Fetches all enabled KPI integrations and syncs their data.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Fetch all enabled integrations (exclude webhook and csv — they are push/one-time)
    const { data: integrations, error: fetchError } = await supabase
      .from("kpi_integrations")
      .select("*")
      .eq("enabled", true)
      .in("integration_type", ["stripe", "convertkit", "beehiiv", "discourse"]);

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch integrations", details: fetchError.message },
        { status: 500 }
      );
    }

    const results: Array<{
      integration_id: string;
      kpi_id: string;
      type: string;
      status: string;
      value?: number;
      error?: string;
    }> = [];

    for (const integration of (integrations ?? []) as KpiIntegration[]) {
      const syncResult = await syncKpiIntegration(supabase, integration);

      if (syncResult.error) {
        // Update integration with error status
        await supabase
          .from("kpi_integrations")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "error",
            last_sync_error: syncResult.error,
          })
          .eq("id", integration.id);

        results.push({
          integration_id: integration.id,
          kpi_id: integration.kpi_id,
          type: integration.integration_type,
          status: "error",
          error: syncResult.error,
        });
        continue;
      }

      if (syncResult.value === null) {
        await supabase
          .from("kpi_integrations")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: "no_data",
            last_sync_error: null,
          })
          .eq("id", integration.id);

        results.push({
          integration_id: integration.id,
          kpi_id: integration.kpi_id,
          type: integration.integration_type,
          status: "no_data",
        });
        continue;
      }

      // Insert kpi_entry
      await supabase.from("kpi_entries").insert({
        kpi_id: integration.kpi_id,
        value: syncResult.value,
        recorded_at: new Date().toISOString(),
        source: integration.integration_type,
      });

      // Update the KPI current_value
      await supabase
        .from("kpis")
        .update({ current_value: syncResult.value })
        .eq("id", integration.kpi_id);

      // Update integration sync status
      await supabase
        .from("kpi_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "success",
          last_sync_error: null,
        })
        .eq("id", integration.id);

      results.push({
        integration_id: integration.id,
        kpi_id: integration.kpi_id,
        type: integration.integration_type,
        status: "success",
        value: syncResult.value,
      });
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return NextResponse.json({
      synced: results.length,
      success: successCount,
      errors: errorCount,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
