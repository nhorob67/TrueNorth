import type { KpiTier, KpiFrequency, KpiDirectionality } from "@/types/database";

export interface KpiTemplate {
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

