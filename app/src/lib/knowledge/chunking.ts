/**
 * Chunk content text into retrieval-sized pieces.
 *
 * Strategy: split on paragraph boundaries, merge small paragraphs,
 * and break large paragraphs at sentence boundaries.
 */

const DEFAULT_CHUNK_SIZE = 1200; // ~300 tokens
const OVERLAP = 100;

export interface Chunk {
  index: number;
  content: string;
  snippet: string;
  tokenEstimate: number;
}

/**
 * Split content into chunks suitable for retrieval.
 * Each chunk includes a short snippet for display.
 */
export function chunkContent(
  content: string,
  maxChunkSize = DEFAULT_CHUNK_SIZE
): Chunk[] {
  if (!content.trim()) return [];

  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim());
  const chunks: Chunk[] = [];
  let buffer = "";
  let index = 0;

  for (const para of paragraphs) {
    if (buffer.length + para.length + 2 > maxChunkSize && buffer.length > 0) {
      chunks.push(makeChunk(buffer, index++));
      // Keep overlap from end of previous chunk
      buffer = buffer.slice(-OVERLAP) + "\n\n" + para;
    } else {
      buffer = buffer ? buffer + "\n\n" + para : para;
    }

    // If a single paragraph exceeds max, split at sentence boundaries
    if (buffer.length > maxChunkSize) {
      const sentences = splitSentences(buffer);
      let sentenceBuffer = "";
      for (const sentence of sentences) {
        if (
          sentenceBuffer.length + sentence.length > maxChunkSize &&
          sentenceBuffer.length > 0
        ) {
          chunks.push(makeChunk(sentenceBuffer, index++));
          sentenceBuffer = sentenceBuffer.slice(-OVERLAP) + " " + sentence;
        } else {
          sentenceBuffer = sentenceBuffer
            ? sentenceBuffer + " " + sentence
            : sentence;
        }
      }
      buffer = sentenceBuffer;
    }
  }

  if (buffer.trim()) {
    chunks.push(makeChunk(buffer, index));
  }

  return chunks;
}

function makeChunk(content: string, index: number): Chunk {
  const trimmed = content.trim();
  return {
    index,
    content: trimmed,
    snippet: trimmed.slice(0, 200).trimEnd() + (trimmed.length > 200 ? "..." : ""),
    tokenEstimate: Math.ceil(trimmed.length / 4),
  };
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
}
