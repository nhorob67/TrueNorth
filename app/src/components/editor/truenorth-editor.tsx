"use client";

import { useState, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { EditorToolbar } from "./toolbar";
import { SlashCommandExtension } from "./slash-command";
import { EntityEmbed } from "./extensions/entity-embed";
import { InlineComment } from "./extensions/inline-comment";
import { VideoEmbed } from "./extensions/video-embed";
import { TweetEmbed } from "./extensions/tweet-embed";
import { htmlToMarkdown, markdownToHtml } from "./markdown-utils";
import type * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";

// ============================================================
// TrueNorth Editor
//
// PRD Section 5.7 / 3.3:
// - White canvas (exception to no-white rule)
// - Parchment surrounding chrome
// - Warm-gray toolbar icons on ivory
// - Supports rich text, tables, images, code blocks
// - Slash commands via @tiptap/suggestion + tippy.js
// - AI assistance (future via /ai slash command)
// - Exports to HTML and Markdown
// - Entity embeds for inline linking
// - Inline comment marks for text-anchored comments
// - Yjs real-time collaboration with presence cursors
// ============================================================

interface TrueNorthEditorProps {
  content?: string;
  onChange?: (json: Record<string, unknown>, html: string) => void;
  onCommentCreate?: (selectedText: string, commentId: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  // Collaboration props — when provided, enables real-time collab
  ydoc?: Y.Doc;
  awareness?: Awareness;
}

export function TrueNorthEditor({
  content,
  onChange,
  onCommentCreate,
  placeholder = "Start writing... Type / for commands or use the toolbar above.",
  editable = true,
  className = "",
  ydoc,
  awareness,
}: TrueNorthEditorProps) {
  const [markdownMode, setMarkdownMode] = useState(false);
  const [markdownText, setMarkdownText] = useState("");

  const isCollaborative = Boolean(ydoc);

  // Build extension list, swapping history for collaboration when ydoc is present
  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        horizontalRule: false,
        codeBlock: {
          HTMLAttributes: {
            class: "truenorth-code-block",
          },
        },
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: "truenorth-link",
          },
        },
        // When collaborative, disable StarterKit's built-in history
        // since Yjs manages undo/redo via its own UndoManager
        ...(isCollaborative ? { history: false } : {}),
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
      HorizontalRule,
      Image.configure({
        HTMLAttributes: {
          class: "truenorth-image",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "truenorth-table",
        },
      }),
      TableRow,
      TableCell,
      TableHeader,
      EntityEmbed,
      InlineComment,
      VideoEmbed,
      TweetEmbed,
      ...(editable ? [SlashCommandExtension] : []),
    ];

    // Add collaboration extensions when ydoc is provided
    if (ydoc) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      base.push(
        Collaboration.configure({
          document: ydoc,
        }) as any
      );

      if (awareness) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        base.push(
          CollaborationCursor.configure({
            provider: { awareness },
            user: awareness.getLocalState()?.user ?? {
              name: "Anonymous",
              color: "#7A756E",
            },
          }) as any
        );
      }
    }

    return base;
  }, [ydoc, awareness, editable, placeholder, isCollaborative]);

  const editor = useEditor({
    extensions,
    // When collaborative, Y.Doc is the source of truth — don't set initial content
    // (it comes from the Y.Doc). For non-collaborative mode, use the content prop.
    content: isCollaborative ? undefined : (content ?? ""),
    editable,
    editorProps: {
      attributes: {
        class: "truenorth-editor-content",
      },
      handleDrop: (view, event, _slice, moved) => {
        // Handle drag-and-drop image upload (converts to base64 data URL)
        if (moved || !event.dataTransfer?.files?.length) return false;

        const file = event.dataTransfer.files[0];
        if (!file.type.startsWith("image/")) return false;

        // Limit to 5MB
        if (file.size > 5 * 1024 * 1024) {
          alert("Image must be under 5MB.");
          return true;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const src = reader.result as string;
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (pos) {
            const node = view.state.schema.nodes.image.create({ src });
            const tr = view.state.tr.insert(pos.pos, node);
            view.dispatch(tr);
          }
        };
        reader.readAsDataURL(file);
        return true;
      },
      handlePaste: (view, event) => {
        // Handle pasted images from clipboard
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (!file || file.size > 5 * 1024 * 1024) continue;

            const reader = new FileReader();
            reader.onload = () => {
              const src = reader.result as string;
              const node = view.state.schema.nodes.image.create({ src });
              const tr = view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as Record<string, unknown>, editor.getHTML());
    },
  });

  const handleToggleMarkdown = useCallback(() => {
    if (!editor) return;

    if (!markdownMode) {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      setMarkdownText(md);
      setMarkdownMode(true);
    } else {
      const html = markdownToHtml(markdownText);
      editor.commands.setContent(html);
      setMarkdownMode(false);
      onChange?.(editor.getJSON() as Record<string, unknown>, editor.getHTML());
    }
  }, [editor, markdownMode, markdownText, onChange]);

  const handleExportMarkdown = useCallback(() => {
    if (!editor) return;
    const html = markdownMode ? markdownToHtml(markdownText) : editor.getHTML();
    const md = markdownMode ? markdownText : htmlToMarkdown(html);
    navigator.clipboard.writeText(md);
  }, [editor, markdownMode, markdownText]);

  return (
    <div className={`truenorth-editor border border-line rounded-lg overflow-hidden ${className}`}>
      {editable && (
        <EditorToolbar
          editor={editor}
          markdownMode={markdownMode}
          onToggleMarkdown={handleToggleMarkdown}
          onExportMarkdown={handleExportMarkdown}
          onCommentCreate={onCommentCreate}
        />
      )}
      <div className="truenorth-editor-canvas bg-surface">
        {markdownMode ? (
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            className="w-full min-h-[400px] p-6 font-mono text-sm text-ink bg-surface border-none outline-none resize-y"
            placeholder="Write or edit Markdown here..."
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Read-only renderer
// ============================================================

export function TrueNorthEditorReadOnly({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  return (
    <TrueNorthEditor
      content={content}
      editable={false}
      className={className}
    />
  );
}
