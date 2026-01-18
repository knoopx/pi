import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  BeforeAgentStartEvent,
  TurnStartEvent,
  SessionEntry,
} from "@mariozechner/pi-coding-agent";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { spawn } from "node:child_process";

import { promises as fs } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

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
  // Get settings from ~/.pi/agent/settings.json
  async function getSettings(): Promise<Record<string, unknown>> {
    try {
      const settingsPath = path.join(
        process.env.PI_CODING_AGENT_DIR || path.join(homedir(), ".pi", "agent"),
        "settings.json",
      );
      const content = await fs.readFile(settingsPath, "utf8");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

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

  /**
   * Spawn JJ command with proper cwd
   */
  async function spawnJj(
    args: string[],
    _cwd: string = process.cwd(),
  ): Promise<{ stdout: string; stderr: string }> {
    return pi.exec("jj", args);
  }

  /**
   * Ensure workspace exists for a session
   */
  async function ensureWorkspace(sessionId: string): Promise<string> {
    const workspacePath = path.join(
      process.env.PROJECT_ROOT || process.cwd(),
      ".jj",
      "pi-jujutsu",
      "workspaces",
      sessionId,
    );
    try {
      await fs.access(workspacePath);
      // exists
    } catch {
      // not exists, create directory and workspace
      await pi.exec("mkdir", ["-p", workspacePath]);
      await pi.exec("jj", ["workspace", "add", workspacePath]);
    }
    return workspacePath;
  }

  /** Map of entryId -> changeId for changes */
  const changes = new Map<string, string>();
  /** Stack of {changeId, messageId} for multi-level redo */
  const redoStack: Array<{ changeId: string; messageId: string }> = [];
  /** Map of sessionId -> workspacePath */
  const workspacePaths = new Map<string, string>();
  /** Flag to enable/disable hooks */
  let hooksEnabled = true;

  /**
   * Get workspace name by sessionId
   */
  async function getWorkspaceName(
    sessionId: string,
    mainRepo: string,
  ): Promise<string> {
    try {
      const { stdout } = await spawnJj(["workspace", "list"], mainRepo);
      const lines = stdout.trim().split("\n");
      for (const line of lines) {
        if (line.startsWith(sessionId + ":")) {
          return line.split(":")[1].trim().split(" ")[0]; // name is after :
        }
      }
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  /**
   * Get current change ID (short form)
   */
  async function getCurrentChangeIdShort(cwd: string): Promise<string> {
    try {
      const { stdout } = await spawnJj(
        ["log", "-r", "@", "--template", "change_id.short()", "--no-graph"],
        cwd,
      );
      return stdout.trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Check if repository has uncommitted changes
   */
  async function isDirty(cwd: string): Promise<boolean> {
    try {
      const { stdout } = await spawnJj(["diff"], cwd);
      return stdout.trim() !== "";
    } catch {
      return false;
    }
  }

  /**
   * Update the status bar with detailed JJ information
   */
  async function updateStatus(ctx: ExtensionContext) {
    if (!hooksEnabled || !(await isJujutsuRepo())) {
      if (ctx.ui?.setStatus) ctx.ui.setStatus("jujutsu", undefined);
      return;
    }

    try {
      const sessionId = ctx.sessionManager.getBranch()[0]?.id;
      const workspacePath = workspacePaths.get(sessionId);
      const cwd = workspacePath || process.cwd();
      const mainRepo = workspacePath
        ? path.dirname(path.dirname(path.dirname(path.dirname(workspacePath))))
        : process.cwd();

      const [workspace, changeId, dirty] = await Promise.all([
        getWorkspaceName(sessionId, mainRepo),
        getCurrentChangeIdShort(cwd),
        isDirty(cwd),
      ]);

      const dirtyIndicator = dirty ? "*" : "";
      const statusText = `${GREEN}JJ${RESET} ws:${workspace} ${changeId}${dirtyIndicator}`;

      if (ctx.ui?.setStatus) {
        ctx.ui.setStatus("jujutsu", statusText);
      }
    } catch (error) {
      // Fallback to simple status on error
      if (ctx.ui?.setStatus) {
        ctx.ui.setStatus("jujutsu", `${GREEN}Jujutsu${RESET}`);
      }
      console.warn(
        `Failed to update JJ status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  pi.on("session_start", async (_event, _ctx) => {
    const settings = await getSettings();
    hooksEnabled =
      (settings as { jujutsu?: { enabled?: boolean } }).jujutsu?.enabled ??
      true;

    // Ensure workspace exists and switch to it for status display
    if (hooksEnabled && (await isJujutsuRepo())) {
      const branch = _ctx.sessionManager.getBranch();
      if (branch.length > 0) {
        const sessionId = branch[0].id;
        const workspacePath = await ensureWorkspace(sessionId);
        workspacePaths.set(sessionId, workspacePath);

        // Change to the workspace directory (should exist after ensureWorkspace)
        try {
          process.chdir(workspacePath);
        } catch {
          // Directory might not exist in test environments or edge cases
        }
      }
    }

    await updateStatus(_ctx);
  });

  /** Flag to track if the last turn was aborted */
  let lastTurnAborted = false;
  /** Flag to track if the current turn completed successfully */
  let turnCompleted = false;

  /**
   * Get the current JJ change ID
   * @throws Error if JJ command fails
   */
  async function getCurrentChangeId(cwd: string): Promise<string> {
    const { stdout } = await spawnJj(
      ["log", "-r", "@", "--template", "change_id", "--no-graph"],
      cwd,
    );
    return stdout.trim();
  }

  /**
   * Check if current change is empty (no modifications)
   * @returns true if change is empty
   */
  async function isCurrentChangeEmpty(cwd: string): Promise<boolean> {
    const { stdout: diffOutput } = await spawnJj(["diff"], cwd);
    return diffOutput.trim() === "";
  }

  /**
   * Execute JJ command with error handling and user notification
   * @param args JJ command arguments
   * @param errorMessage Error message to display to user
   * @param ctx Extension command context for notifications
   * @param cwd Working directory for JJ command
   * @returns true if successful, false if failed
   */
  async function execJj(
    args: string[],
    errorMessage: string,
    ctx: ExtensionCommandContext,
    cwd: string,
  ): Promise<boolean> {
    try {
      await spawnJj(args, cwd);
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
    if (signal.aborted) {
      throw new Error("Operation aborted");
    }

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

    return new Promise<string>((resolve, reject) => {
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
          const event: AgentEvent = JSON.parse(line);
          if (event.type === "message_end" && "message" in event) {
            const msg = event.message;
            if (msg.role === "assistant") {
              for (const part of msg.content) {
                if (part.type === "text") {
                  finalOutput += part.text;
                }
              }
            }
          }

          if (
            event.type === "tool_execution_end" &&
            "result" in event &&
            !event.isError
          ) {
            const result = event.result;
            if (result && typeof result === "object" && "content" in result) {
              for (const part of result.content) {
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
   * Generate a conventional change description from a diff
   */
  async function generateDescriptionWithPi(
    diffOutput: string,
    prompt: string | undefined,
    model: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<string> {
    // Truncate diff to prevent argument length issues
    const maxDiffLength = 50000;
    const truncatedDiff =
      diffOutput.length > maxDiffLength
        ? diffOutput.substring(0, maxDiffLength) + "\n... (truncated)"
        : diffOutput;

    const task = `Generate a conventional change description for the following Jujutsu diff. Use the format: type(scope): icon short description

Follow conventional commit standards with appropriate icons. Analyze the changes and provide a meaningful description.

${prompt ? `Issue/Request: ${prompt}\n\n` : ""}Diff:
${truncatedDiff}

Respond with only the change message, no additional text.`;

    return generateWithPi(task, model, signal);
  }

  /** Store model for use in agent_end */
  let currentModel: string | undefined;
  /** Store current prompt for description generation */
  let currentPrompt: string | undefined;

  /**
   * Hook that runs before agent starts processing a user prompt.
   * Creates a JJ change for the current state and starts a new change only if needed.
   */
  pi.on(
    "before_agent_start",
    async (event: BeforeAgentStartEvent, _ctx: ExtensionContext) => {
      if (!hooksEnabled) return;
      // Check if in JJ repo
      try {
        if (!(await isJujutsuRepo())) return;
      } catch (error) {
        console.warn(
          `Failed to check Jujutsu repository: ${error instanceof Error ? error.message : String(error)}`,
        );
        return;
      }

      const branch = _ctx.sessionManager.getBranch();
      if (branch.length === 0) return;
      const sessionId = branch[0].id;
      const workspacePath = await ensureWorkspace(sessionId);
      workspacePaths.set(sessionId, workspacePath);

      // Store the current model for use in subagents
      try {
        currentModel = _ctx.model?.name;
      } catch (error) {
        // Silently fail if we can't get model info
        console.warn(
          `Failed to get model info: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Store the current prompt for description generation
      currentPrompt = event.prompt;

      // Skip if no prompt
      if (!event.prompt) return;

      try {
        // Get the current change ID before potentially creating a new one
        const currentChangeId = await getCurrentChangeId(workspacePath);

        // Check if current change is empty
        const isEmpty = await isCurrentChangeEmpty(workspacePath);

        // Store the current change ID as the change
        changes.set("__pending__", currentChangeId);

        if (lastTurnAborted || isEmpty) {
          // Re-use the current change and update its description
          await spawnJj(["describe", "-m", event.prompt], workspacePath);
        } else {
          // Create a new change to snapshot current state before processing
          await spawnJj(["new", "-m", event.prompt], workspacePath);
        }
      } catch (error) {
        // Log error but don't fail the extension - JJ operations are not critical
        console.warn(
          `Failed to create JJ change: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Update status after change operations
      await updateStatus(_ctx);
    },
  );

  pi.on("agent_end", async (_event, ctx) => {
    if (!hooksEnabled) return;
    if (!(await isJujutsuRepo())) return;

    const branch = ctx.sessionManager.getBranch();
    if (branch.length === 0) return;
    const sessionId = branch[0].id;
    const workspacePath = workspacePaths.get(sessionId);
    if (!workspacePath) return;

    const isEmpty = await isCurrentChangeEmpty(workspacePath);
    const piAvailable = await isPiCommandAvailable();
    if (!isEmpty && piAvailable && turnCompleted) {
      try {
        ctx.ui.notify("Generating change description...", "info");

        // Generate a proper description from diff
        const { stdout: diffOutput } = await spawnJj(
          ["diff", "--stat"],
          workspacePath,
        );

        const newDescription = await generateDescriptionWithPi(
          diffOutput,
          currentPrompt,
          currentModel,
          undefined, // No signal available in event handlers
        );

        const currentChangeId = await getCurrentChangeId(workspacePath);

        await spawnJj(
          ["describe", currentChangeId, "-m", newDescription],
          workspacePath,
        );

        ctx.ui.notify(
          `Updated change description to: ${newDescription}`,
          "info",
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        ctx.ui.notify(
          `Failed to generate change description: ${errorMessage}`,
          "warning",
        );
        // Log to console for debugging but don't expose internal details to user
        console.warn(`Failed to generate change description: ${errorMessage}`);
      }

      // Update status after description update
      await updateStatus(ctx);
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

      // Track if the last turn was aborted
      lastTurnAborted = !turnCompleted;
      turnCompleted = false;

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
   * Hook that runs at the end of each turn.
   */
  pi.on("turn_end", async (_event, _ctx) => {
    turnCompleted = true;
  });

  /**
   * Hook that runs when a session ends.
   * Forgets the workspace associated with the session.
   */
  // pi.on(
  //   "session_end",
  //   async (_event, ctx: ExtensionContext) => {
  //     if (!hooksEnabled) return;
  //     if (!(await isJujutsuRepo())) return;

  //     const branch = ctx.sessionManager.getBranch();
  //     if (branch.length === 0) return;
  //     const sessionId = branch[0].id;
  //     const workspacePath = workspacePaths.get(sessionId);
  //     if (workspacePath) {
  //       try {
  //         await spawnJj(["workspace", "forget", workspacePath]);
  //         // Clean up the directory
  //         await pi.exec("rm", ["-rf", workspacePath]);
  //         workspacePaths.delete(sessionId);
  //         ctx.ui.notify(`Forgot workspace for session ${sessionId}`, "info");
  //       } catch (error) {
  //         console.warn(
  //           `Failed to forget workspace: ${error instanceof Error ? error.message : String(error)}`,
  //         );
  //       }
  //     }
  //   },
  // );

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

      const sessionId = ctx.sessionManager.getBranch()[0]?.id;
      const workspacePath = workspacePaths.get(sessionId);
      if (!workspacePath) {
        ctx.ui.notify("No workspace found for current session", "warning");
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
      const currentChangeId = await getCurrentChangeId(workspacePath);

      // Push current state to redo stack
      redoStack.push({
        changeId: currentChangeId,
        messageId: targetEntryId,
      });

      // Switch to the target change (conceptually abandoning the current)
      const success = await execJj(
        ["edit", changeId],
        "Failed to undo",
        ctx,
        workspacePath,
      );
      if (!success) {
        // Remove from redo stack if jj edit failed
        redoStack.pop();
        return;
      }

      // Reset the aborted state since we're going back to a clean state
      lastTurnAborted = false;

      // Navigate back in the session tree to the user message
      await navigateWithCancellation(
        ctx,
        targetEntryId,
        `Abandoned current change and restored edit mode to ${changeId}`,
      );

      // Update status after undo
      await updateStatus(ctx);
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

      const sessionId = ctx.sessionManager.getBranch()[0]?.id;
      const workspacePath = workspacePaths.get(sessionId);
      if (!workspacePath) {
        ctx.ui.notify("No workspace found for current session", "warning");
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
        workspacePath,
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

      // Update status after redo
      await updateStatus(ctx);
    },
  });

  /**
   * Jujutsu command: Show current configuration status
   */
  pi.registerCommand("jujutsu", {
    description: "Show Jujutsu extension configuration status",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const settings = await getSettings();
      const enabled =
        (settings as { jujutsu?: { enabled?: boolean } }).jujutsu?.enabled ??
        true;
      const inRepo = await isJujutsuRepo();

      let message = `Jujutsu Extension Status:\n`;
      message += `Enabled: ${enabled ? "Yes" : "No"}\n`;
      message += `In JJ repository: ${inRepo ? "Yes" : "No"}\n`;
      message += `Active: ${enabled && inRepo ? "Yes" : "No"}\n\n`;

      if (enabled && inRepo) {
        message += `Status bar shows current workspace, change ID, and dirty indicator (e.g., "JJ ws:main abc123*")\n`;
      }

      message += `To change settings, edit ~/.pi/agent/settings.json:\n`;
      message += `{\n`;
      message += `  "jujutsu": {\n`;
      message += `    "enabled": ${enabled ? "false" : "true"}\n`;
      message += `  }\n`;
      message += `}\n\n`;
      message += `Or use /jujutsu-enable or /jujutsu-disable commands.`;

      ctx.ui.notify(message, "info");
    },
  });

  /**
   * Enable Jujutsu hooks command
   */
  pi.registerCommand("jujutsu-enable", {
    description: "Enable Jujutsu extension hooks",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      hooksEnabled = true;
      await updateStatus(ctx);
      ctx.ui.notify(
        'Jujutsu hooks enabled for this session. To make it permanent, set "jujutsu": { "enabled": true } in ~/.pi/agent/settings.json',
        "info",
      );
    },
  });

  /**
   * Disable Jujutsu hooks command
   */
  pi.registerCommand("jujutsu-disable", {
    description: "Disable Jujutsu extension hooks",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      hooksEnabled = false;
      await updateStatus(ctx);
      ctx.ui.notify(
        'Jujutsu hooks disabled for this session. To make it permanent, set "jujutsu": { "enabled": false } in ~/.pi/agent/settings.json',
        "info",
      );
    },
  });
}
