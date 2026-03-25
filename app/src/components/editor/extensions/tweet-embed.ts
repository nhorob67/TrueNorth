import { Node, mergeAttributes } from "@tiptap/core";

// ============================================================
// Tweet Embed Extension
//
// Embeds tweets/posts from X (Twitter) by URL. Renders as a
// styled blockquote with a link to the original tweet.
// (Full oEmbed rendering would require client-side Twitter
// widget script — this provides a clean static embed.)
// ============================================================

export interface TweetEmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    tweetEmbed: {
      setTweetEmbed: (options: { url: string }) => ReturnType;
    };
  }
}

function extractTweetId(url: string): string | null {
  const match = url.match(
    /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/
  );
  return match ? match[1] : null;
}

function extractTweetAuthor(url: string): string {
  const match = url.match(
    /(?:twitter\.com|x\.com)\/(\w+)\/status/
  );
  return match ? `@${match[1]}` : "unknown";
}

export const TweetEmbed = Node.create<TweetEmbedOptions>({
  name: "tweetEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "truenorth-tweet-embed",
      },
    };
  },

  addAttributes() {
    return {
      url: { default: null },
      tweetId: { default: null },
      author: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-tweet-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, {
        "data-tweet-embed": "",
        "data-tweet-id": HTMLAttributes.tweetId,
      }),
      [
        "blockquote",
        {
          style:
            "border-left:3px solid #1DA1F2;padding:0.75rem 1rem;margin:1rem 0;border-radius:0.25rem;background-color:#f8fafc;",
        },
        [
          "p",
          { style: "margin:0 0 0.5rem;font-size:0.875rem;color:#2F2B28;" },
          `Tweet from ${HTMLAttributes.author || "X"}`,
        ],
        [
          "a",
          {
            href: HTMLAttributes.url,
            target: "_blank",
            rel: "noopener noreferrer",
            style: "color:#1DA1F2;font-size:0.75rem;text-decoration:none;",
          },
          "View on X →",
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setTweetEmbed:
        (options) =>
        ({ commands }) => {
          const tweetId = extractTweetId(options.url);
          if (!tweetId) return false;
          const author = extractTweetAuthor(options.url);
          return commands.insertContent({
            type: this.name,
            attrs: {
              url: options.url,
              tweetId,
              author,
            },
          });
        },
    };
  },
});

export { extractTweetId };
