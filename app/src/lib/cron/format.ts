import type { CronTemplateResult } from "./templates";

// ============================================================
// Simple Handlebars-like Format Template Engine
// ============================================================
// Supports:
//   {{title}}                — the result title
//   {{#each sections}}...{{/each}}  — iterate sections
//   {{heading}}              — section heading
//   {{#each items}}...{{/each}}     — iterate items within a section
//   {{label}}                — item label
//   {{value}}                — item value
//   {{status_emoji}}         — colored circle emoji based on status

const STATUS_EMOJI: Record<string, string> = {
  green: "\uD83D\uDFE2",
  yellow: "\uD83D\uDFE1",
  red: "\uD83D\uDD34",
};

interface TemplateContext {
  [key: string]: unknown;
  title: string;
  sections: Array<{
    heading: string;
    items: Array<{
      label: string;
      value: string;
      status?: string;
      status_emoji: string;
    }>;
  }>;
}

function buildContext(result: CronTemplateResult): TemplateContext {
  return {
    title: result.title,
    sections: result.sections.map((s) => ({
      heading: s.heading,
      items: s.items.map((item) => ({
        label: item.label,
        value: item.value,
        status: item.status ?? "",
        status_emoji: item.status ? (STATUS_EMOJI[item.status] ?? "") : "",
      })),
    })),
  };
}

/**
 * Render a simple Handlebars-like template string against a CronTemplateResult.
 *
 * This is intentionally simple — it supports:
 * - {{variable}} interpolation
 * - {{#each collection}}...{{/each}} iteration
 *
 * The result is returned as a modified CronTemplateResult where the title
 * is replaced with the rendered text (for Discord webhook posting).
 */
export function applyFormatTemplate(
  result: CronTemplateResult,
  template: string
): CronTemplateResult {
  const ctx = buildContext(result);
  const rendered = renderTemplate(template, ctx);

  // Return the result with the formatted title (the rendered text is the full output)
  return {
    ...result,
    title: rendered.split("\n")[0] || result.title,
  };
}

function renderTemplate(
  template: string,
  context: Record<string, unknown>
): string {
  let output = template;

  // Process {{#each ...}}...{{/each}} blocks
  output = processEachBlocks(output, context);

  // Process simple {{variable}} interpolations
  output = interpolateVariables(output, context);

  return output;
}

function processEachBlocks(
  template: string,
  context: Record<string, unknown>
): string {
  // Match {{#each collectionName}}...{{/each}}
  const eachRegex = /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return template.replace(eachRegex, (_match, collectionName: string, body: string) => {
    const collection = context[collectionName];
    if (!Array.isArray(collection)) return "";

    return collection
      .map((item: unknown) => {
        if (typeof item === "object" && item !== null) {
          const itemCtx = item as Record<string, unknown>;
          // Recursively process nested {{#each}} and then interpolate
          let rendered = processEachBlocks(body, itemCtx);
          rendered = interpolateVariables(rendered, itemCtx);
          return rendered;
        }
        return String(item);
      })
      .join("");
  });
}

function interpolateVariables(
  template: string,
  context: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = context[varName];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

// ============================================================
// Preview with mock data
// ============================================================

const MOCK_RESULT: CronTemplateResult = {
  hasData: true,
  title: "KPI Scoreboard - Needs Attention",
  sections: [
    {
      heading: "3 KPIs off-track",
      items: [
        { label: "Monthly Revenue", value: "$42K / $50K", status: "yellow" },
        { label: "Churn Rate", value: "8% / 5%", status: "red" },
        { label: "NPS Score", value: "32 / 40", status: "yellow" },
      ],
    },
  ],
};

/**
 * Render a format template with mock data for preview purposes.
 */
export function previewFormatTemplate(template: string): string {
  const ctx = buildContext(MOCK_RESULT);
  return renderTemplate(template, ctx);
}

/**
 * Default format template that can be used as a starting point.
 */
export const DEFAULT_FORMAT_TEMPLATE = `{{title}}

{{#each sections}}
**{{heading}}**
{{#each items}}
{{status_emoji}} **{{label}}**: {{value}}
{{/each}}
{{/each}}`;
