-- ============================================================
-- Todo Card Enhancements
-- Adds description, labels, position to todos
-- Creates todo_checklist_items table for subtasks
-- ============================================================

-- New columns on todos
ALTER TABLE todos ADD COLUMN description text;
ALTER TABLE todos ADD COLUMN labels text[] NOT NULL DEFAULT '{}';
ALTER TABLE todos ADD COLUMN position integer;

CREATE INDEX idx_todos_position ON todos(user_id, position) WHERE position IS NOT NULL;

-- ============================================================
-- Checklist Items (subtasks within a todo)
-- ============================================================

CREATE TABLE todo_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id uuid NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_todo ON todo_checklist_items(todo_id, position);

ALTER TABLE todo_checklist_items ENABLE ROW LEVEL SECURITY;

-- Owner access
CREATE POLICY "checklist_select" ON todo_checklist_items FOR SELECT USING (
  todo_id IN (SELECT id FROM todos WHERE user_id = auth.uid())
);
CREATE POLICY "checklist_insert" ON todo_checklist_items FOR INSERT WITH CHECK (
  todo_id IN (SELECT id FROM todos WHERE user_id = auth.uid())
);
CREATE POLICY "checklist_update" ON todo_checklist_items FOR UPDATE USING (
  todo_id IN (SELECT id FROM todos WHERE user_id = auth.uid())
);
CREATE POLICY "checklist_delete" ON todo_checklist_items FOR DELETE USING (
  todo_id IN (SELECT id FROM todos WHERE user_id = auth.uid())
);

-- Team visibility: org members can view checklist items on team-visible todos
CREATE POLICY "checklist_select_team" ON todo_checklist_items FOR SELECT USING (
  todo_id IN (
    SELECT id FROM todos WHERE visibility = 'team' AND organization_id IN (
      SELECT organization_id FROM organization_memberships WHERE user_id = auth.uid()
    )
  )
);
