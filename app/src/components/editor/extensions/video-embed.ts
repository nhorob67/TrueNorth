import { Node, mergeAttributes } from "@tiptap/core";

// ============================================================
// Video Embed Extension
//
// Supports YouTube and Vimeo embeds via URL. Renders as a
// responsive iframe within the editor.
// ============================================================

export interface VideoEmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

function extractVideoUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

export const VideoEmbed = Node.create<VideoEmbedOptions>({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "truenorth-video-embed",
      },
    };
  },

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-video-embed": "",
        style:
          "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.5rem;margin:1rem 0;",
      }),
      [
        "iframe",
        mergeAttributes(HTMLAttributes, {
          frameborder: "0",
          allowfullscreen: "true",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          style:
            "position:absolute;top:0;left:0;width:100%;height:100%;border:none;",
        }),
      ],
    ];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (options) =>
        ({ commands }) => {
          const embedUrl = extractVideoUrl(options.src);
          if (!embedUrl) return false;
          return commands.insertContent({
            type: this.name,
            attrs: { src: embedUrl },
          });
        },
    };
  },
});

export { extractVideoUrl };
