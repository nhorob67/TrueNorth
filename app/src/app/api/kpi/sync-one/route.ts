import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncKpiIntegration } from "@/lib/kpi-integrations/sync";
import type { KpiIntegration } from "@/types/database";

export const dynamic = "force-dynamic";

function revalidateKpiPaths(kpiId: string) {
  revalidatePath("/");
  revalidatePath("/strategy/scoreboard");
  revalidatePath(`/strategy/scoreboard/${kpiId}`);
  revalidatePath(`/strategy/scoreboard/${kpiId}/integrations`);
}

/**
 * POST /api/kpi/sync-one
 *
 * Triggers an immediate sync for a single integration.
 * Body: { "integration_id": "uuid" }
 * Requires authenticated user with access to the KPI.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { integration_id } = body as { integration_id?: string };

    if (!integration_id) {
      return NextResponse.json(
        { error: "Missing integration_id" },
        { status: 400 }
      );
    }

    // Verify user has access to this integration's KPI via RLS
    const { data: integration, error: fetchError } = await supabase
      .from("kpi_integrations")
      .select("*")
      .eq("id", integration_id)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: "Integration not found or access denied" },
        { status: 404 }
      );
    }

    const typedIntegration = integration as KpiIntegration;
    const result = await syncKpiIntegration(supabase, typedIntegration);

    if (result.error) {
      await supabase
        .from("kpi_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: result.error,
        })
        .eq("id", integration_id);

      return NextResponse.json({
        status: "error",
        error: result.error,
      });
    }

    if (result.value === null) {
      await supabase
        .from("kpi_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: "no_data",
          last_sync_error: null,
        })
        .eq("id", integration_id);

      return NextResponse.json({
        status: "no_data",
        value: null,
      });
    }

    // Write synced data — use authenticated client (RLS allows org members)
    const { error: entryError } = await supabase.from("kpi_entries").insert({
      kpi_id: typedIntegration.kpi_id,
      value: result.value,
      recorded_at: new Date().toISOString(),
      source: typedIntegration.integration_type,
    });

    if (entryError) {
      return NextResponse.json(
        { status: "error", error: `Failed to insert kpi_entry: ${entryError.message}` },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("kpis")
      .update({ current_value: result.value })
      .eq("id", typedIntegration.kpi_id);

    if (updateError) {
      return NextResponse.json(
        { status: "error", error: `Failed to update kpi current_value: ${updateError.message}` },
        { status: 500 }
      );
    }

    const { error: syncStatusError } = await supabase
      .from("kpi_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
      })
      .eq("id", integration_id);

    if (syncStatusError) {
      console.error("Failed to update integration sync status:", syncStatusError.message);
    }

    revalidateKpiPaths(typedIntegration.kpi_id);

    return NextResponse.json({
      status: "success",
      value: result.value,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
