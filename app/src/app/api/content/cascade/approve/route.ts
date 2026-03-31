import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserContext } from "@/lib/user-context";
import { approveCascadeVariants } from "@/lib/content-cascade-approve";

export const dynamic = "force-dynamic";

/**
 * POST /api/content/cascade/approve
 *
 * Approves a Content Cascade agent task and creates content_pieces
 * from the generated variants. Called from the Cockpit Inbox UI
 * when Nick approves a cascade result.
 *
 * Body: { taskId: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const ctx = await getUserContext(supabase);
  if (!ctx) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { taskId } = (await request.json()) as { taskId?: string };
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Verify the task belongs to this org
  const { data: task } = await serviceClient
    .from("agent_tasks")
    .select("organization_id")
    .eq("id", taskId)
    .single();

  if (!task || task.organization_id !== ctx.orgId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const result = await approveCascadeVariants(serviceClient, taskId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    approved: true,
    createdPieceIds: result.createdPieceIds,
    count: result.createdPieceIds.length,
  });
}
