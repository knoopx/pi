import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "code-stats",
    label: "Code Statistics",
    description: `Generate comprehensive statistics about a codebase.

Use this to:
- Understand project size and complexity
- Analyze language distribution
- Track codebase metrics over time
- Assess development effort and scope

Shows file counts, lines of code, and language breakdown.`,
    parameters: Type.Object({
      path: Type.Optional(
        Type.String({
          description: "Path to analyze (default: current directory)",
        }),
      ),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const args = ["stats"];
        if (params.path) {
          args.push(params.path);
        } else {
          args.push(ctx.cwd || ".");
        }

        const result = await pi.exec("cm", args, { signal });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting code statistics: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-map",
    label: "Code Map",
    description: `Create a hierarchical overview of the codebase structure.

Use this to:
- Navigate large codebases efficiently
- Understand project organization
- Find files and symbols quickly
- Get context for development tasks

Supports filtering by patterns and detail levels.`,
    parameters: Type.Object({
      patterns: Type.Optional(
        Type.Array(
          Type.String({
            description:
              "Glob patterns to include files (e.g., ['src/**/*.ts', 'lib/*.js'])",
          }),
        ),
      ),
      budget: Type.Optional(
        Type.Number({
          description: "Token budget to auto-reduce detail to fit",
        }),
      ),
      exportedOnly: Type.Optional(
        Type.Boolean({ description: "Only include exported symbols" }),
      ),
      noComments: Type.Optional(
        Type.Boolean({ description: "Exclude JSDoc comments" }),
      ),
      noImports: Type.Optional(
        Type.Boolean({ description: "Exclude import lists" }),
      ),
      output: Type.Optional(
        Type.Union([Type.Literal("text"), Type.Literal("json")], {
          description: "Output format",
        }),
      ),
    }),

    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        // Use codemapper's 'map' command to generate codebase structure
        const args = ["map", ctx.cwd || "."];

        // Add level for detail (similar to token budget concept)
        if (params.budget) {
          // Map budget to level: smaller budget = less detail
          const level = params.budget < 2000 ? 1 : params.budget < 5000 ? 2 : 3;
          args.push("--level", level.toString());
        } else {
          args.push("--level", "2"); // Default level
        }

        // Use 'ai' format for LLM-friendly output, or 'default' for markdown
        const format = params.output === "json" ? "ai" : "ai"; // codemapper doesn't have json, ai is compact
        args.push("--format", format);

        if (params.exportedOnly) {
          args.push("--exports-only");
        }

        // Note: codemapper doesn't have direct equivalents for noComments/noImports
        // The 'ai' format is already compact and excludes verbose details

        const result = await pi.exec("cm", args, { signal });

        if (result.code !== 0) {
          return {
            content: [
              {
                type: "text",
                text: `Error generating codemap: ${result.stderr}`,
              },
            ],
            isError: true,
            details: {},
          };
        }

        let output = result.stdout;
        if (params.output === "json") {
          // Try to convert the output to JSON-like structure
          // For now, just return as text since codemapper outputs formatted text
          output = JSON.stringify({ codemap: output }, null, 2);
        }

        return {
          content: [{ type: "text", text: output }],
          details: { format: params.output || "text" },
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating codemap: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-query",
    label: "Code Query",
    description: `Search for functions, classes, and symbols across the codebase.

Use this to:
- Find specific code elements
- Locate function definitions or usages
- Explore code relationships
- Discover similar patterns

Supports fuzzy and exact matching.`,
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (function name, class name, etc.)",
      }),
      exact: Type.Optional(
        Type.Boolean({
          description: "Use exact matching instead of fuzzy search",
        }),
      ),
      showBody: Type.Optional(
        Type.Boolean({
          description: "Include the actual code implementation",
        }),
      ),
      exportsOnly: Type.Optional(
        Type.Boolean({
          description: "Only show exported/public symbols",
        }),
      ),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const args = ["query", params.query];

        if (params.exact) {
          args.push("--exact");
        }

        if (params.showBody) {
          args.push("--show-body");
        }

        if (params.exportsOnly) {
          args.push("--exports-only");
        }

        const result = await pi.exec("cm", args, { signal });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error querying code: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-inspect",
    label: "Code Inspect",
    description: `Examine the structure and symbols within a specific file.

Use this to:
- Understand file contents and organization
- Find functions, classes, and variables
- Review import/export relationships
- Analyze individual file complexity

Shows detailed breakdown of file components.`,
    parameters: Type.Object({
      file: Type.String({
        description: "Path to the file to inspect",
      }),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const result = await pi.exec("cm", ["inspect", params.file], {
          signal,
        });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error inspecting file: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-callers",
    label: "Code Callers",
    description: `Find all locations where a specific function or symbol is used.

Use this to:
- Understand function dependencies
- Trace code usage patterns
- Refactor safely by finding all references
- Analyze impact of code changes

Shows reverse dependencies and call sites.`,
    parameters: Type.Object({
      symbol: Type.String({
        description: "Symbol name to find callers for",
      }),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const result = await pi.exec("cm", ["callers", params.symbol], {
          signal,
        });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error finding callers: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-callees",
    label: "Code Callees",
    description: `Find all functions and symbols called by a specific function.

Use this to:
- Analyze function dependencies
- Understand call graphs and relationships
- Identify coupling between components
- Debug complex function interactions

Shows forward dependencies and call chains.`,
    parameters: Type.Object({
      symbol: Type.String({
        description: "Symbol name to find callees for",
      }),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const result = await pi.exec("cm", ["callees", params.symbol], {
          signal,
        });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error finding callees: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-trace",
    label: "Code Trace",
    description: `Trace the call path between two functions or symbols.

Use this to:
- Understand how functions are connected
- Debug complex interaction flows
- Find the shortest path between code elements
- Analyze system architecture

Shows the call chain linking the symbols.`,
    parameters: Type.Object({
      from: Type.String({
        description: "Starting symbol",
      }),
      to: Type.String({
        description: "Target symbol",
      }),
    }),
    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const result = await pi.exec("cm", ["trace", params.from, params.to], {
          signal,
        });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error tracing call path: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "code-deps",
    label: "Code Dependencies",
    description: `Analyze import and dependency relationships in the codebase.

Use this to:
- Identify circular dependencies
- Understand module coupling
- Find external package usage
- Optimize import structures

Supports forward and reverse dependency analysis.`,
    parameters: Type.Object({
      file: Type.Optional(
        Type.String({ description: "File path to analyze dependencies for" }),
      ),
      reverse: Type.Optional(
        Type.Boolean({
          description: "Show reverse dependencies (who imports this file)",
        }),
      ),
      depth: Type.Optional(
        Type.Number({ description: "Limit dependency tree depth" }),
      ),
      external: Type.Optional(
        Type.Boolean({ description: "List all external packages used" }),
      ),
      circular: Type.Optional(
        Type.Boolean({ description: "Find circular dependencies" }),
      ),
    }),

    async execute(toolCallId, params, onUpdate, ctx, signal) {
      try {
        const args = ["deps"];

        if (params.file) {
          args.push(params.file);
        }

        if (params.reverse) {
          args.push("--reverse");
        }

        if (params.depth) {
          args.push("--depth", params.depth.toString());
        }

        if (params.external) {
          args.push("--external");
        }

        if (params.circular) {
          args.push("--circular");
        }

        const result = await pi.exec("cm", args, { signal });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Error: ${result.stderr}` }],
            details: {},
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: result.stdout }],
          details: {},
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error analyzing dependencies: ${error.message}`,
            },
          ],
          details: {},
          isError: true,
        };
      }
    },
  });
}
