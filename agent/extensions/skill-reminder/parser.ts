import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { Node, Root, Heading } from "mdast";

export const SKILLS_DIR = resolve(homedir(), ".pi", "agent", "skills");

export interface Chunk {
  text: string;
}

export async function findMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) return findMarkdownFiles(fullPath);
        if (entry.name.toLowerCase().endsWith(".md")) return [fullPath];
        return [];
      }),
    );
    return results.flat();
  } catch {
    return [];
  }
}

export function deriveSkillName(filePath: string): string | null {
  const rel = relative(SKILLS_DIR, filePath);
  const parts = rel.split(/[/\\]/);
  return parts.length >= 1 ? parts[0] : null;
}

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

  // Code blocks and HTML stay atomic.
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
      chunks.push({ text: headingText });
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

export function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? raw.slice(match[0].length).trim() : raw;
}

export function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const result: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*["']?(.+?)["']?\s*$/);
    if (kv) {
      result[kv[1]] = kv[2];
    }
  }
  return result;
}
