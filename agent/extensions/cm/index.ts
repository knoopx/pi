import type {
  AgentToolResult,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

const MAX_OUTPUT_BYTES = 50 * 1024;
const MAX_OUTPUT_LINES = 2000;

const OutputFormat = StringEnum(["default", "human", "ai"] as const);
const ContextMode = StringEnum(["minimal", "full"] as const);

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
  pi.registerTool({
    name: "cm-help",
    label: "CM Help",
    description:
      "Show cm help text. Optionally show help for a specific cm command.",
    parameters: Type.Object({
      command: Type.Optional(
        Type.String({ description: "Optional cm subcommand name, e.g. query" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = params.command ? [params.command, "--help"] : ["--help"];
      return runCm(pi, args, signal);
    },
  });

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

  pi.registerTool({
    name: "cm-map",
    label: "CM Map",
    description: "Generate a project map showing files and symbols.",
    parameters: Type.Object({
      ...CommonFlagProps,
      level: Type.Optional(
        Type.Integer({
          minimum: 1,
          maximum: 3,
          description: "Detail level: 1, 2, or 3",
        }),
      ),
      exportsOnly: Type.Optional(
        Type.Boolean({ description: "Show only exported/public symbols" }),
      ),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      context: Type.Optional(
        Type.Union([ContextMode, Type.String()], {
          description: "Context amount: minimal or full",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["map"];
      appendPath(args, params.path);
      if (params.level !== undefined)
        args.push("--level", String(params.level));
      if (params.exportsOnly) args.push("--exports-only");
      if (params.full) args.push("--full");
      if (params.context) args.push("--context", params.context);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-query",
    label: "CM Query",
    description: "Search symbols by name across the codebase.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Symbol name to search for" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
      showBody: Type.Optional(
        Type.Boolean({ description: "Include symbol body/implementation" }),
      ),
      exportsOnly: Type.Optional(
        Type.Boolean({ description: "Only exported symbols" }),
      ),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      context: Type.Optional(
        Type.Union([ContextMode, Type.String()], {
          description: "Context amount: minimal or full",
        }),
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
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-inspect",
    label: "CM Inspect",
    description: "Inspect one file and list all symbols it contains.",
    parameters: Type.Object({
      ...CommonFlagProps,
      filePath: Type.String({ description: "File to inspect" }),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      context: Type.Optional(
        Type.Union([ContextMode, Type.String()], {
          description: "Context amount: minimal or full",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["inspect", params.filePath];
      if (params.full) args.push("--full");
      if (params.context) args.push("--context", params.context);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-deps",
    label: "CM Deps",
    description: "Analyze import relationships and symbol usage dependencies.",
    parameters: Type.Object({
      ...CommonFlagProps,
      circular: Type.Optional(
        Type.Boolean({ description: "Show only circular dependencies" }),
      ),
      unused: Type.Optional(
        Type.Boolean({ description: "Show unused files/modules" }),
      ),
      unusedSymbols: Type.Optional(
        Type.Boolean({ description: "Show unused symbols" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["deps"];
      appendPath(args, params.path);
      if (params.circular) args.push("--circular");
      if (params.unused) args.push("--unused");
      if (params.unusedSymbols) args.push("--unused-symbols");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-index",
    label: "CM Index",
    description: "Validate that files can be indexed correctly.",
    parameters: Type.Object({ ...CommonFlagProps }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["index"];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-diff",
    label: "CM Diff",
    description:
      "Show symbol-level changes between current code and a git commit.",
    parameters: Type.Object({
      ...CommonFlagProps,
      commit: Type.String({
        description: "Git ref to compare against (e.g. main, HEAD~1)",
      }),
      showBody: Type.Optional(
        Type.Boolean({ description: "Include symbol body in diff output" }),
      ),
      breaking: Type.Optional(
        Type.Boolean({ description: "Focus on breaking API changes" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["diff", params.commit];
      appendPath(args, params.path);
      if (params.showBody) args.push("--show-body");
      if (params.breaking) args.push("--breaking");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-callers",
    label: "CM Callers",
    description: "Find all callers of a function/method symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
      showBody: Type.Optional(
        Type.Boolean({ description: "Include symbol body" }),
      ),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      context: Type.Optional(
        Type.Union([ContextMode, Type.String()], {
          description: "Context amount: minimal or full",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["callers", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      if (params.showBody) args.push("--show-body");
      if (params.full) args.push("--full");
      if (params.context) args.push("--context", params.context);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-callees",
    label: "CM Callees",
    description: "Find all functions/methods called by a symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
      showBody: Type.Optional(
        Type.Boolean({ description: "Include symbol body" }),
      ),
      full: Type.Optional(
        Type.Boolean({ description: "Include anonymous/lambda functions" }),
      ),
      context: Type.Optional(
        Type.Union([ContextMode, Type.String()], {
          description: "Context amount: minimal or full",
        }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["callees", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      if (params.showBody) args.push("--show-body");
      if (params.full) args.push("--full");
      if (params.context) args.push("--context", params.context);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-tests",
    label: "CM Tests",
    description: "Find test functions that call a given symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["tests", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

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

  pi.registerTool({
    name: "cm-since",
    label: "CM Since",
    description:
      "Show API changes since a git commit, optionally only breaking changes.",
    parameters: Type.Object({
      ...CommonFlagProps,
      commit: Type.String({
        description: "Git ref baseline (e.g. main, v1.0, HEAD~1)",
      }),
      breaking: Type.Optional(
        Type.Boolean({ description: "Only show breaking changes" }),
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

  pi.registerTool({
    name: "cm-entrypoints",
    label: "CM Entrypoints",
    description: "Find exported symbols with no internal callers.",
    parameters: Type.Object({ ...CommonFlagProps }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["entrypoints"];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-trace",
    label: "CM Trace",
    description: "Find the shortest call path from one symbol to another.",
    parameters: Type.Object({
      ...CommonFlagProps,
      fromSymbol: Type.String({ description: "Start symbol" }),
      toSymbol: Type.String({ description: "Destination symbol" }),
      reverse: Type.Optional(
        Type.Boolean({ description: "Reverse the trace direction" }),
      ),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact symbol matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["trace", params.fromSymbol, params.toSymbol];
      appendPath(args, params.path);
      if (params.reverse) args.push("--reverse");
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-impact",
    label: "CM Impact",
    description:
      "Quick breakage report for a symbol (definition, callers, tests).",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["impact", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-test-deps",
    label: "CM Test Deps",
    description: "List production symbols used by a test file.",
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

  pi.registerTool({
    name: "cm-blame",
    label: "CM Blame",
    description: "Show who last modified a symbol and when.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      filePath: Type.Optional(
        Type.String({
          description: "Optional file path to disambiguate symbol",
        }),
      ),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["blame", params.symbol];
      if (params.filePath) args.push(params.filePath);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-history",
    label: "CM History",
    description: "Show git evolution history for a symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      filePath: Type.Optional(
        Type.String({
          description: "Optional file path to disambiguate symbol",
        }),
      ),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["history", params.symbol];
      if (params.filePath) args.push(params.filePath);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-implements",
    label: "CM Implements",
    description: "Find all classes/structs implementing an interface or trait.",
    parameters: Type.Object({
      ...CommonFlagProps,
      interfaceName: Type.String({ description: "Interface or trait name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["implements", params.interfaceName];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-types",
    label: "CM Types",
    description: "Analyze parameter and return types for a symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      symbol: Type.String({ description: "Target symbol name" }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["types", params.symbol];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-schema",
    label: "CM Schema",
    description: "Display the field schema for a data structure symbol.",
    parameters: Type.Object({
      ...CommonFlagProps,
      typeName: Type.String({
        description: "Type/class/struct/dataclass name",
      }),
      exact: Type.Optional(
        Type.Boolean({ description: "Enable exact matching" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["schema", params.typeName];
      appendPath(args, params.path);
      if (params.exact) args.push("--exact");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-snapshot",
    label: "CM Snapshot",
    description: "Save a named codebase snapshot for future comparison.",
    parameters: Type.Object({
      ...CommonFlagProps,
      name: Type.String({ description: "Snapshot name" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["snapshot", params.name];
      appendPath(args, params.path);
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });

  pi.registerTool({
    name: "cm-compare",
    label: "CM Compare",
    description: "Compare current codebase symbols against a saved snapshot.",
    parameters: Type.Object({
      ...CommonFlagProps,
      name: Type.String({ description: "Snapshot name" }),
      showBody: Type.Optional(
        Type.Boolean({ description: "Include symbol body in compare output" }),
      ),
      breaking: Type.Optional(
        Type.Boolean({ description: "Focus on breaking API changes" }),
      ),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
      const args = ["compare", params.name];
      appendPath(args, params.path);
      if (params.showBody) args.push("--show-body");
      if (params.breaking) args.push("--breaking");
      appendCommonFlags(args, params);
      return runCm(pi, args, signal);
    },
  });
}
