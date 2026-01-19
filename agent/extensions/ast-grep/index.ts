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
    } catch {
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

Supports pattern variables and multiple languages.

Examples:
- Find console.log calls: pattern='console.log($$$ARGS)', language='javascript'
- Find React useEffect hooks: pattern='useEffect(() => { $$$BODY }, [$DEPS])', language='tsx'
- Find async functions: pattern='async function $NAME($$$ARGS) { $$$BODY }', language='typescript'`,
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
          default: ".",
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
        language,
        path = ".",
      } = params as {
        pattern: string;
        language: string;
        path?: string;
      };

      const args = ["run", "--pattern", pattern, "--lang", language, path];

      const result = await pi.exec("ast-grep", args, { signal });

      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `ast-grep error: ${result.stderr}` }],
          details: {},
        };
      }

      // Parse text output
      const lines = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      const matches = lines
        .map((line) => {
          const colonIndex = line.indexOf(":");
          if (colonIndex === -1) return null;
          const rest = line.slice(colonIndex + 1);
          const colonIndex2 = rest.indexOf(":");
          if (colonIndex2 === -1) return null;
          const file = line.slice(0, colonIndex);
          const lineStr = rest.slice(0, colonIndex2);
          const content = rest.slice(colonIndex2 + 1);
          const lineNum = parseInt(lineStr) - 1;
          return {
            file,
            range: { start: { line: lineNum } },
            lines: content,
          };
        })
        .filter((m) => m !== null);

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

Always use dry-run first to preview changes.

Examples:
- Replace == with ===: pattern='$A == $B', rewrite='$A === $B', language='javascript'
- Convert function to arrow: pattern='function $NAME($$$ARGS) { $$$BODY }', rewrite='const $NAME = ($$$ARGS) => { $$$BODY }', language='javascript'
- Simplify boolean return: pattern='if ($COND) { return true } else { return false }', rewrite='return !!$COND', language='javascript'`,
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
          default: ".",
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
      if (!dryRun) {
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
        // Show diff preview
        const summary = `Preview of changes for pattern '${pattern}' -> '${rewrite}':\n\n${result.stdout.trim()}\n\nUse dryRun: false to apply these changes.`;

        return {
          content: [{ type: "text", text: summary }],
          details: {
            pattern,
            rewrite,
            language,
            preview: true,
          },
        };
      } else {
        // Applied changes
        return {
          content: [
            {
              type: "text",
              text: `Applied changes for pattern '${pattern}' -> '${rewrite}': ${result.stdout.trim()}`,
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

Supports 'all', 'any', 'not', 'inside', 'has' operators.

Examples:
- Find async functions: rule='{"kind": "function_declaration", "has": {"pattern": "await $EXPR"}}', language='javascript'
- Find functions with multiple returns: rule='{"kind": "function_declaration", "has": {"kind": "return_statement", "nth-child": {"at-least": 2}}}', language='javascript'
- Find nested if statements: rule='{"kind": "if_statement", "inside": {"kind": "if_statement"}}', language='javascript'`,
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
          default: ".",
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
        path,
      ];

      const result = await pi.exec("ast-grep", args, { signal });

      if (result.code !== 0) {
        return {
          content: [{ type: "text", text: `ast-grep error: ${result.stderr}` }],
          details: {},
        };
      }

      // Show scan results
      const summary = `Scan results for rule in ${language}:\n\n${result.stdout.trim()}`;

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
        },
      };
    },
  });
}
