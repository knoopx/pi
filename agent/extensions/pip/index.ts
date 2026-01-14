/**
 * Pip Tools Extension
 *
 * Provides tools to query Python packages using pip.
 * Tools available: pip-search, pip-show, pip-list
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import {
  truncateHead,
  formatSize,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
}

export default function (pi: ExtensionAPI) {
  // Tool to search for packages
  pi.registerTool({
    name: "pip-search",
    label: "Pip Search",
    description:
      "Search for Python packages on PyPI. Returns a list of matching packages with descriptions.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (package name or keyword)",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results to return (default: 10)",
          minimum: 1,
          maximum: 50,
        }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { query, limit = 10 } = params as { query: string; limit?: number };

      try {
        const result = await pi.exec(
          "pip",
          ["search", query, "--format", "json"],
          { signal: _signal },
        );

        if (result.code !== 0) {
          return textResult(`Error searching for packages: ${result.stderr}`, {
            query,
          });
        }

        let packages: any[] = [];
        try {
          packages = JSON.parse(result.stdout);
        } catch {
          return textResult(`Error parsing search results: ${result.stdout}`, {
            query,
          });
        }

        const limitedPackages = packages.slice(0, limit);

        let output = `Found ${limitedPackages.length} package(s) matching "${query}":\n\n`;
        for (const pkg of limitedPackages) {
          output += `**${pkg.name}** (${pkg.version})\n`;
          output += `${pkg.description || "No description available"}\n\n`;
        }

        if (packages.length > limit) {
          output += `... and ${packages.length - limit} more results (limited to ${limit})`;
        }

        return textResult(output, {
          query,
          total: packages.length,
          returned: limitedPackages.length,
        });
      } catch (error) {
        return textResult(`Failed to search packages: ${String(error)}`, {
          query,
        });
      }
    },
  });

  // Tool to show package information
  pi.registerTool({
    name: "pip-show",
    label: "Pip Show",
    description: "Show detailed information about an installed Python package.",
    parameters: Type.Object({
      package: Type.String({
        description: "Name of the package to show information for",
      }),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { package: packageName } = params as { package: string };

      try {
        const result = await pi.exec("pip", ["show", packageName], {
          signal: _signal,
        });

        if (result.code !== 0) {
          return textResult(
            `Package "${packageName}" not found or error: ${result.stderr}`,
            { package: packageName },
          );
        }

        const lines = result.stdout.split("\n");
        const info: Record<string, string> = {};

        for (const line of lines) {
          const colonIndex = line.indexOf(":");
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            info[key] = value;
          }
        }

        let output = `Package: ${packageName}\n\n`;
        output += `**Version:** ${info.Version || "Unknown"}\n`;
        output += `**Summary:** ${info.Summary || "No summary"}\n`;
        output += `**Home-page:** ${info["Home-page"] || "Not specified"}\n`;
        output += `**Author:** ${info.Author || "Unknown"}\n`;
        output += `**License:** ${info.License || "Unknown"}\n`;
        output += `**Location:** ${info.Location || "Unknown"}\n`;
        if (info.Requires) {
          output += `**Requires:** ${info.Requires}\n`;
        }
        if (info["Required-by"]) {
          output += `**Required by:** ${info["Required-by"]}\n`;
        }

        return textResult(output, { package: packageName, info });
      } catch (error) {
        return textResult(`Failed to show package info: ${String(error)}`, {
          package: packageName,
        });
      }
    },
  });

  // Tool to list installed packages
  pi.registerTool({
    name: "pip-list",
    label: "Pip List",
    description: "List all installed Python packages with their versions.",
    parameters: Type.Object({
      format: Type.Optional(
        StringEnum(["table", "json", "freeze"] as const, {
          description: "Output format (default: table)",
        }),
      ),
      outdated: Type.Optional(
        Type.Boolean({ description: "Only show outdated packages" }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
      const { format = "table", outdated = false } = params as {
        format?: "table" | "json" | "freeze";
        outdated?: boolean;
      };

      try {
        const args = ["list"];
        if (outdated) {
          args.push("--outdated");
        }
        if (format === "json") {
          args.push("--format", "json");
        } else if (format === "freeze") {
          args.push("--format", "freeze");
        }

        const result = await pi.exec("pip", args, { signal: _signal });

        if (result.code !== 0) {
          return textResult(`Error listing packages: ${result.stderr}`, {
            format,
            outdated,
          });
        }

        if (format === "json") {
          let packages: any[];
          try {
            packages = JSON.parse(result.stdout);
          } catch {
            return textResult(`Error parsing JSON output: ${result.stdout}`, {
              format,
              outdated,
            });
          }

          const lines = packages.map((pkg) => {
            let line = `**${pkg.name}** ${pkg.version}`;
            if (pkg.latest_version && pkg.version !== pkg.latest_version) {
              line += ` (latest: ${pkg.latest_version})`;
            }
            return line;
          });

          const title = outdated ? "Outdated packages" : "Installed packages";
          return textResult(
            `${title} (${packages.length}):\n\n${lines.join("\n")}`,
            {
              format,
              outdated,
              count: packages.length,
            },
          );
        }

        if (format === "freeze") {
          const lines = result.stdout.split("\n").filter((line) => line.trim());
          const title = outdated ? "Outdated packages" : "Installed packages";
          return textResult(`${title} (${lines.length}):\n\n${result.stdout}`, {
            format,
            outdated,
            count: lines.length,
          });
        }

        // table format - apply truncation
        const truncation = truncateHead(result.stdout, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        let output = truncation.content;
        if (truncation.truncated) {
          output += `\n\n[Output truncated: ${truncation.totalLines} lines (${formatSize(
            truncation.totalBytes,
          )}). Full output available in terminal.]`;
        }

        const title = outdated ? "Outdated packages" : "Installed packages";
        return textResult(`${title}:\n\n${output}`, {
          format,
          outdated,
          truncated: truncation.truncated,
        });
      } catch (error) {
        return textResult(`Failed to list packages: ${String(error)}`, {
          format,
          outdated,
        });
      }
    },
  });
}
