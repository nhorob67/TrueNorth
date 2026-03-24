import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/user-context";
import { TodosView } from "./todos-view";

export const dynamic = "force-dynamic";

export default async function TodosPage() {
  const supabase = await createClient();
  const userContext = await getUserContext(supabase);

  if (!userContext) {
    return <div className="p-8 text-warm-gray">Please sign in to view your todos.</div>;
  }

  const { data: todos } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", userContext.userId)
    .order("completed", { ascending: true })
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  return <TodosView todos={todos ?? []} />;
}
