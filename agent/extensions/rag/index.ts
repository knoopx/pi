import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { glob } from "glob";

import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import { textResult, errorResult } from "../common/tool-utils";

import { chunkMarkdown, type ChunkingOptions } from "./chunker";
import { getGlobalStore, resetGlobalStore, type SearchResult } from "./store";

// Helper to normalize execute arguments (parameter order can vary)
function isExtensionContext(value: unknown): value is ExtensionContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "ui" in value &&
    "cwd" in value
  );
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return value instanceof AbortSignal;
}

function normalizeExecuteArgs(
  arg1: unknown,
  arg2: unknown,
  arg3: unknown,
): {
  ctx: ExtensionContext;
  onUpdate?: AgentToolUpdateCallback<Record<string, unknown>>;
  signal?: AbortSignal;
} {
  const values = [arg1, arg2, arg3];

  const ctx = values.find(isExtensionContext);
  if (!ctx) {
    throw new Error("Extension context not provided");
  }

  const signal = values.find(isAbortSignal);
  const onUpdate = values.find((value) => typeof value === "function") as
    | AgentToolUpdateCallback<Record<string, unknown>>
    | undefined;

  return { ctx, onUpdate, signal };
}

// Parameter schemas
const SearchMarkdownParams = Type.Object({
  query: Type.String({ description: "Search query text" }),
  limit: Type.Optional(
    Type.Number({ description: "Maximum number of results (default: 5)" }),
  ),
  minSimilarity: Type.Optional(
    Type.Number({
      description: "Minimum similarity threshold 0-1 (default: 0.3)",
    }),
  ),
  filePath: Type.Optional(
    Type.String({ description: "Filter results to a specific file path" }),
  ),
});

type SearchMarkdownParamsType = Static<typeof SearchMarkdownParams>;

function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) {
    return "No matching results found.";
  }

  return results
    .map((r, i) => {
      const lines = [
        `## Result ${i + 1} (${(r.similarity * 100).toFixed(1)}% match)`,
        `**File:** ${r.chunk.filePath}`,
      ];

      if (r.chunk.heading) {
        lines.push(`**Section:** ${r.chunk.heading}`);
      }

      if (r.chunk.startLine !== undefined) {
        const lineInfo =
          r.chunk.endLine !== undefined
            ? `${r.chunk.startLine}-${r.chunk.endLine}`
            : `${r.chunk.startLine}`;
        lines.push(`**Lines:** ${lineInfo}`);
      }

      if (r.chunk.codeLanguage) {
        lines.push(`**Language:** ${r.chunk.codeLanguage}`);
      }

      lines.push("");
      lines.push(r.chunk.content);
      lines.push("");

      return lines.join("\n");
    })
    .join("\n---\n\n");
}

export default function markdownRagExtension(pi: ExtensionAPI) {
  // Register /rag-index command
  pi.registerCommand("rag-index", {
    description:
      "Index markdown files for RAG search (glob patterns supported)",
    async handler(args, ctx) {
      const patterns = args.trim().split(/\s+/).filter(Boolean);

      if (patterns.length === 0) {
        ctx.ui.notify(
          "Usage: /rag-index <glob-pattern> [pattern2...]",
          "warning",
        );
        return;
      }

      ctx.ui.notify(`Indexing ${patterns.join(", ")}...`, "info");

      try {
        // Resolve all glob patterns
        const resolvedPaths: string[] = [];
        for (const pattern of patterns) {
          const matches = await glob(pattern, {
            nodir: true,
            absolute: true,
          });
          resolvedPaths.push(...matches);
        }

        const uniquePaths = [...new Set(resolvedPaths)];

        if (uniquePaths.length === 0) {
          ctx.ui.notify(
            "No markdown files found matching the patterns.",
            "warning",
          );
          return;
        }

        // Read file contents
        const files: Array<{ path: string; content: string }> = [];
        for (const filePath of uniquePaths) {
          const content = await readFile(filePath, "utf-8");
          files.push({ path: filePath, content });
        }

        // Chunk all files
        const chunkingOptions: ChunkingOptions = {
          groupByHeading: true,
          includeHeadingContext: true,
        };

        const allChunks = files.flatMap((file) =>
          chunkMarkdown(file.content, file.path, chunkingOptions),
        );

        // Get store and index chunks
        const store = await getGlobalStore({
          onProgress: (msg) => ctx.ui.notify(msg, "info"),
        });

        // Remove existing chunks for these files to allow re-indexing
        for (const file of files) {
          store.removeFile(file.path);
        }

        await store.addChunks(allChunks);

        await store.save();

        const stats = store.getStats();
        ctx.ui.notify(
          `Indexed ${uniquePaths.length} files, ${stats.totalChunks} chunks`,
          "info",
        );
      } catch (error) {
        ctx.ui.notify(`Error: ${error}`, "error");
      }
    },
  });

  pi.registerTool({
    name: "rag-search",
    label: "RAG Search Markdown",
    description: `Search indexed markdown files using semantic similarity.

Use this to:
- Find relevant documentation sections
- Answer questions using indexed content
- Locate code examples and explanations

Requires files to be indexed first with rag-index-markdown.`,
    parameters: SearchMarkdownParams,

    async execute(
      _toolCallId: string,
      params: SearchMarkdownParamsType,
      arg1: unknown,
      arg2: unknown,
      arg3?: unknown,
    ) {
      try {
        const { onUpdate } = normalizeExecuteArgs(arg1, arg2, arg3);
        const { query, limit = 5, minSimilarity = 0.3, filePath } = params;

        const store = await getGlobalStore({
          onProgress: onUpdate
            ? (msg) => {
                onUpdate({
                  content: [{ type: "text", text: msg }],
                  details: { status: "searching", message: msg },
                });
              }
            : undefined,
        });

        if (store.size === 0) {
          return textResult(
            "No documents indexed. Use rag-index-markdown first to index markdown files.",
            { query, indexed: false },
          );
        }

        onUpdate?.({
          content: [{ type: "text", text: `Searching for: "${query}"...` }],
          details: { status: "searching", query },
        });

        const results = await store.search(query, {
          limit,
          minSimilarity,
          filePath,
        });

        const formatted = formatSearchResults(results);

        return textResult(formatted, {
          query,
          resultCount: results.length,
          results: results.map((r) => ({
            filePath: r.chunk.filePath,
            type: r.chunk.type,
            similarity: r.similarity,
            heading: r.chunk.heading,
            lines:
              r.chunk.startLine !== undefined
                ? { start: r.chunk.startLine, end: r.chunk.endLine }
                : undefined,
          })),
        });
      } catch (error) {
        return errorResult(error, { query: params.query });
      }
    },
  });

  // Register /rag-stats command
  pi.registerCommand("rag-stats", {
    description: "Show RAG index statistics",
    async handler(_args, ctx) {
      const store = await getGlobalStore();
      const stats = store.getStats();
      const cwd = process.cwd();

      if (stats.totalChunks === 0) {
        ctx.ui.notify(
          "No documents indexed. Use rag-index-markdown first.",
          "warning",
        );
        return;
      }

      const lines = [
        "**RAG Index Statistics**",
        "",
        `- Total chunks: ${stats.totalChunks}`,
        `- Total files: ${stats.totalFiles}`,
        "",
        "**Chunks by type:**",
        ...Object.entries(stats.chunksByType).map(
          ([type, count]) => `  - ${type}: ${count}`,
        ),
        "",
        "**Chunks per file:**",
        ...Object.entries(stats.chunksByFile).map(
          ([file, count]) => `  - ${relative(cwd, file)}: ${count}`,
        ),
      ];

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // Register /rag-clear command
  pi.registerCommand("rag-clear", {
    description: "Clear RAG index (optionally specify a file path)",
    async handler(args, ctx) {
      const filePath = args.trim() || undefined;

      try {
        if (filePath) {
          const store = await getGlobalStore();
          const resolved = resolve(filePath);
          const removed = store.removeFile(resolved);

          await store.save();

          ctx.ui.notify(
            removed > 0
              ? `Removed ${removed} chunks for: ${filePath}`
              : `File not in index: ${filePath}`,
            removed > 0 ? "info" : "warning",
          );
        } else {
          resetGlobalStore();
          // Save empty store to persist the clear
          const emptyStore = await getGlobalStore();
          await emptyStore.save();
          ctx.ui.notify("RAG index cleared.", "info");
        }
      } catch (error) {
        ctx.ui.notify(`Error: ${error}`, "error");
      }
    },
  });
}
