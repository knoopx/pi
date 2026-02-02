/**
 * Biome Extension
 *
 * Automatically formats files with Biome after write or edit tool operations.
 *
 * Features:
 * - Listens to tool_result events for write and edit operations
 * - Runs biome format on modified files
 * - Handles errors gracefully without blocking workflow
 *
 * Prerequisites:
 * - Biome must be installed and available in PATH
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  isEditToolResult,
  isWriteToolResult,
} from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    // Check if the tool was write or edit
    if (!isWriteToolResult(event) && !isEditToolResult(event)) {
      return;
    }

    // Skip if there was an error
    if (event.isError) {
      return;
    }

    // Get the file path from the tool input
    const filePath = event.input.path as string;
    if (!filePath) {
      return;
    }

    try {
      // Run biome format on the file
      const result = await pi.exec("biome", ["format", "--write", filePath], {
        timeout: 5000,
      });

      // Check if biome made any changes
      if (result.code === 0 && result.stderr?.includes("formatted")) {
        if (ctx.hasUI) {
          ctx.ui.notify(`Biome formatted: ${filePath}`, "info");
        }
      }
    } catch (error: unknown) {
      // Handle errors gracefully - biome might not be installed or file might not be supported
      // Silently ignore to avoid disrupting the workflow
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorCode = error as { code?: string };

      if (
        errorMessage?.includes("command not found") ||
        errorCode?.code === "ENOENT"
      ) {
        // Biome not installed, silently skip
        return;
      }

      // Log other errors only in verbose mode or if there's a UI
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Biome formatting failed for ${filePath}: ${errorMessage || "Unknown error"}`,
          "warning",
        );
      }
    }
  });

  // Register a command to manually format files
  pi.registerCommand("biome-format", {
    description:
      "Format a file or directory with Biome (usage: /biome-format [path])",
    handler: async (args, ctx) => {
      const target = args.trim() || ctx.cwd;

      try {
        const result = await pi.exec("biome", ["format", "--write", target]);

        if (result.code === 0) {
          ctx.ui.notify(`Biome formatted: ${target}`, "info");
        } else {
          ctx.ui.notify(
            `Biome formatting failed: ${result.stderr || result.stdout || "Unknown error"}`,
            "error",
          );
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorCode = error as { code?: string };

        if (
          errorMessage?.includes("command not found") ||
          errorCode?.code === "ENOENT"
        ) {
          ctx.ui.notify("Biome is not installed", "error");
        } else {
          ctx.ui.notify(
            `Biome formatting failed: ${errorMessage || "Unknown error"}`,
            "error",
          );
        }
      }
    },
  });
}
