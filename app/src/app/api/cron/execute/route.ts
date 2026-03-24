import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { executeCronJob, executeTemplateAdHoc } from "@/lib/cron/engine";
import { validateUuid, sanitizeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = await createClient();

    // Option 1: Execute by job ID
    if (body.jobId) {
      if (!validateUuid(body.jobId)) {
        return NextResponse.json({ error: "jobId must be a valid UUID" }, { status: 400 });
      }
      const result = await executeCronJob(supabase, body.jobId);
      return NextResponse.json(result);
    }

    // Option 2: Ad-hoc execution by template + orgId
    if (body.template && body.orgId) {
      if (!validateUuid(body.orgId)) {
        return NextResponse.json({ error: "orgId must be a valid UUID" }, { status: 400 });
      }
      if (body.ventureId && !validateUuid(body.ventureId)) {
        return NextResponse.json({ error: "ventureId must be a valid UUID" }, { status: 400 });
      }
      const template = sanitizeText(body.template, 100);
      if (!template) {
        return NextResponse.json({ error: "template is required" }, { status: 400 });
      }
      const result = await executeTemplateAdHoc(
        supabase,
        template,
        body.orgId,
        body.ventureId ?? null
      );
      return NextResponse.json({ status: "success", result });
    }

    return NextResponse.json(
      { error: "Provide either { jobId } or { template, orgId }" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
