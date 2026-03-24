import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import {
  parseImportText,
  generateStepGuidance,
  type ImportTargetType,
  type StepContext,
} from "@/lib/ai/launch-assistant";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const ctx = await getUserContext(supabase);

    if (!ctx) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      action: "parse" | "guidance";
      text?: string;
      targetType?: ImportTargetType;
      step?: number;
      context?: StepContext;
    };

    if (body.action === "parse") {
      if (!body.text || !body.targetType) {
        return NextResponse.json(
          { error: "text and targetType are required for parse action" },
          { status: 400 }
        );
      }

      const validTypes: ImportTargetType[] = ["kpis", "bets", "filters", "outcomes"];
      if (!validTypes.includes(body.targetType)) {
        return NextResponse.json(
          { error: "targetType must be one of: kpis, bets, filters, outcomes" },
          { status: 400 }
        );
      }

      const result = await parseImportText(body.text, body.targetType);
      return NextResponse.json(result);
    }

    if (body.action === "guidance") {
      if (typeof body.step !== "number" || body.step < 1 || body.step > 10) {
        return NextResponse.json(
          { error: "step must be a number between 1 and 10" },
          { status: 400 }
        );
      }

      const result = await generateStepGuidance(body.step, body.context ?? {});
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "action must be 'parse' or 'guidance'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Launch assistant error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
