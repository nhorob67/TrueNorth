import { Node, mergeAttributes } from "@tiptap/core";

// ============================================================
// Entity Embed — Structured Object Embed Extension
//
// PRD Section 3.3: Inline-embeddable TrueNorth entities
// (bets, KPIs, decisions, commitments) shown as card-like blocks.
// Stored in document JSON with entityType + entityId attributes.
// ============================================================

export interface EntityEmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    entityEmbed: {
      setEntityEmbed: (attrs: {
        entityType: string;
        entityId: string;
        entityLabel: string;
        healthStatus?: string;
      }) => ReturnType;
    };
  }
}

export const EntityEmbed = Node.create<EntityEmbedOptions>({
  name: "entityEmbed",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      entityType: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-type"),
        renderHTML: (attributes) => ({
          "data-entity-type": attributes.entityType as string,
        }),
      },
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-id"),
        renderHTML: (attributes) => ({
          "data-entity-id": attributes.entityId as string,
        }),
      },
      entityLabel: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-entity-label"),
        renderHTML: (attributes) => ({
          "data-entity-label": attributes.entityLabel as string,
        }),
      },
      healthStatus: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-health-status"),
        renderHTML: (attributes) => {
          if (!attributes.healthStatus) return {};
          return { "data-health-status": attributes.healthStatus as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-entity-type][data-entity-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const entityType = (HTMLAttributes["data-entity-type"] ?? "") as string;
    const entityLabel = (HTMLAttributes["data-entity-label"] ?? "") as string;
    const healthStatus = (HTMLAttributes["data-health-status"] ?? null) as string | null;

    const typeIcons: Record<string, string> = {
      bet: "\u{1F3AF}",
      kpi: "\u{1F4CA}",
      decision: "\u{2696}",
      commitment: "\u{1F91D}",
      move: "\u{1F3C3}",
      idea: "\u{1F4A1}",
      blocker: "\u{1F6A7}",
      issue: "\u{26A0}",
      process: "\u{2699}",
      content_piece: "\u{1F4DD}",
    };
    const icon = typeIcons[entityType] ?? "\u{1F517}";

    const healthDots: Record<string, string> = {
      green: "\u{1F7E2}",
      yellow: "\u{1F7E1}",
      red: "\u{1F534}",
    };
    const healthDot = healthStatus ? (healthDots[healthStatus] ?? "") : "";

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "truenorth-entity-embed",
        "data-type": "entity-embed",
        contenteditable: "false",
        style:
          "display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;border:1px solid var(--color-warm-border);background:var(--color-ivory);font-size:13px;cursor:pointer;vertical-align:baseline;",
      }),
      `${icon} ${entityLabel}${healthDot ? ` ${healthDot}` : ""}`,
    ];
  },

  addCommands() {
    return {
      setEntityEmbed:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});
