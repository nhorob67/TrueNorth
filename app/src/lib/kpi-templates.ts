import type { SupabaseClient } from "@supabase/supabase-js";
import type { KpiTier, KpiFrequency, KpiDirectionality } from "@/types/database";

interface KpiTemplate {
  template_slug: string;
  name: string;
  description: string;
  tier: KpiTier;
  frequency: KpiFrequency;
  unit: string;
  directionality: KpiDirectionality;
  formula_description: string;
  linked_template_slugs?: string[];
}

export const KPI_TEMPLATES: KpiTemplate[] = [
  {
    template_slug: "ltm_revenue",
    name: "LTM Revenue",
    description: "Last twelve months revenue",
    tier: "tier1",
    frequency: "monthly",
    unit: "$",
    directionality: "up_is_good",
    formula_description: "SUM(revenue WHERE date >= today - 365 days)",
  },
  {
    template_slug: "ltv90_per_sub",
    name: "LTV₉₀ per Subscriber",
    description: "Average revenue per subscriber within 90 days of signup",
    tier: "tier1",
    frequency: "monthly",
    unit: "$",
    directionality: "up_is_good",
    formula_description:
      "SUM(revenue from cohort within 90 days) / COUNT(subscribers in cohort)",
  },
  {
    template_slug: "cac_per_sub",
    name: "Cost per Subscriber (CAC)",
    description: "Customer acquisition cost per new subscriber",
    tier: "tier2",
    frequency: "weekly",
    unit: "$",
    directionality: "down_is_good",
    formula_description: "total_paid_spend / number_of_subscribers_acquired",
  },
  {
    template_slug: "ltv_cac_ratio",
    name: "LTV₉₀ : CAC Ratio",
    description: "Ratio of 90-day subscriber lifetime value to acquisition cost",
    tier: "tier1",
    frequency: "monthly",
    unit: "x",
    directionality: "up_is_good",
    formula_description: "LTV₉₀ / CAC",
    linked_template_slugs: ["ltv90_per_sub", "cac_per_sub"],
  },
  {
    template_slug: "new_subs_week",
    name: "New Subscribers per Week",
    description: "Count of new subscribers acquired each week",
    tier: "tier2",
    frequency: "weekly",
    unit: "subscribers",
    directionality: "up_is_good",
    formula_description: "COUNT(new_subscribers WHERE date in week)",
  },
  {
    template_slug: "paid_spend_week",
    name: "Paid Spend per Week",
    description: "Total advertising spend per week",
    tier: "tier2",
    frequency: "weekly",
    unit: "$",
    directionality: "target_is_good",
    formula_description: "SUM(ad_spend WHERE date in week)",
  },
  {
    template_slug: "sub_customer_conv_90d",
    name: "Subscriber → Customer Conversion Rate (90-day)",
    description: "Percentage of subscribers who purchase within 90 days",
    tier: "tier1",
    frequency: "monthly",
    unit: "%",
    directionality: "up_is_good",
    formula_description:
      "COUNT(subscribers who purchased within 90 days) / COUNT(total subscribers in cohort)",
  },
  {
    template_slug: "wau_mau",
    name: "WAU / MAU (Community)",
    description: "Weekly active users as a percentage of monthly active users",
    tier: "tier2",
    frequency: "weekly",
    unit: "%",
    directionality: "up_is_good",
    formula_description:
      "COUNT(unique active users in last 7 days) / COUNT(unique active users in last 30 days)",
  },
  {
    template_slug: "posts_replies_24h",
    name: "% of Posts with ≥2 Replies in 24h",
    description: "Community engagement: share of posts receiving meaningful discussion",
    tier: "tier2",
    frequency: "weekly",
    unit: "%",
    directionality: "up_is_good",
    formula_description:
      "COUNT(posts with ≥2 replies within 24h) / COUNT(total posts)",
  },
];

export async function provisionDefaultKpis(
  supabase: SupabaseClient,
  ventureId: string,
  organizationId: string,
  ownerId: string
): Promise<{ created: number; skipped: number }> {
  // Check which template slugs already exist for this venture
  const { data: existing } = await supabase
    .from("kpis")
    .select("template_slug")
    .eq("venture_id", ventureId)
    .not("template_slug", "is", null);

  const existingSlugs = new Set(
    (existing ?? []).map((k: { template_slug: string }) => k.template_slug)
  );

  const toCreate = KPI_TEMPLATES.filter(
    (t) => !existingSlugs.has(t.template_slug)
  );

  if (toCreate.length === 0) {
    return { created: 0, skipped: KPI_TEMPLATES.length };
  }

  // Insert all new KPIs
  const rows = toCreate.map((t) => ({
    organization_id: organizationId,
    venture_id: ventureId,
    owner_id: ownerId,
    name: t.name,
    description: t.description,
    unit: t.unit,
    frequency: t.frequency,
    tier: t.tier,
    directionality: t.directionality,
    formula_description: t.formula_description,
    template_slug: t.template_slug,
    health_status: "green",
    lifecycle_status: "active",
    threshold_logic: {},
    action_playbook: {},
    linked_driver_kpis: [],
  }));

  const { error } = await supabase.from("kpis").insert(rows);
  if (error) throw error;

  // Wire linked_driver_kpis for derived KPIs (e.g., LTV:CAC ratio)
  const templatesWithLinks = toCreate.filter(
    (t) => t.linked_template_slugs && t.linked_template_slugs.length > 0
  );

  if (templatesWithLinks.length > 0) {
    // Fetch all seeded KPIs to resolve slugs → IDs
    const { data: seeded } = await supabase
      .from("kpis")
      .select("id, template_slug")
      .eq("venture_id", ventureId)
      .not("template_slug", "is", null);

    const slugToId = new Map(
      (seeded ?? []).map((k: { id: string; template_slug: string }) => [
        k.template_slug,
        k.id,
      ])
    );

    for (const t of templatesWithLinks) {
      const driverIds = (t.linked_template_slugs ?? [])
        .map((slug) => slugToId.get(slug))
        .filter(Boolean);

      const kpiId = slugToId.get(t.template_slug);
      if (kpiId && driverIds.length > 0) {
        await supabase
          .from("kpis")
          .update({ linked_driver_kpis: driverIds })
          .eq("id", kpiId);
      }
    }
  }

  return {
    created: toCreate.length,
    skipped: KPI_TEMPLATES.length - toCreate.length,
  };
}
