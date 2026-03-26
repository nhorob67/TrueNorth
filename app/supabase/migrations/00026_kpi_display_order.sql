-- Add display_order column to kpis for user-defined ordering
ALTER TABLE kpis ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Backfill: order existing KPIs by tier then name
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY tier, name) AS rn
  FROM kpis
)
UPDATE kpis SET display_order = ranked.rn
FROM ranked WHERE kpis.id = ranked.id;

-- Index for efficient ordering
CREATE INDEX idx_kpis_display_order ON kpis (display_order);
