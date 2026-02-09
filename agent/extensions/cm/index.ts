import type {
  AgentToolResult,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;

const OutputFormat = StringEnum(["default", "human", "ai"] as const);

const CommonFlagProps = {
  path: Type.Optional(
    Type.String({
      description:
        "Path to analyze (defaults to current directory where supported)",
    }),
  ),
  format: Type.Optional(
    Type.Union([OutputFormat, Type.String()], {
      description: "Output format (default|human|ai)",
    }),
  ),
  cacheDir: Type.Optional(
    Type.String({ description: "Override CodeMapper cache directory" }),
  ),
  noCache: Type.Optional(
    Type.Boolean({ description: "Disable cache for this command" }),
  ),
  rebuildCache: Type.Optional(
    Type.Boolean({ description: "Force cache rebuild before running" }),
  ),
  extensions: Type.Optional(
    Type.Array(Type.String(), {
      description: 'Limit indexing to these file extensions (e.g. ["ts","py"])',
    }),
  ),
};

type CommonFlags = {
  path?: string;
  format?: string;
  cacheDir?: string;
  noCache?: boolean;
  rebuildCache?: boolean;
  extensions?: string[];
};

function appendCommonFlags(args: string[], params: CommonFlags) {
  if (params.format) {
    args.push("--format", params.format);
  }

  if (params.cacheDir) {
    args.push("--cache-dir", params.cacheDir);
  }

  if (params.noCache) {
    args.push("--no-cache");
  }

  if (params.rebuildCache) {
    args.push("--rebuild-cache");
  }

  if (params.extensions && params.extensions.length > 0) {
    args.push("--extensions", params.extensions.join(","));
  }
}

function appendPath(args: string[], path?: string) {
  if (path) {
    args.push(path);
  }
}

function truncateOutput(text: string): { text: string; truncated: boolean } {
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

async function runCm(
  pi: ExtensionAPI,
  commandArgs: string[],
  signal: AbortSignal | undefined,
): Promise<AgentToolResult<Record<string, unknown>>> {
  try {
    const result = await pi.exec("cm", commandArgs, {
      signal,
      timeout: 30_000,
    });

    const raw = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    const output = raw || "No output.";
    const truncated = truncateOutput(output);

    if (result.code !== 0) {
      return {
        content: [
          {
            type: "text",
            text: truncated.text,
          },
        ],
        details: {
          exitCode: result.code,
          command: `cm ${commandArgs.join(" ")}`,
          stdout: result.stdout,
          stderr: result.stderr,
          truncated: truncated.truncated,
        },
      };
    }

    return {
      content: [{ type: "text", text: truncated.text }],
      details: {
        exitCode: result.code,
        command: `cm ${commandArgs.join(" ")}`,
        truncated: truncated.truncated,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Failed to run cm: ${message}` }],
      details: {
        command: `cm ${commandArgs.join(" ")}`,
      },
    };
  }
}

export default function cmExtension(pi: ExtensionAPI) {
  // cm-stats: Display project statistics
  pi.registerTool({
    name: "cm-stats",
    label: "CM Stats",
    description:
      "Display project statistics: file counts, symbol breakdown, and parse performance.",
    parameters: Type.Object({ ...CommonFlagProps }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["stats"];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-map: Generate a project map showing files and symbols
  pi.registerTool({
    name: "cm-map",
    label: "CM Map",
    description:
      "Generate a project map showing files and symbols at different detail levels.",
    parameters: Type.Object({
      ...CommonFlagProps,
      level: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 3,
          description:
            "Detail level: 1=overview, 2=files with counts, 3=full symbols",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["map"];
      appendPath(args, params.path);
      if (params.level !== undefined)
        args.push("--level", String(params.level));
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-query: Search symbols by name across the codebase
  pi.registerTool({
    name: "cm-query",
    label: "CM Query",
    description:
      "Search symbols by name across the codebase. Fuzzy matching by default.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Symbol name to search for" }),
      exact: Type.Optional(
        Type.Boolean({
          description: "Use exact matching instead of fuzzy (default is fuzzy)",
        }),
      ),
      showBody: Type.Optional(
        Type.Boolean({ description: "Show the actual code implementation" }),
      ),
      exportsOnly: Type.Optional(
        Type.Boolean({ description: "Show only exported/public symbols" }),
      ),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      context: Type.Optional(
        Type.String({
          description:
            "Context level: 'minimal' (signatures only) or 'full' (includes docstrings)",
        }),
      ),
      type: Type.Optional(
        Type.String({
          description:
            "Filter by symbol type: function, class, method, enum, static, heading, code_block",
        }),
      ),
      fast: Type.Optional(
        Type.Boolean({
          description:
            "Enable fast mode explicitly (auto-enabled for 1000+ files)",
        }),
      ),
      limit: Type.Optional(
        Type.Integer({ description: "Maximum number of results to return" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["query", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      if (params.showBody) args.push("--show-body");
      if (params.exportsOnly) args.push("--exports-only");
      if (params.full) args.push("--full");
      if (params.context) args.push("--context", params.context);
      if (params.type) args.push("--type", params.type);
      if (params.fast) args.push("--fast");
      if (params.limit !== undefined)
        args.push("--limit", String(params.limit));
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-inspect: Analyze one file and list all symbols it contains
  pi.registerTool({
    name: "cm-inspect",
    label: "CM Inspect",
    description: "Inspect one file and list all symbols it contains.",
    parameters: Type.Object({
      ...CommonFlagProps,
      filePath: Type.String({ description: "File to inspect" }),
      showBody: Type.Optional(
        Type.Boolean({ description: "Show the actual code implementation" }),
      ),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      exportsOnly: Type.Optional(
        Type.Boolean({ description: "Show only exported/public symbols" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["inspect", params.filePath];
      if (params.showBody) args.push("--show-body");
      if (params.full) args.push("--full");
      if (params.exportsOnly) args.push("--exports-only");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-deps: Analyze import relationships and symbol usage
  pi.registerTool({
    name: "cm-deps",
    label: "CM Deps",
    description:
      "Analyze import relationships and symbol usage. Use direction='used-by' to find reverse dependencies.",
    parameters: Type.Object({
      ...CommonFlagProps,
      target: Type.String({
        description: "File path (./src/auth.py) or symbol name (authenticate)",
      }),
      direction: Type.Optional(
        Type.String({
          description:
            "'imports' (what target imports) or 'used-by' (what uses target). Default: imports",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["deps", params.target];
      appendPath(args, params.path);
      if (params.direction) args.push("--direction", params.direction);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-diff: Show symbol-level changes between current code and a git commit
  pi.registerTool({
    name: "cm-diff",
    label: "CM Diff",
    description:
      "Show symbol-level changes between current code and a git commit.",
    parameters: Type.Object({
      ...CommonFlagProps,
      commit: Type.String({
        description: "Git ref to compare against (e.g. main, HEAD~1, v1.0)",
      }),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["diff", params.commit];
      appendPath(args, params.path);
      if (params.full) args.push("--full");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-callers: Find all callers of a function/method symbol
  pi.registerTool({
    name: "cm-callers",
    label: "CM Callers",
    description:
      "Find all callers of a function/method symbol. Use qualified names (e.g. Foo::new) to reduce noise.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      fuzzy: Type.Optional(
        Type.Boolean({
          description: "Enable fuzzy matching for symbol lookup",
        }),
      ),
      limit: Type.Optional(
        Type.Integer({ description: "Maximum number of results to return" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["callers", params.symbol];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      if (params.limit !== undefined)
        args.push("--limit", String(params.limit));
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-callees: Find all functions/methods called by a symbol
  pi.registerTool({
    name: "cm-callees",
    label: "CM Callees",
    description: "Find all functions/methods called by a symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      fuzzy: Type.Optional(
        Type.Boolean({
          description: "Enable fuzzy matching for symbol lookup",
        }),
      ),
      limit: Type.Optional(
        Type.Integer({ description: "Maximum number of results to return" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["callees", params.symbol];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      if (params.limit !== undefined)
        args.push("--limit", String(params.limit));
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-tests: Find test functions that call a given symbol
  pi.registerTool({
    name: "cm-tests",
    label: "CM Tests",
    description: "Find test functions that call a given symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      fuzzy: Type.Optional(
        Type.Boolean({ description: "Enable fuzzy matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["tests", params.symbol];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-untested: Find functions and methods not called by any tests
  pi.registerTool({
    name: "cm-untested",
    label: "CM Untested",
    description: "Find functions and methods not called by any tests.",
    parameters: Type.Object({ ...CommonFlagProps }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["untested"];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-since: Show API changes since a git commit
  pi.registerTool({
    name: "cm-since",
    label: "CM Since",
    description:
      "Show API changes since a git commit. Use --breaking to show only breaking changes.",
    parameters: Type.Object({
      ...CommonFlagProps,
      commit: Type.String({
        description: "Git ref baseline (e.g. main, v1.0, HEAD~1)",
      }),
      breaking: Type.Optional(
        Type.Boolean({
          description:
            "Only show breaking changes (deleted symbols, signature changes)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["since", params.commit];
      appendPath(args, params.path);
      if (params.breaking) args.push("--breaking");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-entrypoints: Find exported symbols with no internal callers
  pi.registerTool({
    name: "cm-entrypoints",
    label: "CM Entrypoints",
    description:
      "Find exported symbols with no internal callers. Useful for finding public API surface or dead code.",
    parameters: Type.Object({ ...CommonFlagProps }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["entrypoints"];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-trace: Find the shortest call path from one symbol to another
  pi.registerTool({
    name: "cm-trace",
    label: "CM Trace",
    description:
      "Find the shortest call path from one symbol to another using BFS.",
    parameters: Type.Object({
      ...CommonFlagProps,
      fromSymbol: Type.String({ description: "Start symbol" }),
      toSymbol: Type.String({ description: "Destination symbol" }),
      fuzzy: Type.Optional(
        Type.Boolean({ description: "Enable fuzzy matching for symbol names" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["trace", params.fromSymbol, params.toSymbol];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-impact: Quick breakage report for a symbol
  pi.registerTool({
    name: "cm-impact",
    label: "CM Impact",
    description:
      "Quick breakage report for a symbol: definition + callers + tests. Run after editing a function.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Use exact matching (default is fuzzy)" }),
      ),
      includeDocs: Type.Optional(
        Type.Boolean({
          description: "Include markdown headings/code blocks as candidates",
        }),
      ),
      limit: Type.Optional(
        Type.Integer({
          description: "Maximum callers/tests to show (default: 10 each)",
        }),
      ),
      all: Type.Optional(
        Type.Boolean({ description: "Show full lists (ignores --limit)" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["impact", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      if (params.includeDocs) args.push("--include-docs");
      if (params.limit !== undefined)
        args.push("--limit", String(params.limit));
      if (params.all) args.push("--all");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-test-deps: List production symbols used by a test file
  pi.registerTool({
    name: "cm-test-deps",
    label: "CM Test Deps",
    description: "List production (non-test) symbols called by a test file.",
    parameters: Type.Object({
      ...CommonFlagProps,
      testFile: Type.String({ description: "Path to a test file" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["test-deps", params.testFile];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-blame: Show who last modified a symbol and when
  pi.registerTool({
    name: "cm-blame",
    label: "CM Blame",
    description: "Show who last modified a symbol and when.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      filePath: Type.String({
        description: "Path to the file containing the symbol",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["blame", params.symbol, params.filePath];
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-history: Show git evolution history for a symbol
  pi.registerTool({
    name: "cm-history",
    label: "CM History",
    description: "Show the evolution of a symbol across git history.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      filePath: Type.String({
        description: "Path to the file containing the symbol",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["history", params.symbol, params.filePath];
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-implements: Find all classes/structs implementing an interface or trait
  pi.registerTool({
    name: "cm-implements",
    label: "CM Implements",
    description: "Find all classes/structs implementing an interface or trait.",
    parameters: Type.Object({
      ...CommonFlagProps,
      interfaceName: Type.String({ description: "Interface or trait name" }),
      fuzzy: Type.Optional(
        Type.Boolean({ description: "Enable fuzzy matching" }),
      ),
      traitOnly: Type.Optional(
        Type.Boolean({
          description:
            "Only show trait implementations (filter out inherent impls)",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["implements", params.interfaceName];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      if (params.traitOnly) args.push("--trait-only");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-types: Analyze parameter and return types for a symbol
  pi.registerTool({
    name: "cm-types",
    label: "CM Types",
    description:
      "Analyze parameter and return types for a symbol and locate their definitions.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      fuzzy: Type.Optional(
        Type.Boolean({ description: "Enable fuzzy matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["types", params.symbol];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-schema: Display the field schema for a data structure symbol
  pi.registerTool({
    name: "cm-schema",
    label: "CM Schema",
    description:
      "Display field schema for data structures (structs, classes, dataclasses, interfaces).",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({
        description: "Type/class/struct/interface name",
      }),
      fuzzy: Type.Optional(
        Type.Boolean({ description: "Enable fuzzy matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["schema", params.symbol];
      appendPath(args, params.path);
      if (params.fuzzy) args.push("--fuzzy");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-snapshot: Save a named codebase snapshot for future comparison
  pi.registerTool({
    name: "cm-snapshot",
    label: "CM Snapshot",
    description:
      "Save a named codebase snapshot for future comparison, or list/delete snapshots.",
    parameters: Type.Object({
      ...CommonFlagProps,
      name: Type.Optional(
        Type.String({ description: "Snapshot name (required unless --list)" }),
      ),
      list: Type.Optional(
        Type.Boolean({ description: "List all saved snapshots" }),
      ),
      delete: Type.Optional(
        Type.String({ description: "Delete a snapshot by name" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["snapshot"];
      if (params.list) {
        args.push("--list");
      } else if (params.delete) {
        args.push("--delete", params.delete);
      } else if (params.name) {
        args.push(params.name);
        appendPath(args, params.path);
      }
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  // cm-compare: Compare current codebase symbols against a saved snapshot
  pi.registerTool({
    name: "cm-compare",
    label: "CM Compare",
    description:
      "Compare current codebase symbols against a saved snapshot. Shows ADDED, DELETED, MODIFIED, SIGNATURE_CHANGED.",
    parameters: Type.Object({
      ...CommonFlagProps,
      snapshot: Type.String({
        description: "Snapshot name to compare against",
      }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["compare", params.snapshot];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });
}
