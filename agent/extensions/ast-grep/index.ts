/**
 * ast-grep Extension - Tools for structural code search and rewriting using ast-grep
 */

import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import {
  truncateHead,
  formatSize,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";

// Supported languages from the skill documentation
const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "tsx",
  "html",
  "css",
  "python",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "yaml",
] as const;

export default function (pi: ExtensionAPI) {
  // Check if ast-grep is available
  pi.on("session_start", async (_event: any, ctx: ExtensionContext) => {
    try {
      await pi.exec("ast-grep", ["--version"], {
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      ctx.ui.notify(
        "ast-grep not found. Install it to use ast-grep tools.",
        "warning",
      );
    }
  });

  // Tool: Structural search
  pi.registerTool({
    name: "ast-search",
    label: "AST Search",
    description: `Search for code patterns using structural AST matching.

Use this to:
- Find complex code patterns across files
- Locate function calls, variable usages, or syntax patterns
- Analyze code structure without regex limitations
- Debug and understand code relationships

Supports pattern variables and multiple languages.`,
    parameters: Type.Object({
      pattern: Type.String({
        description:
          "The ast-grep pattern to search for (e.g., 'console.log($$$ARGS)')",
      }),
      language: StringEnum(SUPPORTED_LANGUAGES, {
        description: "Programming language for AST parsing",
      }),
      path: Type.Optional(
        Type.String({
          description:
            "Directory or file to search in (default: current directory)",
        }),
      ),
      debug: Type.Optional(
        Type.Boolean({ description: "Debug the pattern to see AST structure" }),
      ),
    }),

    async execute(
      toolCallId: string,
      params: any,
      onUpdate: AgentToolUpdateCallback,
      ctx: ExtensionContext,
      signal: AbortSignal,
    ) {
      const {
        pattern,
        language,
        path = ".",
        debug = false,
      } = params as {
        pattern: string;
        language: string;
        path?: string;
        debug?: boolean;
      };

      const args = ["run", "--pattern", pattern, "--lang", language, "--json"];
      if (debug) {
        args.push("--debug-query=cst");
      } else {
        args.push("--json");
      }
      args.push(path);

      const result = await pi.exec("ast-grep", args, { signal });

      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `ast-grep error: ${result.stderr}` }],
          details: {},
        };
      }

      let output = result.stdout;
      if (debug) {
        return {
          content: [{ type: "text", text: output }],
          details: { pattern, language, debug: true },
        };
      }

      // Parse JSON output for matches
      try {
        const matches = JSON.parse(output);
        const matchCount = matches.length;
        let summary = `Found ${matchCount} matches for pattern '${pattern}' in ${language}:\n\n`;

        for (let i = 0; i < Math.min(matches.length, 10); i++) {
          const match = matches[i];
          summary += `Match ${i + 1}:\n`;
          summary += `File: ${match.file}\n`;
          summary += `Line: ${match.range.start.line + 1}\n`;
          summary += `Code: ${match.lines.trim()}\n\n`;
        }

        if (matches.length > 10) {
          summary += `... and ${matches.length - 10} more matches\n`;
        }

        // Truncate if too long
        const truncation = truncateHead(summary, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        let finalOutput = truncation.content;
        if (truncation.truncated) {
          finalOutput += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
          finalOutput += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
          finalOutput += ` Full results in raw output above.]`;
        }

        return {
          content: [{ type: "text", text: finalOutput }],
          details: {
            pattern,
            language,
            matchCount,
            matches: matches.slice(0, 10),
          },
        };
      } catch (parseError) {
        // Fallback to raw output
        const truncation = truncateHead(output, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        let finalOutput = truncation.content;
        if (truncation.truncated) {
          finalOutput += `\n\n[Output truncated. Full output in stderr above.]`;
        }

        return {
          content: [
            { type: "text", text: `Raw ast-grep output:\n${finalOutput}` },
          ],
          details: { pattern, language, raw: true },
        };
      }
    },
  });

  // Tool: Structural search and replace
  pi.registerTool({
    name: "ast-replace",
    label: "AST Replace",
    description: `Perform safe structural search and replace operations.

Use this to:
- Refactor code patterns across multiple files
- Apply consistent changes to similar code structures
- Transform function signatures or variable names
- Automate code modernization tasks

Always use dry-run first to preview changes.`,
    parameters: Type.Object({
      pattern: Type.String({ description: "The ast-grep pattern to match" }),
      rewrite: Type.String({
        description: "The replacement pattern using $VAR references",
      }),
      language: StringEnum(SUPPORTED_LANGUAGES, {
        description: "Programming language for AST parsing",
      }),
      path: Type.Optional(
        Type.String({
          description:
            "Directory or file to search in (default: current directory)",
        }),
      ),
      dryRun: Type.Optional(
        Type.Boolean({
          description: "Preview changes without applying them",
          default: true,
        }),
      ),
    }),

    async execute(
      toolCallId: string,
      params: any,
      onUpdate: AgentToolUpdateCallback,
      ctx: ExtensionContext,
      signal: AbortSignal,
    ) {
      const {
        pattern,
        rewrite,
        language,
        path = ".",
        dryRun = true,
      } = params as {
        pattern: string;
        rewrite: string;
        language: string;
        path?: string;
        dryRun?: boolean;
      };

      const args = [
        "run",
        "--pattern",
        pattern,
        "--rewrite",
        rewrite,
        "--lang",
        language,
      ];
      if (dryRun) {
        args.push("--json");
      } else {
        args.push("--update-all");
      }
      args.push(path);

      const result = await pi.exec("ast-grep", args, { signal });

      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `ast-grep error: ${result.stderr}` }],
          details: {},
        };
      }

      if (dryRun) {
        // Parse JSON output for preview
        try {
          const changes = JSON.parse(result.stdout);
          let summary = `Preview: ${changes.length} potential replacements for pattern '${pattern}' with '${rewrite}':\n\n`;

          for (let i = 0; i < Math.min(changes.length, 5); i++) {
            const change = changes[i];
            summary += `File: ${change.file}\n`;
            summary += `Before: ${change.lines.trim()}\n`;
            summary += `After:  ${change.rewrite.trim()}\n\n`;
          }

          if (changes.length > 5) {
            summary += `... and ${changes.length - 5} more changes\n`;
          }

          summary += `\nUse dryRun: false to apply these changes.`;

          return {
            content: [{ type: "text", text: summary }],
            details: {
              pattern,
              rewrite,
              language,
              changeCount: changes.length,
              changes: changes.slice(0, 5),
              preview: true,
            },
          };
        } catch (parseError) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to parse preview: ${parseError}\nRaw output: ${result.stdout}`,
              },
            ],
            details: {},
          };
        }
      } else {
        // Applied changes
        return {
          content: [
            {
              type: "text",
              text: `Applied ${result.stdout.trim() || "changes"} for pattern '${pattern}' -> '${rewrite}'`,
            },
          ],
          details: { pattern, rewrite, language, applied: true },
        };
      }
    },
  });

  // Tool: Advanced scan with inline rules
  pi.registerTool({
    name: "ast-scan",
    label: "AST Scan",
    description: `Perform advanced structural searches with complex rule conditions.

Use this to:
- Find code patterns with logical combinations
- Search for nested structures or relationships
- Analyze code quality and patterns
- Create custom linting or analysis rules

Supports 'all', 'any', 'not', 'inside', 'has' operators.`,
    parameters: Type.Object({
      rule: Type.String({
        description:
          'Inline rule in JSON format (e.g., \'{"kind": "function_declaration", "has": {"pattern": "await $EXPR"}}\')',
      }),
      language: StringEnum(SUPPORTED_LANGUAGES, {
        description: "Programming language for AST parsing",
      }),
      path: Type.Optional(
        Type.String({
          description:
            "Directory or file to search in (default: current directory)",
        }),
      ),
    }),

    async execute(
      toolCallId: string,
      params: any,
      onUpdate: AgentToolUpdateCallback,
      ctx: ExtensionContext,
      signal: AbortSignal,
    ) {
      const {
        rule,
        language,
        path = ".",
      } = params as {
        rule: string;
        language: string;
        path?: string;
      };

      // Validate JSON
      try {
        JSON.parse(rule);
      } catch (error) {
        return {
          content: [{ type: "text", text: `Invalid JSON rule: ${error}` }],
          details: {},
        };
      }

      const args = [
        "scan",
        "--inline-rules",
        `{"id": "scan-rule", "language": "${language}", "rule": ${rule}}`,
        "--json",
        path,
      ];

      const result = await pi.exec("ast-grep", args, { signal });

      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `ast-grep error: ${result.stderr}` }],
          details: {},
        };
      }

      try {
        const matches = JSON.parse(result.stdout);
        const matchCount = matches.length;
        let summary = `Found ${matchCount} matches for advanced rule in ${language}:\n\n`;

        for (let i = 0; i < Math.min(matches.length, 10); i++) {
          const match = matches[i];
          summary += `Match ${i + 1}:\n`;
          summary += `File: ${match.file}\n`;
          summary += `Line: ${match.range.start.line + 1}\n`;
          summary += `Code: ${match.lines.trim()}\n\n`;
        }

        if (matches.length > 10) {
          summary += `... and ${matches.length - 10} more matches\n`;
        }

        // Truncate if too long
        const truncation = truncateHead(summary, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        let finalOutput = truncation.content;
        if (truncation.truncated) {
          finalOutput += `\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines`;
          finalOutput += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
          finalOutput += ` Full results in raw output above.]`;
        }

        return {
          content: [{ type: "text", text: finalOutput }],
          details: {
            rule,
            language,
            matchCount,
            matches: matches.slice(0, 10),
          },
        };
      } catch (parseError) {
        // Fallback to raw output
        const truncation = truncateHead(result.stdout, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        let finalOutput = truncation.content;
        if (truncation.truncated) {
          finalOutput += `\n\n[Output truncated. Full output in stderr above.]`;
        }

        return {
          content: [
            { type: "text", text: `Raw ast-grep output:\n${finalOutput}` },
          ],
          details: { rule, language, raw: true },
        };
      }
    },
  });
}
