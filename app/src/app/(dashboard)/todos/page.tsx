import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { TodosView } from "./todos-view";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const supabase = await createClient();
  const userContext = await getUserContext(supabase);

  if (!userContext) {
    return <div className="p-8 text-subtle">Please sign in to view your todos.</div>;
  }

  const { data: todos } = await supabase
    .from("todos")
    .select("*, todo_checklist_items(id, completed)")
    .eq("user_id", userContext.userId)
    .order("completed", { ascending: true })
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const todoIds = (todos ?? []).map((t) => t.id);

  // Fetch comment counts per todo
  const commentCountMap: Record<string, number> = {};
  if (todoIds.length > 0) {
    const { data: commentRows } = await supabase
      .from("comments")
      .select("entity_id")
      .eq("entity_type", "todo")
      .in("entity_id", todoIds);
    if (commentRows) {
      for (const row of commentRows) {
        commentCountMap[row.entity_id] = (commentCountMap[row.entity_id] ?? 0) + 1;
      }
    }
  }

  // Enrich todos with counts
  const enrichedTodos = (todos ?? []).map((t) => {
    const checklist = Array.isArray(t.todo_checklist_items) ? t.todo_checklist_items : [];
    return {
      ...t,
      todo_checklist_items: undefined,
      checklist_total: checklist.length,
      checklist_done: checklist.filter((c: { completed: boolean }) => c.completed).length,
      comment_count: commentCountMap[t.id] ?? 0,
    };
  });

  return <TodosView todos={enrichedTodos} orgId={userContext.orgId} />;
}
