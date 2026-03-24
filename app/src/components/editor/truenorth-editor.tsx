"use client";

import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import { EditorToolbar } from "./toolbar";
import { SlashCommandExtension } from "./slash-command";
import { EntityEmbed } from "./extensions/entity-embed";
import { InlineComment } from "./extensions/inline-comment";
import { htmlToMarkdown, markdownToHtml } from "./markdown-utils";

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
// ============================================================

interface TrueNorthEditorProps {
  content?: string;
  onChange?: (json: Record<string, unknown>, html: string) => void;
  onCommentCreate?: (selectedText: string, commentId: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function TrueNorthEditor({
  content,
  onChange,
  onCommentCreate,
  placeholder = "Start writing... Type / for commands or use the toolbar above.",
  editable = true,
  className = "",
}: TrueNorthEditorProps) {
  const [markdownMode, setMarkdownMode] = useState(false);
  const [markdownText, setMarkdownText] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: false, // We use the separate extension
        codeBlock: {
          HTMLAttributes: {
            class: "truenorth-code-block",
          },
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
      HorizontalRule,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "truenorth-link",
        },
      }),
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
      ...(editable ? [SlashCommandExtension] : []),
    ],
    content: content ?? "",
    editable,
    editorProps: {
      attributes: {
        class: "truenorth-editor-content",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON() as Record<string, unknown>, editor.getHTML());
    },
  });

  const handleToggleMarkdown = useCallback(() => {
    if (!editor) return;

    if (!markdownMode) {
      // Switch to Markdown: convert HTML to Markdown
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      setMarkdownText(md);
      setMarkdownMode(true);
    } else {
      // Switch back to WYSIWYG: convert Markdown to HTML
      const html = markdownToHtml(markdownText);
      editor.commands.setContent(html);
      setMarkdownMode(false);
      // Trigger onChange with new content
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
    <div className={`truenorth-editor border border-warm-border rounded-lg overflow-hidden ${className}`}>
      {editable && (
        <EditorToolbar
          editor={editor}
          markdownMode={markdownMode}
          onToggleMarkdown={handleToggleMarkdown}
          onExportMarkdown={handleExportMarkdown}
          onCommentCreate={onCommentCreate}
        />
      )}
      <div className="truenorth-editor-canvas bg-white">
        {markdownMode ? (
          <textarea
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            className="w-full min-h-[400px] p-6 font-mono text-sm text-charcoal bg-white border-none outline-none resize-y"
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
