import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  BeforeAgentStartEvent,
  TurnStartEvent,
  SessionEntry,
} from "@mariozechner/pi-coding-agent";
import { spawn } from "node:child_process";

/**
 * Jujutsu extension for Pi coding agent.
 * Provides change-based undo/redo functionality integrated with JJ version control.
 *
 * Features:
 * - Automatic changes before processing user messages
 * - Undo command to revert conversation and repository state
 * - Redo command to restore after undo
 */
export default function (pi: ExtensionAPI) {
  // Check if current directory is a Jujutsu repository
  async function isJujutsuRepo(): Promise<boolean> {
    try {
      await pi.exec("jj", ["status"]);
      return true;
    } catch {
      return false;
    }
  }

  // Check if pi command is available
  async function isPiCommandAvailable(): Promise<boolean> {
    try {
      await pi.exec("pi", ["--version"]);
      return true;
    } catch {
      return false;
    }
  }

  /** Map of entryId -> changeId for changes */
  const changes = new Map<string, string>();
  /** Stack of {changeId, messageId} for multi-level redo */
  const redoStack: Array<{ changeId: string; messageId: string }> = [];
  /** Flag to enable/disable hooks */
  let hooksEnabled = true;

  /**
   * Get the current JJ change ID
   * @throws Error if JJ command fails
   */
  async function getCurrentChangeId(): Promise<string> {
    const { stdout } = await pi.exec("jj", [
      "log",
      "-r",
      "@",
      "--template",
      "change_id",
      "--no-graph",
    ]);
    return stdout.trim();
  }

  /**
   * Check if current change is empty (no modifications)
   * @returns true if change is empty
   */
  async function isCurrentChangeEmpty(): Promise<boolean> {
    const { stdout: diffOutput } = await pi.exec("jj", ["diff"]);
    return diffOutput.trim() === "";
  }

  /**
   * Execute JJ command with error handling and user notification
   * @param args JJ command arguments
   * @param errorMessage Error message to display to user
   * @param ctx Extension command context for notifications
   * @returns true if successful, false if failed
   */
  async function execJj(
    args: string[],
    errorMessage: string,
    ctx: ExtensionCommandContext,
  ): Promise<boolean> {
    try {
      await pi.exec("jj", args);
      return true;
    } catch (error) {
      ctx.ui.notify(
        `${errorMessage}: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
      return false;
    }
  }

  /**
   * Get filtered user message entries from session manager
   * @param sessionManager Session manager instance
   * @returns Array of user message entries
   */
  function getUserEntries(sessionManager: {
    getBranch(): SessionEntry[];
  }): SessionEntry[] {
    const entries = sessionManager.getBranch();
    return entries.filter(
      (e: SessionEntry) =>
        e.type === "message" && "message" in e && e.message.role === "user",
    );
  }

  /**
   * Navigate to an entry and handle cancellation
   * @param ctx Extension command context
   * @param entryId Entry ID to navigate to
   * @param successMessage Message to display on success
   * @returns true if navigation succeeded, false if cancelled
   */
  async function navigateWithCancellation(
    ctx: ExtensionCommandContext,
    entryId: string,
    successMessage: string,
  ): Promise<boolean> {
    const result = await ctx.navigateTree(entryId, {
      summarize: true,
    });

    if (result.cancelled) {
      ctx.ui.notify("Navigation was cancelled", "warning");
      return false;
    } else {
      ctx.ui.notify(successMessage, "info");
      return true;
    }
  }

  /**
   * Generate content using a pi subagent with proper error handling and timeouts
   */
  async function generateWithPi(
    task: string,
    model: string | undefined,
    signal: AbortSignal | undefined,
    timeoutMs: number = 30000,
  ): Promise<string> {
    const piAvailable = await isPiCommandAvailable();
    if (!piAvailable) {
      throw new Error("pi command not available");
    }

    if (!model) {
      throw new Error("Model name not available");
    }

    if (signal?.aborted) {
      throw new Error("Operation aborted");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    try {
      return await generateWithPiInternal(task, model, combinedSignal);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Internal implementation of pi subagent generation
   */
  async function generateWithPiInternal(
    task: string,
    model: string,
    signal: AbortSignal,
  ): Promise<string> {
    interface PiEventMessage {
      role: "assistant" | "toolResult";
      content: Array<{ type: "text"; text: string }>;
    }

    interface PiEvent {
      type: "message_end" | "tool_result_end";
      message?: PiEventMessage;
    }

    return new Promise((resolve, reject) => {
      const args = [
        "--mode",
        "json",
        "-p",
        "--no-session",
        "--no-tools",
        "--no-skills",
        "--no-extensions",
        "--model",
        model,
        `Task: ${task}`,
      ];

      const proc = spawn("pi", args, {
        cwd: process.cwd(),
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      let buffer = "";
      let finalOutput = "";
      let stderrOutput = "";

      const cleanup = () => {
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) proc.kill("SIGKILL");
        }, 5000);
      };

      const processLine = (line: string) => {
        if (!line.trim()) return;
        try {
          const event: PiEvent = JSON.parse(line);
          if (event.type === "message_end" && event.message) {
            const msg = event.message;
            if (msg.role === "assistant") {
              for (const part of msg.content) {
                if (part.type === "text") {
                  finalOutput += part.text;
                }
              }
            }
          }

          if (event.type === "tool_result_end" && event.message) {
            const msg = event.message;
            if (msg.role === "toolResult") {
              for (const part of msg.content) {
                if (part.type === "text") {
                  finalOutput += part.text;
                }
              }
            }
          }
        } catch {
          // Invalid JSON, skip this line
          console.warn(`Invalid JSON from pi subagent: ${line}`);
        }
      };

      proc.stdout.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      });

      proc.stderr.on("data", (data) => {
        stderrOutput += data.toString();
      });

      proc.on("close", (code) => {
        if (buffer.trim()) processLine(buffer);

        if (code === 0) {
          const trimmed = finalOutput.trim();
          if (trimmed) {
            resolve(trimmed);
          } else {
            reject(
              new Error(
                `No output from pi subagent${stderrOutput ? `: ${stderrOutput}` : ""}`,
              ),
            );
          }
        } else {
          reject(
            new Error(
              `pi subagent exited with code ${code}${stderrOutput ? `: ${stderrOutput}` : ""}`,
            ),
          );
        }
      });

      proc.on("error", (error) => {
        reject(new Error(`Failed to spawn pi subagent: ${error.message}`));
      });

      // Handle abort signal
      if (signal.aborted) {
        cleanup();
        reject(new Error("Operation aborted"));
      } else {
        signal.addEventListener(
          "abort",
          () => {
            cleanup();
            reject(new Error("Operation aborted"));
          },
          { once: true },
        );
      }
    });
  }

  /**
   * Generate a conventional commit description from a diff
   */
  async function generateDescriptionWithPi(
    diffOutput: string,
    model: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    const task = `Generate a conventional change description for the following Jujutsu diff. Use the format: type(scope): icon short description

Follow conventional commit standards with appropriate icons. Analyze the changes and provide a meaningful description.

Diff:
${diffOutput}

Respond with only the change message, no additional text.`;

    return generateWithPi(task, model, signal);
  }

  /** Store model for use in agent_end */
  let currentModel: string | undefined;

  /**
   * Hook that runs before agent starts processing a user prompt.
   * Creates a JJ change for the current state and starts a new change only if needed.
   */
  pi.on(
    "before_agent_start",
    async (event: BeforeAgentStartEvent, _ctx: ExtensionContext) => {
      if (!hooksEnabled) return;
      // Check if in JJ repo
      if (!(await isJujutsuRepo())) return;

      // Store the current model for use in subagents
      try {
        currentModel = _ctx.model?.name;
      } catch (error) {
        // Silently fail if we can't get model info
        console.warn(
          `Failed to get model info: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Skip if no prompt
      if (!event.prompt) return;

      try {
        // Get the current change ID before potentially creating a new one
        const currentChangeId = await getCurrentChangeId();

        // Check if current change is empty
        const isEmpty = await isCurrentChangeEmpty();

        // Store the current change ID as the change
        changes.set("__pending__", currentChangeId);

        if (isEmpty) {
          // Re-use the current empty change and update its description
          await pi.exec("jj", ["describe", "-m", event.prompt]);
        } else {
          // Create a new change to snapshot current state before processing
          await pi.exec("jj", ["new", "-m", event.prompt]);
        }
      } catch (error) {
        // Log error but don't fail the extension - JJ operations are not critical
        console.warn(
          `Failed to create JJ change: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  pi.on("agent_end", async (_event, ctx) => {
    if (!hooksEnabled) return;
    if (!(await isJujutsuRepo())) return;

    const isEmpty = await isCurrentChangeEmpty();
    const piAvailable = await isPiCommandAvailable();
    if (!isEmpty && piAvailable) {
      // Check if the turn was aborted before starting description generation
      const contextSignal =
        "signal" in ctx && ctx.signal instanceof AbortSignal
          ? ctx.signal
          : undefined;

      if (contextSignal?.aborted) {
        return; // Skip description generation if turn was aborted
      }

      try {
        ctx.ui.notify("Generating commit description...", "info");

        // Generate a proper description from diff
        const { stdout: diffOutput } = await pi.exec("jj", ["diff"]);
        const newDescription = await generateDescriptionWithPi(
          diffOutput,
          currentModel,
          contextSignal,
        );

        const currentChangeId = await getCurrentChangeId();
        await pi.exec("jj", [
          "describe",
          currentChangeId,
          "-m",
          newDescription,
        ]);

        ctx.ui.notify(
          `Updated change description to: ${newDescription}`,
          "info",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (
          contextSignal?.aborted ||
          errorMessage.includes("Aborted") ||
          errorMessage.includes("abort")
        ) {
          ctx.ui.notify("Description generation was cancelled", "warning");
        } else {
          ctx.ui.notify(
            `Failed to generate commit description: ${errorMessage}`,
            "warning",
          );
        }
        // Log to console for debugging but don't expose internal details to user
        console.warn(`Failed to generate commit description: ${errorMessage}`);
      }
    }
  });

  /**
   * Hook that runs at the start of each turn.
   * Associates pending changes with user message entries.
   */
  pi.on(
    "turn_start",
    async (_event: TurnStartEvent, _ctx: ExtensionContext) => {
      if (!hooksEnabled) return;
      if (!(await isJujutsuRepo())) return;

      const userEntries = getUserEntries(_ctx.sessionManager);
      if (userEntries.length >= 1) {
        // Associate pending change with the last user message
        const lastUserEntry = userEntries[userEntries.length - 1];
        const pendingChange = changes.get("__pending__");
        if (pendingChange) {
          changes.set(lastUserEntry.id, pendingChange);
          changes.delete("__pending__");
        }
      }
    },
  );

  /**
   * Undo command: Abandon the current change and restore repository state to before that change was processed.
   * This removes the current change conceptually and switches to the previous user message's change.
   */
  pi.registerCommand("undo", {
    description:
      "Abandon the current change and restore the repository state to before that change was processed",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!(await isJujutsuRepo())) {
        ctx.ui.notify("Not in a Jujutsu repository", "warning");
        return;
      }

      const userEntries = getUserEntries(ctx.sessionManager);

      // Find the last user message that has a change
      let targetEntryId: string | undefined;
      let changeId: string | undefined;

      for (let i = userEntries.length - 1; i >= 0; i--) {
        const entry = userEntries[i];
        const change = changes.get(entry.id);
        if (change) {
          targetEntryId = entry.id;
          changeId = change;
          break;
        }
      }

      if (!targetEntryId || !changeId) {
        ctx.ui.notify("No changes available to revert to", "warning");
        return;
      }

      // Get current change ID before switching for redo
      const currentChangeId = await getCurrentChangeId();

      // Push current state to redo stack
      redoStack.push({
        changeId: currentChangeId,
        messageId: targetEntryId,
      });

      // Switch to the target change (conceptually abandoning the current)
      const success = await execJj(["edit", changeId], "Failed to undo", ctx);
      if (!success) {
        // Remove from redo stack if jj edit failed
        redoStack.pop();
        return;
      }

      // Navigate back in the session tree to the user message
      await navigateWithCancellation(
        ctx,
        targetEntryId,
        `Abandoned current change and restored edit mode to ${changeId}`,
      );
    },
  });

  /**
   * Redo command: Restore to the change before the last undo.
   * Supports multiple redos by maintaining a stack.
   */
  pi.registerCommand("redo", {
    description:
      "Redo the last undo operation by switching back to the previous change",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!(await isJujutsuRepo())) {
        ctx.ui.notify("Not in a Jujutsu repository", "warning");
        return;
      }

      if (redoStack.length === 0) {
        ctx.ui.notify("No undo operation to redo", "warning");
        return;
      }

      // Pop the last redo checkpoint
      const redoEntry = redoStack.pop()!;
      const { changeId: redoChangeId } = redoEntry;

      // Switch back to the redo checkpoint
      const success = await execJj(
        ["edit", redoChangeId],
        "Failed to redo",
        ctx,
      );
      if (!success) {
        // Push back to stack if jj edit failed
        redoStack.push(redoEntry);
        return;
      }

      // Navigate to the end of the conversation (where we were before undo)
      const allEntries = ctx.sessionManager.getBranch();
      const lastEntry = allEntries[allEntries.length - 1];
      await navigateWithCancellation(
        ctx,
        lastEntry.id,
        `Redid to checkpoint ${redoChangeId} and restored edit mode`,
      );
    },
  });

  /**
   * Enable hooks command: Enable automatic JJ hooks for change management
   */
  pi.registerCommand("jujutsu-enable-hooks", {
    description: "Enable automatic Jujutsu hooks for change management",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      hooksEnabled = true;
      ctx.ui.notify("Jujutsu hooks enabled", "info");
    },
  });

  /**
   * Disable hooks command: Disable automatic JJ hooks for change management
   */
  pi.registerCommand("jujutsu-disable-hooks", {
    description: "Disable automatic Jujutsu hooks for change management",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      hooksEnabled = false;
      ctx.ui.notify("Jujutsu hooks disabled", "info");
    },
  });
}
