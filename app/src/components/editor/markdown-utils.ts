// ============================================================
// Markdown <-> HTML conversion utilities
//
// PRD Section 3.3: Lightweight regex-based conversion
// No external library — keep it minimal.
// ============================================================

/**
 * Convert HTML (from Tiptap) to Markdown.
 */
export function htmlToMarkdown(html: string): string {
  let md = html;

  // Normalize line breaks
  md = md.replace(/\r\n/g, "\n");

  // Horizontal rules
  md = md.replace(/<hr\s*\/?>/gi, "\n---\n");

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, (_, content) => `# ${stripTags(content)}\n\n`);
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, (_, content) => `## ${stripTags(content)}\n\n`);
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, (_, content) => `### ${stripTags(content)}\n\n`);
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, (_, content) => `#### ${stripTags(content)}\n\n`);

  // Code blocks (before inline code)
  md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, content) => {
    return `\n\`\`\`\n${decodeHtmlEntities(content.trim())}\n\`\`\`\n\n`;
  });

  // Images (before links to avoid nesting issues)
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, (_, src, alt) => `![${alt}](${src})`);
  md = md.replace(/<img[^>]+src="([^"]*)"[^>]*\/?>/gi, (_, src) => `![](${src})`);

  // Links
  md = md.replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, href, text) => `[${stripTags(text)}](${href})`);

  // Bold
  md = md.replace(/<(strong|b)>(.*?)<\/\1>/gi, (_, _tag, content) => `**${content}**`);

  // Italic
  md = md.replace(/<(em|i)>(.*?)<\/\1>/gi, (_, _tag, content) => `*${content}*`);

  // Strikethrough
  md = md.replace(/<(del|s|strike)>(.*?)<\/\1>/gi, (_, _tag, content) => `~~${content}~~`);

  // Inline code
  md = md.replace(/<code>(.*?)<\/code>/gi, (_, content) => `\`${content}\``);

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const inner = stripTags(content).trim();
    return inner
      .split("\n")
      .map((line: string) => `> ${line}`)
      .join("\n") + "\n\n";
  });

  // Ordered lists
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let idx = 0;
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, li: string) => {
      idx++;
      return `${idx}. ${stripTags(li).trim()}\n`;
    }) + "\n";
  });

  // Unordered lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_: string, li: string) => {
      return `- ${stripTags(li).trim()}\n`;
    }) + "\n";
  });

  // Paragraphs
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, (_, content) => `${content}\n\n`);

  // Line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Strip remaining tags
  md = stripTags(md);

  // Decode HTML entities
  md = decodeHtmlEntities(md);

  // Collapse multiple blank lines
  md = md.replace(/\n{3,}/g, "\n\n");

  return md.trim() + "\n";
}

/**
 * Convert Markdown to HTML (for loading into Tiptap).
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Normalize line breaks
  html = html.replace(/\r\n/g, "\n");

  // Code blocks (before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");
  html = html.replace(/^\*\*\*$/gm, "<hr>");
  html = html.replace(/^___$/gm, "<hr>");

  // Headings
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Images (before links)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic (avoid matching ** which is bold)
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Blockquotes
  html = html.replace(/(^> .+(?:\n> .+)*)/gm, (match) => {
    const inner = match
      .split("\n")
      .map((line) => line.replace(/^> ?/, ""))
      .join("<br>");
    return `<blockquote><p>${inner}</p></blockquote>`;
  });

  // Ordered lists
  html = html.replace(/(^\d+\. .+(?:\n\d+\. .+)*)/gm, (match) => {
    const items = match
      .split("\n")
      .map((line) => `<li>${line.replace(/^\d+\. /, "")}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });

  // Unordered lists
  html = html.replace(/(^- .+(?:\n- .+)*)/gm, (match) => {
    const items = match
      .split("\n")
      .map((line) => `<li>${line.replace(/^- /, "")}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // Paragraphs: wrap remaining text blocks
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Don't wrap blocks that are already HTML elements
      if (/^<(h[1-6]|ul|ol|blockquote|pre|hr|div|table|img)/i.test(trimmed)) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return html;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
