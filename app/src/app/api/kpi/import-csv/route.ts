import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateUuid, validateCsvStructure } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface CsvRow {
  date: string;
  value: number;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have a header row and at least one data row");
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const dateCol = header.findIndex(
    (h) => h === "date" || h === "recorded_at"
  );
  const valueCol = header.findIndex((h) => h === "value");

  if (dateCol === -1 || valueCol === -1) {
    throw new Error(
      'CSV must have "date" (or "recorded_at") and "value" columns'
    );
  }

  const rows: CsvRow[] = [];
  const seenDates = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",").map((c) => c.trim());
    const dateStr = cols[dateCol];
    const valueStr = cols[valueCol];

    if (!dateStr || !valueStr) continue;

    // Validate date
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid date on row ${i + 1}: ${dateStr}`);
    }

    // Validate value
    const value = Number(valueStr);
    if (isNaN(value)) {
      throw new Error(`Invalid value on row ${i + 1}: ${valueStr}`);
    }

    // Check for duplicate dates
    const dateKey = parsed.toISOString().split("T")[0];
    if (seenDates.has(dateKey)) {
      throw new Error(`Duplicate date on row ${i + 1}: ${dateStr}`);
    }
    seenDates.add(dateKey);

    rows.push({ date: parsed.toISOString(), value });
  }

  return rows;
}

/**
 * POST /api/kpi/import-csv
 *
 * Accepts multipart form data with a CSV file and a kpi_id.
 * CSV columns: date (or recorded_at), value
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kpiId = formData.get("kpi_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 5 MB file size limit
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File exceeds 5 MB limit" },
        { status: 413 }
      );
    }

    if (!kpiId || !validateUuid(kpiId)) {
      return NextResponse.json(
        { error: "kpi_id must be a valid UUID" },
        { status: 400 }
      );
    }

    // Verify the KPI exists and user has access
    const { data: kpi, error: kpiError } = await supabase
      .from("kpis")
      .select("id")
      .eq("id", kpiId)
      .single();

    if (kpiError || !kpi) {
      return NextResponse.json(
        { error: "KPI not found or access denied" },
        { status: 404 }
      );
    }

    const csvText = await file.text();

    // Validate CSV structure before parsing
    const csvCheck = validateCsvStructure(csvText, ["value"]);
    if (!csvCheck.valid) {
      return NextResponse.json({ error: csvCheck.error }, { status: 400 });
    }

    let rows: CsvRow[];

    try {
      rows = parseCsv(csvText);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : "CSV parse error";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid data rows found" },
        { status: 400 }
      );
    }

    // Bulk insert entries
    const entries = rows.map((row) => ({
      kpi_id: kpiId,
      value: row.value,
      recorded_at: row.date,
      source: "csv_import",
    }));

    const { error: insertError } = await supabase
      .from("kpi_entries")
      .insert(entries);

    if (insertError) {
      console.error("Failed to insert KPI entries:", insertError.message);
      return NextResponse.json(
        { error: "Failed to insert entries" },
        { status: 500 }
      );
    }

    // Update current_value with the most recent entry
    const sorted = rows.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    await supabase
      .from("kpis")
      .update({ current_value: sorted[0].value })
      .eq("id", kpiId);

    return NextResponse.json({
      success: true,
      imported: rows.length,
    });
  } catch (err) {
    console.error("CSV import error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
