import { Mark, mergeAttributes } from "@tiptap/core";

// ============================================================
// Inline Comment Mark Extension
//
// PRD Section 3.4: Text-anchored inline comments.
// Wraps selected text with a comment annotation mark.
// Highlighted text shown with sage background.
// ============================================================

export interface InlineCommentOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineComment: {
      setInlineComment: (commentId: string) => ReturnType;
      unsetInlineComment: () => ReturnType;
    };
  }
}

export const InlineComment = Mark.create<InlineCommentOptions>({
  name: "inlineComment",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (!attributes.commentId) return {};
          return { "data-comment-id": attributes.commentId as string };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "truenorth-inline-comment",
        style:
          "background-color:rgba(139,158,130,0.2);border-bottom:2px solid rgba(139,158,130,0.5);cursor:pointer;",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setInlineComment:
        (commentId: string) =>
        ({ commands }) => {
          return commands.setMark(this.name, { commentId });
        },
      unsetInlineComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
