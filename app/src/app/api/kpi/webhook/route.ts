import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateUuid, validateNumericValue, validateWebhookToken, validateDateString } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/kpi/webhook
 *
 * Accepts external data pushes for KPIs with webhook integrations.
 * Headers: Authorization: Bearer <webhook_token>
 * Body: { "kpi_id": "uuid", "value": 42.5, "recorded_at": "2026-03-24T00:00:00Z" }
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    if (!validateWebhookToken(token)) {
      return NextResponse.json(
        { error: "Invalid webhook token format" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { kpi_id, value, recorded_at } = body as {
      kpi_id?: string;
      value?: number;
      recorded_at?: string;
    };

    if (!kpi_id || !validateUuid(kpi_id)) {
      return NextResponse.json(
        { error: "kpi_id must be a valid UUID" },
        { status: 400 }
      );
    }

    const numericValue = validateNumericValue(value);
    if (numericValue === null) {
      return NextResponse.json(
        { error: "value must be a finite number" },
        { status: 400 }
      );
    }

    if (recorded_at !== undefined && !validateDateString(recorded_at)) {
      return NextResponse.json(
        { error: "recorded_at must be a valid ISO 8601 date" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Validate token against the webhook integration config
    const { data: integration, error: intError } = await supabase
      .from("kpi_integrations")
      .select("id, kpi_id, enabled")
      .eq("kpi_id", kpi_id)
      .eq("integration_type", "webhook")
      .eq("enabled", true)
      .single();

    if (intError || !integration) {
      return NextResponse.json(
        { error: "No active webhook integration found for this KPI" },
        { status: 404 }
      );
    }

    // Verify token matches config
    const { data: fullIntegration } = await supabase
      .from("kpi_integrations")
      .select("config")
      .eq("id", integration.id)
      .single();

    const storedToken = (fullIntegration?.config as Record<string, unknown>)
      ?.webhook_token as string | undefined;

    if (!storedToken || storedToken !== token) {
      return NextResponse.json(
        { error: "Invalid webhook token" },
        { status: 401 }
      );
    }

    const recordedAtDate = recorded_at ? new Date(recorded_at).toISOString() : new Date().toISOString();

    // Insert the KPI entry
    const { error: insertError } = await supabase.from("kpi_entries").insert({
      kpi_id,
      value: numericValue,
      recorded_at: recordedAtDate,
      source: "webhook",
    });

    if (insertError) {
      console.error("Webhook KPI insert error:", insertError.message);
      return NextResponse.json(
        { error: "Failed to insert entry" },
        { status: 500 }
      );
    }

    // Update the KPI current_value
    await supabase
      .from("kpis")
      .update({ current_value: numericValue })
      .eq("id", kpi_id);

    // Update last_sync info on the integration
    await supabase
      .from("kpi_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
      })
      .eq("id", integration.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
