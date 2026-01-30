import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  BeforeAgentStartEvent,
  SessionStartEvent,
  SessionEntry,
} from "@mariozechner/pi-coding-agent";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";

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

  /**
   * Check if operation was aborted and notify user
   * @param ctx Context for notifications
   * @param signal Abort signal
   * @param message Message to display if aborted
   * @returns true if aborted, false otherwise
   */
  function checkAborted(
    ctx: ExtensionContext,
    signal?: AbortSignal,
    message = "Operation was cancelled",
  ): boolean {
    if (signal?.aborted) {
      ctx.ui.notify(message, "warning");
      return true;
    }
    return false;
  }

  /** Map of entryId -> changeId for changes */
  const changes = new Map<string, string>();
  /** Stack of {changeId, messageId} for multi-level redo */
  const redoStack: Array<{ changeId: string; messageId: string }> = [];

  type HookScope = "session" | "global";

  const globalSettingsPath = path.join(
    os.homedir(),
    ".pi",
    "agent",
    "settings.json",
  );
  const JUJU_CONFIG_ENTRY = "juju-hook-config";

  interface HookConfigEntry {
    scope: HookScope;
    hooksEnabled?: boolean;
  }

  /**
   * Flag to enable/disable hooks (sub-feature)
   */
  let hooksEnabled = true;
  let hookScope: HookScope = "global";

  function readSettingsFile(filePath: string): Record<string, unknown> {
    try {
      if (!fs.existsSync(filePath)) return {};
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as unknown as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  function getGlobalHooksEnabled(): boolean | undefined {
    const settings = readSettingsFile(globalSettingsPath);
    const jujuSettings = settings["jujutsu"];
    const hooksValue = (jujuSettings as { hooksEnabled?: unknown } | undefined)
      ?.hooksEnabled;
    if (typeof hooksValue === "boolean") return hooksValue;
    return undefined;
  }

  function setGlobalHooksEnabled(enabled: boolean): boolean {
    try {
      const settings = readSettingsFile(globalSettingsPath);
      const existing = settings["jujutsu"];
      const nextNamespace =
        existing && typeof existing === "object"
          ? {
              ...(existing as unknown as Record<string, unknown>),
              hooksEnabled: enabled,
            }
          : { hooksEnabled: enabled };

      settings["jujutsu"] = nextNamespace;
      fs.mkdirSync(path.dirname(globalSettingsPath), { recursive: true });
      fs.writeFileSync(
        globalSettingsPath,
        JSON.stringify(settings, null, 2),
        "utf-8",
      );
      return true;
    } catch {
      return false;
    }
  }

  function getLastHookEntry(
    ctx: ExtensionContext,
  ): HookConfigEntry | undefined {
    const branchEntries = ctx.sessionManager.getBranch();
    let latest: HookConfigEntry | undefined;

    for (const entry of branchEntries) {
      if (entry.type === "custom" && entry.customType === JUJU_CONFIG_ENTRY) {
        latest = entry.data as HookConfigEntry | undefined;
      }
    }

    return latest;
  }

  function restoreHookState(ctx: ExtensionContext): void {
    const entry = getLastHookEntry(ctx);
    if (entry?.scope === "session") {
      if (typeof entry.hooksEnabled === "boolean") {
        hooksEnabled = entry.hooksEnabled;
        hookScope = "session";
        return;
      }
    }

    const globalSetting = getGlobalHooksEnabled();
    hooksEnabled = globalSetting ?? true;
    hookScope = "global";
  }

  function persistHookEntry(entry: HookConfigEntry): void {
    pi.appendEntry<HookConfigEntry>(JUJU_CONFIG_ENTRY, entry);
  }

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

      if (!(await isJujutsuRepo())) return;

      // Store the current prompt for description generation
      currentPrompt = event.prompt;

      // Skip if no prompt
      if (!event.prompt) return;

      try {
        // Get the current change ID before potentially creating a new one
        const currentChangeId = await getCurrentChangeId();

        // Check if current change is empty
        const isEmpty = await isCurrentChangeEmpty();

        // Get user entries for association
        const userEntries = getUserEntries(_ctx.sessionManager);
        const lastUserEntry =
          userEntries.length > 0 ? userEntries[userEntries.length - 1] : null;

        if (isEmpty) {
          // Re-use the current empty change for this turn
          if (lastUserEntry) {
            changes.set(lastUserEntry.id, currentChangeId);
          }
        } else {
          // Create a new change to snapshot current state before processing
          await pi.exec("jj", ["new", "-m", event.prompt]);
          // Get the new change ID and associate with the current user message
          const newChangeId = await getCurrentChangeId();
          if (lastUserEntry) {
            changes.set(lastUserEntry.id, newChangeId);
          }
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
    // Check if the turn was aborted before starting description generation
    const contextSignal =
      "signal" in ctx && ctx.signal instanceof AbortSignal
        ? ctx.signal
        : undefined;

    if (checkAborted(ctx, contextSignal)) {
      return; // Skip description updates if turn was aborted
    }

    if (isEmpty) {
      if (!currentPrompt) return;

      try {
        await pi.exec("jj", ["describe", "-m", currentPrompt], {
          signal: contextSignal,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        ctx.ui.notify(
          `Failed to update change description: ${errorMessage}`,
          "warning",
        );
        console.warn(`Failed to update change description: ${errorMessage}`);
      }
      return;
    }

    const piAvailable = false;
    // const piAvailable = await isPiCommandAvailable();
    if (piAvailable) {
      try {
        ctx.ui.notify("Generating change description...", "info");

        if (
          checkAborted(
            ctx,
            contextSignal,
            "Description generation was cancelled",
          )
        )
          return;

        // Generate a proper description from diff
        await pi.exec("jj", ["diff", "--stat"], {
          signal: contextSignal,
        });

        if (
          checkAborted(
            ctx,
            contextSignal,
            "Description generation was cancelled",
          )
        )
          return;

        if (
          checkAborted(
            ctx,
            contextSignal,
            "Description generation was cancelled",
          )
        )
          return;

        const currentChangeId = await getCurrentChangeId();

        if (
          checkAborted(
            ctx,
            contextSignal,
            "Description generation was cancelled",
          )
        )
          return;

        // Use current prompt as description if Pi is not available
        const newDescription = currentPrompt || "Updated change description";

        await pi.exec(
          "jj",
          ["describe", currentChangeId, "-m", newDescription],
          { signal: contextSignal },
        );

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
            `Failed to generate change description: ${errorMessage}`,
            "warning",
          );
        }
        // Log to console for debugging but don't expose internal details to user
        console.warn(`Failed to generate change description: ${errorMessage}`);
      }
    }
  });

  /**
   * Hook that runs at the start of the session.
   * Creates a new empty change for the session.
   */
  pi.on(
    "session_start",
    async (_event: SessionStartEvent, _ctx: ExtensionContext) => {
      restoreHookState(_ctx);

      if (!hooksEnabled) return;

      // Check if currently inside .jj directory
      if (!(await isJujutsuRepo())) return;

      try {
        // Create a new empty change for the session
        await pi.exec("jj", ["new"]);
      } catch (error) {
        console.warn(
          `Failed to create change: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  /**
   * Tool call handler: Blocks operations that would affect the .jj directory or use git
   */
  // pi.on(
  //   "tool_call",
  //   async (
  //     event: {
  //       type: "tool_call";
  //       toolName: string;
  //       toolCallId: string;
  //       input: Record<string, unknown>;
  //     },
  //     _ctx: ExtensionContext,
  //   ) => {
  //     const { affectsJj, usesGit } = wouldAffectJjDir(event.input);

  //     // Block .jj directory operations
  //     if (affectsJj) {
  //       const blockedTools = [
  //         "bash",
  //         "write",
  //         "edit",
  //         "read",
  //         "grep",
  //         "find",
  //         "ls",
  //       ];
  //       if (blockedTools.includes(event.toolName)) {
  //         return {
  //           block: true,
  //           reason: `Tool ${event.toolName} blocked: Direct operations on .jj directory are not allowed`,
  //         };
  //       }
  //     }

  //     // Block git operations
  //     if (usesGit) {
  //       return {
  //         block: true,
  //         reason:
  //           "Git operations blocked: This project uses jujutsu for version control",
  //       };
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
      if (!(await isJujutsuRepo())) return;

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
      if (!(await isJujutsuRepo())) return;

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
   * Jujutsu settings command: Configure automatic hooks for change management
   */
  pi.registerCommand("jujutsu", {
    description: "Jujutsu settings (auto change management hooks)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Jujutsu settings require UI", "warning");
        return;
      }

      const currentMark = " ✓";
      const hooksOptions = [
        {
          enabled: true,
          label: hooksEnabled ? `Enabled${currentMark}` : "Enabled",
        },
        {
          enabled: false,
          label: !hooksEnabled ? `Disabled${currentMark}` : "Disabled",
        },
      ];

      const hooksChoice = await ctx.ui.select(
        "Jujutsu auto change management hooks:",
        hooksOptions.map((option) => option.label),
      );
      if (!hooksChoice) return;

      const nextEnabled = hooksOptions.find(
        (option) => option.label === hooksChoice,
      )?.enabled;
      if (nextEnabled === undefined) return;

      const scopeOptions = [
        {
          scope: "session" as HookScope,
          label: "Session only",
        },
        {
          scope: "global" as HookScope,
          label: "Global (all sessions)",
        },
      ];

      const scopeChoice = await ctx.ui.select(
        "Apply Jujutsu auto hooks setting to:",
        scopeOptions.map((option) => option.label),
      );
      if (!scopeChoice) return;

      const scope = scopeOptions.find(
        (option) => option.label === scopeChoice,
      )?.scope;
      if (!scope) return;

      if (scope === "global") {
        const ok = setGlobalHooksEnabled(nextEnabled);
        if (!ok) {
          ctx.ui.notify("Failed to update global settings", "error");
          return;
        }
      }

      hooksEnabled = nextEnabled;
      hookScope = scope;
      persistHookEntry({ scope, hooksEnabled: nextEnabled });
      ctx.ui.notify(
        `Jujutsu hooks: ${hooksEnabled ? "Enabled" : "Disabled"} (${hookScope})`,
        "info",
      );
    },
  });
}
