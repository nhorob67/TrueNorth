import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sanitizeSearchQuery } from "@/lib/validation";

const SEARCHABLE_TABLES: Record<string, { table: string; nameField: string }> = {
  bet: { table: "bets", nameField: "outcome" },
  kpi: { table: "kpis", nameField: "name" },
  move: { table: "moves", nameField: "title" },
  blocker: { table: "blockers", nameField: "description" },
  decision: { table: "decisions", nameField: "title" },
  commitment: { table: "commitments", nameField: "description" },
  issue: { table: "issues", nameField: "description" },
  todo: { table: "todos", nameField: "title" },
  process: { table: "processes", nameField: "name" },
  idea: { table: "ideas", nameField: "name" },
  content_piece: { table: "content_pieces", nameField: "title" },
};

// Tables that have pg_trgm GIN indexes (from migration 00014)
const TRGM_TABLES = new Set(["kpis", "bets", "ideas", "processes", "content_pieces"]);

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = sanitizeSearchQuery(rawQuery, 200);
  const typesParam = searchParams.get("types") ?? "";
  const types = typesParam ? typesParam.split(",") : Object.keys(SEARCHABLE_TABLES);
  const useFuzzy = searchParams.get("fuzzy") === "1";

  if (query.length < 1) {
    return NextResponse.json([]);
  }

  const results: Array<{ id: string; type: string; label: string; similarity?: number }> = [];

  await Promise.all(
    types
      .filter((t) => SEARCHABLE_TABLES[t])
      .map(async (type) => {
        const { table, nameField } = SEARCHABLE_TABLES[type];

        // If fuzzy search is requested and the table has a trgm index, use similarity()
        if (useFuzzy && TRGM_TABLES.has(table)) {
          const { data } = await supabase.rpc("search_by_similarity", {
            p_table: table,
            p_field: nameField,
            p_query: query,
            p_limit: 5,
          });

          if (data) {
            for (const row of data as Array<{ id: string; label: string; sim: number }>) {
              results.push({
                id: row.id,
                type,
                label: row.label,
                similarity: row.sim,
              });
            }
          }
        } else {
          // Standard ilike search
          const { data } = await supabase
            .from(table)
            .select(`id, ${nameField}`)
            .ilike(nameField, `%${query}%`)
            .limit(5);

          if (data) {
            for (const row of data as unknown as Array<Record<string, unknown>>) {
              results.push({
                id: row.id as string,
                type,
                label: row[nameField] as string,
              });
            }
          }
        }
      })
  );

  // Sort by similarity score (highest first) when fuzzy, otherwise leave as-is
  if (useFuzzy) {
    results.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }

  return NextResponse.json(results.slice(0, 15));
}
