import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Node, Root, Heading } from "mdast";

export interface Chunk {
  text: string;
}

// --- Markdown chunking (from skill-reminder) ---

export function parseMarkdown(text: string): Root {
  return unified().use(remarkParse).use(remarkGfm).parse(text);
}

function nodeText(node: Node): string {
  return toString(node as unknown as Root).trim();
}

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim().length >= 2);
}

const CHUNK_TYPES = new Set([
  "heading",
  "paragraph",
  "code",
  "html",
  "yaml",
  "blockquote",
  "listItem",
]);

const TABLE_ROW_TYPES = new Set(["tableRow"]);

const ATOMIC_TYPES = new Set(["code", "html", "yaml"]);

function withHeading(text: string, headingText: string | null): string {
  return headingText ? `${headingText}\n${text}` : text;
}

function visitListItem(
  node: Node,
  chunks: Chunk[],
  headingText: string | null,
) {
  const text = nodeText(node);
  if (!text) return;
  for (const sentence of splitSentences(text)) {
    chunks.push({ text: withHeading(sentence, headingText) });
  }
}

function visitTableRow(
  node: Node,
  chunks: Chunk[],
  headingText: string | null,
) {
  const text = nodeText(node);
  if (!text) return;
  chunks.push({ text: withHeading(text, headingText) });
}

function visitChunkType(
  node: Node,
  chunks: Chunk[],
  headingText: string | null,
) {
  const text = nodeText(node);
  if (!text) return;

  if (ATOMIC_TYPES.has(node.type)) {
    chunks.push({ text: withHeading(text, headingText) });
    return;
  }

  for (const sentence of splitSentences(text)) {
    chunks.push({ text: withHeading(sentence, headingText) });
  }
}

export function chunkByElements(tree: Root): Chunk[] {
  const chunks: Chunk[] = [];
  let headingText: string | null = null;

  visit(tree, (node: Node) => {
    if (node.type === "heading") {
      headingText = `# ${nodeText(node as Heading)}`;
      return;
    }

    if (node.type === "listItem") {
      visitListItem(node, chunks, headingText);
      return;
    }

    if (TABLE_ROW_TYPES.has(node.type)) {
      visitTableRow(node, chunks, headingText);
      return;
    }

    if (CHUNK_TYPES.has(node.type)) {
      visitChunkType(node, chunks, headingText);
    }
  });

  return chunks;
}

// --- Frontmatter helpers ---

export function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? raw.slice(match[0].length).trim() : raw;
}

function findSentenceBoundary(text: string, maxChars: number): number {
  const candidate = text.slice(0, maxChars);
  const match = candidate.match(/([.!?])\s*$/);
  if (match) {
    return candidate.indexOf(match[1]) + 1;
  }
  const lastSpace = candidate.lastIndexOf(" ");
  return lastSpace > maxChars * 0.5 ? lastSpace : maxChars;
}
