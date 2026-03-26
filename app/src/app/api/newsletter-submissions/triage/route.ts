import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUserContext } from "@/lib/user-context";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const ctx = await getCachedUserContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, action } = body as {
      submissionId: string;
      action: "accept" | "park" | "dismiss";
    };

    if (!submissionId || !["accept", "park", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "submissionId and valid action (accept|park|dismiss) are required" },
        { status: 400 }
      );
    }

    // Fetch submission, verify it belongs to user's org
    const { data: submission, error: fetchError } = await supabase
      .from("newsletter_submissions")
      .select("*")
      .eq("id", submissionId)
      .eq("organization_id", ctx.orgId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status !== "pending" && submission.status !== "parked") {
      return NextResponse.json(
        { error: `Submission already ${submission.status}` },
        { status: 409 }
      );
    }

    if (action === "accept") {
      // Create content piece from the submission
      const { data: piece, error: pieceError } = await supabase
        .from("content_pieces")
        .insert({
          organization_id: submission.organization_id,
          venture_id: submission.venture_id,
          title: submission.title,
          machine_type: "newsletter",
          lifecycle_status: "ideation",
          body_json: {
            content: submission.body,
            source: "discord_newsletter_inbox",
            discord_submitter: submission.submitter_discord_name,
          },
          owner_id: ctx.userId,
        })
        .select("id")
        .single();

      if (pieceError) {
        console.error("Failed to create content piece:", pieceError);
        return NextResponse.json(
          { error: "Failed to create content piece" },
          { status: 500 }
        );
      }

      // Update submission status
      const { error: updateError } = await supabase
        .from("newsletter_submissions")
        .update({
          status: "accepted",
          triaged_by: ctx.userId,
          triaged_at: new Date().toISOString(),
          content_piece_id: piece.id,
        })
        .eq("id", submissionId);

      if (updateError) {
        console.error("Failed to update submission:", updateError);
        return NextResponse.json(
          { error: "Content piece created but failed to update submission" },
          { status: 500 }
        );
      }

      return NextResponse.json({ contentPieceId: piece.id });
    }

    // Park or dismiss
    const { error: updateError } = await supabase
      .from("newsletter_submissions")
      .update({
        status: action,
        triaged_by: ctx.userId,
        triaged_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (updateError) {
      console.error("Failed to update submission:", updateError);
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Triage error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
