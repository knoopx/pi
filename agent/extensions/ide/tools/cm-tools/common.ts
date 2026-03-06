/**
 * Common utilities for CM tools
 */

import { Type, type TObject, type TProperties } from "@sinclair/typebox";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;

// Common parameter schemas
const PathParam = Type.Optional(
  Type.String({
    description:
      "Path to analyze (defaults to current directory where supported)",
  }),
);

const CacheDirParam = Type.Optional(
  Type.String({ description: "Override CodeMapper cache directory" }),
);

const NoCacheParam = Type.Optional(
  Type.Boolean({ description: "Disable cache for this command" }),
);

const RebuildCacheParam = Type.Optional(
  Type.Boolean({ description: "Force cache rebuild before running" }),
);

const ExtensionsParam = Type.Optional(
  Type.Array(Type.String(), {
    description: 'Limit indexing to these file extensions (e.g. ["ts","py"])',
  }),
);

export const SymbolParam = Type.String({ description: "Target symbol name" });

export const FuzzyParam = Type.Optional(
  Type.Boolean({ description: "Enable fuzzy matching for symbol lookup" }),
);

export const LimitParam = Type.Optional(
  Type.Integer({ description: "Maximum number of results to return" }),
);

export const ExportsOnlyParam = Type.Optional(
  Type.Boolean({ description: "Show only exported/public symbols" }),
);

export const ShowBodyParam = Type.Optional(
  Type.Boolean({ description: "Show the actual code implementation" }),
);

export const FullParam = Type.Optional(
  Type.Boolean({ description: "Include anonymous/lambda functions" }),
);

export const FilePathParam = Type.String({ description: "Path to the file" });

// Common parameter sets (no format - always use ai)
export const CommonParams = {
  path: PathParam,
  cacheDir: CacheDirParam,
  noCache: NoCacheParam,
  rebuildCache: RebuildCacheParam,
  extensions: ExtensionsParam,
};

export interface CommonParamsType {
  path?: string;
  cacheDir?: string;
  noCache?: boolean;
  rebuildCache?: boolean;
  extensions?: string[];
}

export interface CmToolParams extends CommonParamsType {
  symbol?: string;
  fromSymbol?: string;
  toSymbol?: string;
  fuzzy?: boolean;
}

export function withCommonParams<T extends TProperties>(
  extra: T,
): TObject<T & typeof CommonParams> {
  return Type.Object({ ...CommonParams, ...extra } as T & typeof CommonParams);
}

function truncateOutput(text: string): {
  text: string;
  truncated: boolean;
} {
  const lines = text.split("\n");
  let out = text;
  let truncated = false;

  if (lines.length > MAX_OUTPUT_LINES) {
    out = lines.slice(0, MAX_OUTPUT_LINES).join("\n");
    truncated = true;
  }

  if (Buffer.byteLength(out, "utf8") > MAX_OUTPUT_BYTES) {
    out = Buffer.from(out, "utf8")
      .subarray(0, MAX_OUTPUT_BYTES)
      .toString("utf8");
    truncated = true;
  }

  if (truncated) {
    out += "\n\n[Output truncated to 2000 lines / 50KB]";
  }

  return { text: out, truncated };
}

export function appendCommonFlags(args: string[], params: CommonParamsType) {
  args.push("--format", "ai"); // Always use ai format
  if (params.cacheDir) args.push("--cache-dir", params.cacheDir);
  if (params.noCache) args.push("--no-cache");
  if (params.rebuildCache) args.push("--rebuild-cache");
  if (params.extensions?.length)
    args.push("--extensions", params.extensions.join(","));
}

export async function runCm(
  commandArgs: string[],
  signal: AbortSignal | undefined,
  cwd: string,
) {
  try {
    const result = await execAsync(`cm ${commandArgs.join(" ")}`, {
      cwd,
      signal,
      timeout: 30_000,
      maxBuffer: MAX_OUTPUT_BYTES,
    });

    const raw = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    const output = raw || "No output.";
    const truncated = truncateOutput(output);

    return {
      content: [{ type: "text" as const, text: truncated.text }],
      details: {
        exitCode: 0,
        command: `cm ${commandArgs.join(" ")}`,
        truncated: truncated.truncated,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text" as const, text: `Failed to run cm: ${message}` },
      ],
      details: { command: `cm ${commandArgs.join(" ")}` },
    };
  }
}

/** Execute a CM tool with common parameters */
export async function executeCmTool(
  command: string,
  params: CmToolParams,
  signal: AbortSignal | undefined,
  ctx: { cwd: string },
): Promise<{
  content: { type: "text"; text: string }[];
  details: Record<string, unknown>;
}> {
  const args = [command];
  if (params.symbol) args.push(params.symbol);
  if (params.fromSymbol) args.push(params.fromSymbol);
  if (params.toSymbol) args.push(params.toSymbol);
  if (params.path) args.push(params.path);
  appendCommonFlags(args, params);
  if (params.fuzzy) args.push("--fuzzy");
  return runCm(args, signal, ctx.cwd);
}
