-- TrueNorth Migration 00014: Performance Indexes & Materialized Views
-- Adds pg_trgm full-text search indexes, composite query-pattern indexes,
-- and a materialized view for KPI aggregation.

-- ============================================================
-- 1. Enable pg_trgm extension for fuzzy / trigram search
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Trigram (GIN) indexes for full-text fuzzy search
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_kpis_name_trgm ON kpis USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bets_outcome_trgm ON bets USING gin(outcome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ideas_name_trgm ON ideas USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_processes_name_trgm ON processes USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_content_pieces_title_trgm ON content_pieces USING gin(title gin_trgm_ops);

-- ============================================================
-- 3. Composite indexes for common query patterns
-- ============================================================

-- Active moves per bet (bet detail page, move lists)
CREATE INDEX IF NOT EXISTS idx_moves_bet_status
  ON moves(bet_id, lifecycle_status)
  WHERE lifecycle_status IN ('not_started', 'in_progress');

-- Recent KPI entries (sparklines, trend charts — last 90 days)
CREATE INDEX IF NOT EXISTS idx_kpi_entries_recent
  ON kpi_entries(kpi_id, recorded_at DESC)
  WHERE recorded_at > now() - interval '90 days';

-- Recent pulses (dashboard feed — last 30 days)
CREATE INDEX IF NOT EXISTS idx_pulses_recent
  ON pulses(organization_id, date DESC)
  WHERE date > now() - interval '30 days';

-- Unread notifications — already exists from 00005 but re-create safely
-- (idx_notifications_unread already exists; skip)

-- Recent AI actions (AI trust dashboard — last 30 days)
CREATE INDEX IF NOT EXISTS idx_ai_actions_recent
  ON ai_actions(organization_id, created_at DESC)
  WHERE created_at > now() - interval '30 days';

-- Scheduled (unpublished) content pieces
CREATE INDEX IF NOT EXISTS idx_content_scheduled
  ON content_pieces(venture_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND lifecycle_status != 'published';

-- Recent meeting logs
CREATE INDEX IF NOT EXISTS idx_meeting_logs_recent
  ON meeting_logs(organization_id, started_at DESC);

-- Active cron jobs per org
CREATE INDEX IF NOT EXISTS idx_cron_jobs_active
  ON cron_jobs(organization_id)
  WHERE enabled = true;

-- ============================================================
-- 4. Materialized view: KPI trailing 90-day aggregation
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_kpi_trailing_90d AS
SELECT
  k.id AS kpi_id,
  k.name,
  k.organization_id,
  k.venture_id,
  k.health_status,
  k.target,
  k.unit,
  k.directionality,
  COUNT(e.id) AS entry_count,
  AVG(e.value) AS avg_value,
  MIN(e.value) AS min_value,
  MAX(e.value) AS max_value,
  MAX(e.recorded_at) AS last_entry_at
FROM kpis k
LEFT JOIN kpi_entries e ON e.kpi_id = k.id AND e.recorded_at > now() - interval '90 days'
WHERE k.lifecycle_status = 'active'
GROUP BY k.id, k.name, k.organization_id, k.venture_id, k.health_status, k.target, k.unit, k.directionality;

CREATE UNIQUE INDEX ON mv_kpi_trailing_90d(kpi_id);

-- ============================================================
-- 5. Refresh function (callable from cron / RPC)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_kpi_materialized_view()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_trailing_90d;
END;
$$;

-- ============================================================
-- 6. Generic fuzzy search RPC (used by /api/entities/search?fuzzy=1)
-- ============================================================
-- Uses dynamic SQL to search any table + field with pg_trgm similarity.
-- The calling API route constrains which tables are allowed.

CREATE OR REPLACE FUNCTION search_by_similarity(
  p_table text,
  p_field text,
  p_query text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(id uuid, label text, sim real)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  allowed_tables text[] := ARRAY['kpis', 'bets', 'ideas', 'processes', 'content_pieces'];
  allowed_fields text[] := ARRAY['name', 'outcome', 'title'];
BEGIN
  -- Validate inputs to prevent SQL injection
  IF NOT (p_table = ANY(allowed_tables)) THEN
    RAISE EXCEPTION 'Table not allowed: %', p_table;
  END IF;
  IF NOT (p_field = ANY(allowed_fields)) THEN
    RAISE EXCEPTION 'Field not allowed: %', p_field;
  END IF;
  IF p_limit < 1 OR p_limit > 50 THEN
    p_limit := 5;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT id, %I::text AS label, similarity(%I, $1) AS sim '
    'FROM public.%I '
    'WHERE similarity(%I, $1) > 0.1 '
    'ORDER BY sim DESC '
    'LIMIT %s',
    p_field, p_field, p_table, p_field, p_limit
  ) USING p_query;
END;
$$;
