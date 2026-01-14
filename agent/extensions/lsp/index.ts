/**
 * LSP Extension - Language Server Protocol diagnostics and analysis
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TextContent } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import {
  getOrCreateManager,
  formatDiagnostic,
  filterDiagnosticsBySeverity,
  type SeverityFilter,
} from "./lsp-core";

const SEVERITY_FILTERS = ["all", "error", "warning", "info", "hint"] as const;

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "lsp-diagnostics",
    label: "LSP Diagnostics",
    description:
      "Get language server diagnostics for files. Supports TypeScript, JavaScript, Python, Go, Rust, Dart, Vue, Svelte, and more.",
    parameters: Type.Object({
      files: Type.Array(Type.String(), {
        description: "Array of file paths to analyze",
      }),
      severity: Type.Optional(
        Type.Union(
          SEVERITY_FILTERS.map((f) => Type.Literal(f)),
          {
            description:
              "Filter diagnostics by severity level (default: 'all')",
          },
        ),
      ),
      timeout: Type.Optional(
        Type.Number({
          description: "Timeout in milliseconds (default: 10000)",
          minimum: 1000,
          maximum: 60000,
        }),
      ),
    }),

    async execute(_toolCallId, params, onUpdate, _ctx, signal) {
      const {
        files,
        severity = "all",
        timeout = 10000,
      } = params as {
        files: string[];
        severity?: SeverityFilter;
        timeout?: number;
      };

      if (!files.length) {
        return {
          content: [
            { type: "text", text: "No files specified" } as TextContent,
          ],
          details: { files: 0 },
          isError: true,
        };
      }

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Analyzing ${files.length} file(s) with LSP...`,
          },
        ],
        details: {},
      });

      try {
        const manager = getOrCreateManager(process.cwd());
        const result = await manager.getDiagnosticsForFiles(files, timeout);

        let totalDiagnostics = 0;
        let errorCount = 0;
        let warningCount = 0;
        let infoCount = 0;
        let hintCount = 0;

        const filteredItems = result.items.map((item) => {
          let diagnostics = item.diagnostics;

          // Count all diagnostics
          totalDiagnostics += diagnostics.length;
          for (const d of diagnostics) {
            switch (d.severity) {
              case 1:
                errorCount++;
                break;
              case 2:
                warningCount++;
                break;
              case 3:
                infoCount++;
                break;
              case 4:
                hintCount++;
                break;
            }
          }

          // Filter by severity
          diagnostics = filterDiagnosticsBySeverity(diagnostics, severity);

          return {
            ...item,
            diagnostics,
          };
        });

        let summary = `LSP Analysis Results:\n`;
        summary += `Files analyzed: ${result.items.length}\n`;
        summary += `Total diagnostics: ${totalDiagnostics}\n`;
        if (severity !== "all") {
          summary += `Filtered to: ${severity}\n`;
        }
        summary += `Errors: ${errorCount}, Warnings: ${warningCount}, Info: ${infoCount}, Hints: ${hintCount}\n\n`;

        let hasIssues = false;
        for (const item of filteredItems) {
          if (item.status !== "ok") {
            hasIssues = true;
            summary += `❌ ${item.file}: ${item.status}`;
            if (item.error) summary += ` - ${item.error}`;
            summary += `\n`;
          } else if (item.diagnostics.length > 0) {
            hasIssues = true;
            summary += `⚠️  ${item.file} (${item.diagnostics.length} issues):\n`;
            for (const diag of item.diagnostics.slice(0, 5)) {
              summary += `  ${formatDiagnostic(diag)}\n`;
            }
            if (item.diagnostics.length > 5) {
              summary += `  ... and ${item.diagnostics.length - 5} more\n`;
            }
            summary += `\n`;
          } else {
            summary += `✅ ${item.file}: No issues\n`;
          }
        }

        if (!hasIssues) {
          summary += `🎉 All files passed analysis with no issues!`;
        }

        return {
          content: [{ type: "text", text: summary }],
          details: {
            files: files.length,
            totalDiagnostics,
            errorCount,
            warningCount,
            infoCount,
            hintCount,
            severity,
            results: filteredItems,
          },
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `LSP analysis failed: ${error instanceof Error ? error.message : String(error)}`,
            } as TextContent,
          ],
          isError: true,
          details: {},
        };
      }
    },
  });
}
