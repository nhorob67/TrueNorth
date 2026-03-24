"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useImperativeHandle,
} from "react";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import type { SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { Editor, Range } from "@tiptap/core";
import tippy, { type Instance as TippyInstance } from "tippy.js";

// ============================================================
// AI Copilot Helper
// ============================================================

async function callCopilot(
  editor: Editor,
  action: string,
  params: Record<string, string | undefined>
) {
  // Insert a loading indicator
  const loadingText = `\n\n[AI ${action}ing...]\n\n`;
  editor.chain().focus().insertContent(loadingText).run();

  try {
    const res = await fetch("/api/ai/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Remove loading indicator and show error
      const currentText = editor.getHTML();
      editor.commands.setContent(
        currentText.replace(`<p>[AI ${action}ing...]</p>`, `<p><em>AI error: ${data.error ?? "Request failed"}</em></p>`)
      );
      return;
    }

    // Replace loading indicator with AI output
    // Wrap in a sage-tinted marker for AI-generated content (PRD requirement)
    const aiContent = `<div data-ai-generated="true" class="truenorth-ai-content">${data.text}</div>`;
    const currentHtml = editor.getHTML();
    editor.commands.setContent(
      currentHtml.replace(`<p>[AI ${action}ing...]</p>`, aiContent)
    );
  } catch (err) {
    const currentText = editor.getHTML();
    editor.commands.setContent(
      currentText.replace(
        `<p>[AI ${action}ing...]</p>`,
        `<p><em>AI request failed. Check your connection.</em></p>`
      )
    );
  }
}

// ============================================================
// Command Item Type
// ============================================================

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  searchTerms: string[];
  command: (opts: { editor: Editor; range: Range }) => void;
}

// ============================================================
// Default Command Items
// ============================================================

export const defaultSlashCommands: SlashCommandItem[] = [
  {
    title: "Heading 1",
    description: "Large section heading",
    icon: <span className="text-xs font-bold">H1</span>,
    searchTerms: ["heading", "title", "h1", "large"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <span className="text-xs font-bold">H2</span>,
    searchTerms: ["heading", "subtitle", "h2", "medium"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <span className="text-xs font-bold">H3</span>,
    searchTerms: ["heading", "h3", "small"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bullet List",
    description: "Create a simple bullet list",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    searchTerms: ["bullet", "unordered", "list", "ul"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered List",
    description: "Create a numbered list",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 4h13v2H8V4ZM5 3v3h1v1H3V6h1V4H3V3h2ZM3 14v-2.5h2V11H3v-1h3v2.5H4V14h2v1H3v-1Zm2 5.5H3v-1h2V18H3v-1h3v4H3v-1h2v-.5ZM8 11h13v2H8v-2Zm0 7h13v2H8v-2Z" />
      </svg>
    ),
    searchTerms: ["numbered", "ordered", "list", "ol"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Blockquote",
    description: "Add a quote block",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.871 3.871 0 0 1-2.748-1.179Zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 0 1-3.5 3.5 3.871 3.871 0 0 1-2.748-1.179Z" />
      </svg>
    ),
    searchTerms: ["quote", "blockquote", "callout"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    description: "Add a code block",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m17.25 6.75 4.5 5.25-4.5 5.25m-10.5 0L2.25 12l4.5-5.25m7.5-3-4.5 16.5" />
      </svg>
    ),
    searchTerms: ["code", "pre", "block", "syntax"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Horizontal Rule",
    description: "Insert a divider line",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" d="M3 12h18" />
      </svg>
    ),
    searchTerms: ["divider", "horizontal", "rule", "hr", "separator"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: "Table",
    description: "Insert a 3x3 table",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 12c.621 0 1.125.504 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125m0 0c-.621 0-1.125.504-1.125 1.125v1.5" />
      </svg>
    ),
    searchTerms: ["table", "grid", "data"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: "Image",
    description: "Insert an image from URL",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    searchTerms: ["image", "photo", "picture", "img"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const url = prompt("Enter image URL:");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
  // ============================================================
  // AI Commands (Sage-colored)
  // ============================================================
  {
    title: "AI Draft",
    description: "Generate a draft from a topic or outline",
    icon: (
      <svg className="w-4 h-4 text-sage-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
    searchTerms: ["ai", "draft", "generate", "write", "create"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const topic = prompt("What should the AI draft? (Topic, outline, or instructions)");
      if (!topic) return;
      callCopilot(editor, "draft", { prompt: topic });
    },
  },
  {
    title: "AI Continue",
    description: "Continue writing from where you left off",
    icon: (
      <svg className="w-4 h-4 text-sage-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
      </svg>
    ),
    searchTerms: ["ai", "continue", "next", "more", "extend"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const content = editor.getText();
      if (!content.trim()) {
        alert("Write some content first so the AI knows what to continue.");
        return;
      }
      callCopilot(editor, "continue", { content });
    },
  },
  {
    title: "AI Summarize",
    description: "Summarize selected text or full document",
    icon: (
      <svg className="w-4 h-4 text-sage-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    ),
    searchTerms: ["ai", "summarize", "summary", "shorten", "condense"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const { from, to } = editor.state.selection;
      const selection = from !== to
        ? editor.state.doc.textBetween(from, to)
        : editor.getText();
      if (!selection.trim()) {
        alert("Select text or write content to summarize.");
        return;
      }
      callCopilot(editor, "summarize", { selection });
    },
  },
  // ============================================================
  // Entity Embed (3.3 — Structured Object Embeds)
  // ============================================================
  {
    title: "Embed Entity",
    description: "Embed a linked TrueNorth entity (bet, KPI, decision...)",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
      </svg>
    ),
    searchTerms: ["embed", "entity", "bet", "kpi", "decision", "commitment", "link"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const query = prompt("Search for an entity to embed (type a name):");
      if (!query) return;

      fetch(`/api/entities/search?q=${encodeURIComponent(query)}&types=bet,kpi,decision,commitment,move,idea,process`)
        .then((res) => res.json())
        .then((results: Array<{ id: string; type: string; label: string }>) => {
          if (!results || results.length === 0) {
            alert("No entities found.");
            return;
          }
          // Use the first result for simplicity; in a full implementation this would be a picker
          const picked = results[0];
          const choiceText = results.slice(0, 5).map((r, i) => `${i + 1}. [${r.type}] ${r.label}`).join("\n");
          const choice = results.length > 1
            ? prompt(`Pick a number (1-${Math.min(5, results.length)}):\n${choiceText}`)
            : "1";
          const idx = Math.max(0, Math.min(results.length - 1, parseInt(choice ?? "1", 10) - 1));
          const entity = results[idx] ?? picked;

          editor.chain().focus().setEntityEmbed({
            entityType: entity.type,
            entityId: entity.id,
            entityLabel: entity.label,
          }).run();
        })
        .catch(() => {
          alert("Entity search failed.");
        });
    },
  },
  {
    title: "AI Rewrite",
    description: "Rewrite selected text for clarity",
    icon: (
      <svg className="w-4 h-4 text-sage-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
      </svg>
    ),
    searchTerms: ["ai", "rewrite", "improve", "rephrase", "edit", "simplify"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const { from, to } = editor.state.selection;
      const selection = from !== to
        ? editor.state.doc.textBetween(from, to)
        : "";
      if (!selection.trim()) {
        alert("Select the text you want to rewrite first.");
        return;
      }
      const tone = prompt("Rewrite tone? (simplify / expand / persuasive / professional — or leave blank for general)");
      callCopilot(editor, "rewrite", { selection, tone: tone || undefined });
    },
  },
];

// ============================================================
// Command List Popup Component
// ============================================================

interface CommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

interface CommandListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

function CommandList({ items, command, ref }: CommandListProps & { ref?: React.Ref<CommandListRef> }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    // Scroll selected item into view
    useEffect(() => {
      const container = scrollRef.current;
      if (!container) return;
      const selected = container.children[selectedIndex] as HTMLElement | undefined;
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    }, [selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-command-popup rounded-lg border border-warm-border bg-ivory shadow-lg p-2">
          <p className="text-xs text-warm-gray px-2 py-1">No matching commands</p>
        </div>
      );
    }

    return (
      <div
        ref={scrollRef}
        className="slash-command-popup rounded-lg border border-warm-border bg-ivory shadow-lg max-h-72 overflow-y-auto p-1 w-64"
      >
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => selectItem(index)}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${
              index === selectedIndex
                ? "bg-moss/10 text-charcoal"
                : "text-charcoal hover:bg-parchment"
            }`}
          >
            <div className="w-8 h-8 rounded-md border border-warm-border bg-white flex items-center justify-center text-warm-gray flex-shrink-0">
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{item.title}</p>
              <p className="text-xs text-warm-gray leading-tight mt-0.5">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
}

// ============================================================
// Suggestion Render Function (tippy.js)
// ============================================================

function renderSuggestion() {
  let component: ReactRenderer<CommandListRef> | null = null;
  let popup: TippyInstance[] | null = null;

  return {
    onStart: (props: SuggestionProps) => {
      component = new ReactRenderer(CommandList, {
        props: {
          items: props.items,
          command: props.command,
        },
        editor: props.editor,
      });

      const clientRect = props.clientRect;
      if (!clientRect) return;

      popup = tippy("body", {
        getReferenceClientRect: clientRect as () => DOMRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: "manual",
        placement: "bottom-start",
        offset: [0, 4],
      });
    },

    onUpdate: (props: SuggestionProps) => {
      component?.updateProps({
        items: props.items,
        command: props.command,
      });

      if (popup?.[0] && props.clientRect) {
        popup[0].setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      }
    },

    onKeyDown: (props: { event: KeyboardEvent }) => {
      if (props.event.key === "Escape") {
        popup?.[0]?.hide();
        return true;
      }
      return component?.ref?.onKeyDown(props.event) ?? false;
    },

    onExit: () => {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
}

// ============================================================
// Slash Command Extension
// ============================================================

export const SlashCommandExtension = Extension.create({
  name: "slash-command",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          if (!q) return defaultSlashCommands;
          return defaultSlashCommands.filter(
            (item) =>
              item.title.toLowerCase().includes(q) ||
              item.searchTerms.some((term) => term.includes(q))
          );
        },
        render: renderSuggestion,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
        allow: ({ editor }: { editor: Editor }) => {
          // Don't show slash commands inside code blocks
          return !editor.isActive("codeBlock");
        },
      } satisfies Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
