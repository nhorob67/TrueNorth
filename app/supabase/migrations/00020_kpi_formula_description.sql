-- Add formula documentation and template identity columns to KPIs
ALTER TABLE kpis
  ADD COLUMN IF NOT EXISTS formula_description text,
  ADD COLUMN IF NOT EXISTS template_slug text;

-- Prevent duplicate seeded KPIs per venture
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpis_venture_template_slug
  ON kpis (venture_id, template_slug)
  WHERE template_slug IS NOT NULL;
