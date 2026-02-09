import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { visit } from "unist-util-visit";
import type { Root, Content, Heading, Code } from "mdast";

export interface MarkdownChunk {
  id: string;
  filePath: string;
  type: ChunkType;
  content: string;
  heading?: string;
  headingLevel?: number;
  codeLanguage?: string;
  startLine?: number;
  endLine?: number;
  metadata: Record<string, unknown>;
}

export type ChunkType =
  | "heading"
  | "paragraph"
  | "code"
  | "list"
  | "blockquote"
  | "table"
  | "section";

export interface ChunkingOptions {
  /** Maximum characters per chunk (default: 1000) */
  maxChunkSize?: number;
  /** Minimum characters per chunk (default: 100) */
  minChunkSize?: number;
  /** Include heading context in chunks (default: true) */
  includeHeadingContext?: boolean;
  /** Group content under headings into sections (default: true) */
  groupByHeading?: boolean;
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000,
  minChunkSize: 100,
  includeHeadingContext: true,
  groupByHeading: true,
};

/**
 * Parse markdown content into an mdast AST
 */
export function parseMarkdown(content: string): Root {
  return fromMarkdown(content, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

/**
 * Extract text content from an AST node
 */
export function nodeToText(node: Content | Root): string {
  return toString(node);
}

/**
 * Get the type classification for a chunk
 */
function getChunkType(node: Content): ChunkType {
  switch (node.type) {
    case "heading":
      return "heading";
    case "code":
      return "code";
    case "list":
      return "list";
    case "blockquote":
      return "blockquote";
    case "table":
      return "table";
    default:
      return "paragraph";
  }
}

/**
 * Generate a unique chunk ID
 */
function generateChunkId(
  filePath: string,
  index: number,
  type: ChunkType,
): string {
  const sanitizedPath = filePath.replace(/[^a-zA-Z0-9]/g, "_");
  return `${sanitizedPath}_${type}_${index}`;
}

interface SectionContext {
  heading: string;
  level: number;
}

/**
 * Chunk markdown content by AST structure
 */
export function chunkMarkdown(
  content: string,
  filePath: string,
  options: ChunkingOptions = {},
): MarkdownChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const ast = parseMarkdown(content);
  const chunks: MarkdownChunk[] = [];
  let chunkIndex = 0;

  // Track heading hierarchy for context
  const headingStack: SectionContext[] = [];

  // Helper to get current heading context
  const getCurrentHeadingContext = (): string | undefined => {
    if (!opts.includeHeadingContext || headingStack.length === 0) {
      return undefined;
    }
    return headingStack.map((h) => h.heading).join(" > ");
  };

  // Helper to update heading stack based on level
  const updateHeadingStack = (heading: string, level: number) => {
    // Remove all headings at same or lower level
    while (headingStack.length > 0) {
      const top = headingStack[headingStack.length - 1];
      if (top.level >= level) {
        headingStack.pop();
      } else {
        break;
      }
    }
    headingStack.push({ heading, level });
  };

  // Collect sections if groupByHeading is enabled
  if (opts.groupByHeading) {
    const sections: {
      heading?: Heading;
      content: Content[];
      startLine?: number;
      endLine?: number;
    }[] = [];

    let currentSection: {
      heading?: Heading;
      content: Content[];
      startLine?: number;
      endLine?: number;
    } = {
      content: [],
    };

    for (const node of ast.children) {
      if (node.type === "heading") {
        // Start new section
        if (currentSection.content.length > 0 || currentSection.heading) {
          sections.push(currentSection);
        }
        currentSection = {
          heading: node as Heading,
          content: [],
          startLine: node.position?.start.line,
        };
      } else {
        currentSection.content.push(node);
        if (node.position) {
          currentSection.endLine = node.position.end.line;
        }
      }
    }

    // Push final section
    if (currentSection.content.length > 0 || currentSection.heading) {
      sections.push(currentSection);
    }

    // Process each section
    for (const section of sections) {
      const headingText = section.heading
        ? nodeToText(section.heading)
        : undefined;
      const headingLevel = section.heading?.depth;

      if (headingText && headingLevel) {
        updateHeadingStack(headingText, headingLevel);
      }

      // Build section content
      let sectionText = "";
      if (section.heading) {
        sectionText =
          "#".repeat(section.heading.depth) + " " + headingText + "\n\n";
      }

      for (const node of section.content) {
        const text = nodeToText(node);
        if (node.type === "code") {
          const codeNode = node as Code;
          sectionText +=
            "```" + (codeNode.lang || "") + "\n" + text + "\n```\n\n";
        } else {
          sectionText += text + "\n\n";
        }
      }

      sectionText = sectionText.trim();

      if (sectionText.length < opts.minChunkSize) {
        continue;
      }

      // Split large sections
      if (sectionText.length > opts.maxChunkSize) {
        const subChunks = splitLargeContent(sectionText, opts.maxChunkSize);
        for (const subChunk of subChunks) {
          if (subChunk.length >= opts.minChunkSize) {
            chunks.push({
              id: generateChunkId(filePath, chunkIndex++, "section"),
              filePath,
              type: "section",
              content: subChunk,
              heading: getCurrentHeadingContext(),
              headingLevel,
              startLine: section.startLine,
              endLine: section.endLine,
              metadata: {
                sectionHeading: headingText,
              },
            });
          }
        }
      } else {
        chunks.push({
          id: generateChunkId(filePath, chunkIndex++, "section"),
          filePath,
          type: "section",
          content: sectionText,
          heading: getCurrentHeadingContext(),
          headingLevel,
          startLine: section.startLine,
          endLine: section.endLine,
          metadata: {
            sectionHeading: headingText,
          },
        });
      }
    }
  } else {
    // Process nodes individually without grouping
    visit(ast, (node) => {
      if (node.type === "root") return;

      const content = node as Content;
      const text = nodeToText(content);

      if (text.length < opts.minChunkSize) {
        return;
      }

      const chunkType = getChunkType(content);

      // Update heading context
      if (content.type === "heading") {
        const heading = content as Heading;
        updateHeadingStack(text, heading.depth);
      }

      const chunk: MarkdownChunk = {
        id: generateChunkId(filePath, chunkIndex++, chunkType),
        filePath,
        type: chunkType,
        content: text,
        heading: getCurrentHeadingContext(),
        startLine: content.position?.start.line,
        endLine: content.position?.end.line,
        metadata: {},
      };

      // Add type-specific metadata
      if (content.type === "heading") {
        chunk.headingLevel = (content as Heading).depth;
      } else if (content.type === "code") {
        chunk.codeLanguage = (content as Code).lang || undefined;
      }

      // Handle oversized chunks
      if (text.length > opts.maxChunkSize) {
        const subChunks = splitLargeContent(text, opts.maxChunkSize);
        for (const subChunk of subChunks) {
          if (subChunk.length >= opts.minChunkSize) {
            chunks.push({
              ...chunk,
              id: generateChunkId(filePath, chunkIndex++, chunkType),
              content: subChunk,
            });
          }
        }
      } else {
        chunks.push(chunk);
      }
    });
  }

  return chunks;
}

/**
 * Split large content into smaller chunks at sentence/paragraph boundaries
 */
function splitLargeContent(content: string, maxSize: number): string[] {
  const chunks: string[] = [];

  // Try to split by paragraphs first
  const paragraphs = content.split(/\n\n+/);

  let currentChunk = "";

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= maxSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      // If single paragraph is too large, split by sentences
      if (para.length > maxSize) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        currentChunk = "";

        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= maxSize) {
            currentChunk += (currentChunk ? " " : "") + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            // If single sentence is still too large, hard split
            if (sentence.length > maxSize) {
              for (let i = 0; i < sentence.length; i += maxSize) {
                chunks.push(sentence.slice(i, i + maxSize).trim());
              }
              currentChunk = "";
            } else {
              currentChunk = sentence;
            }
          }
        }
      } else {
        currentChunk = para;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Chunk multiple markdown files
 */
export async function chunkMarkdownFiles(
  files: Array<{ path: string; content: string }>,
  options: ChunkingOptions = {},
): Promise<MarkdownChunk[]> {
  const allChunks: MarkdownChunk[] = [];

  for (const file of files) {
    const chunks = chunkMarkdown(file.content, file.path, options);
    allChunks.push(...chunks);
  }

  return allChunks;
}
