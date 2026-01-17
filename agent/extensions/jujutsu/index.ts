import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  BeforeAgentStartEvent,
  TurnStartEvent,
} from "@mariozechner/pi-coding-agent";

/**
 * Jujutsu extension for Pi coding agent.
 * Provides snapshot-based undo/redo functionality integrated with JJ version control.
 *
 * Features:
 * - Automatic snapshots before processing user messages
 * - Undo command to revert conversation and repository state
 * - Redo command to restore after undo
 * - Snapshots command to list available checkpoints
 */
export default function (pi: ExtensionAPI) {
  /** Map of entryId -> changeId for snapshots */
  const snapshots = new Map<string, string>();
  /** ID of the last user message entry for undo */
  let lastUserMessageEntryId: string | undefined;
  /** Stack of {changeId, messageId} for multi-level redo */
  const redoStack: Array<{ changeId: string; messageId: string }> = [];

  /**
   * Get the current JJ change ID
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
   * Execute JJ command with error handling
   */
  async function execJj(
    args: string[],
    errorMessage: string,
    ctx: {
      ui: {
        notify: (msg: string, type?: "info" | "warning" | "error") => void;
      };
    },
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
   * Hook that runs before agent starts processing a user prompt.
   * Creates a JJ snapshot of the current state and starts a new change.
   */
  pi.on(
    "before_agent_start",
    async (event: BeforeAgentStartEvent, _ctx: ExtensionContext) => {
      try {
        // Get the current change ID before creating a new one
        const currentChangeId = await getCurrentChangeId();

        // Check if current change is empty and has no description
        const { stdout: statusOutput } = await pi.exec("jj", [
          "diff",
          "--stat",
        ]);
        const { stdout: descriptionOutput } = await pi.exec("jj", [
          "show",
          "--template",
          "description",
          "--no-pager",
        ]);

        const isEmpty = statusOutput.trim() === "";
        const hasNoDescription = descriptionOutput.trim() === "";

        // If current change is empty and has no description, re-use it instead of creating new
        if (isEmpty && hasNoDescription) {
          // Store the current change ID as the snapshot directly
          snapshots.set("__pending__", currentChangeId);
          return;
        }

        // Create a new change to snapshot current state before processing
        const message = event.prompt || "User prompt";
        await pi.exec("jj", ["new", "-m", message]);

        // Store the previous change ID as the snapshot - we'll associate it with the next user message entry
        if (currentChangeId) {
          // We'll store it temporarily and associate it when the user message is saved
          snapshots.set("__pending__", currentChangeId);
        }
      } catch (error) {
        // Silently fail for auto-snapshot - JJ might not be available or repo not initialized
        console.warn(
          `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  /**
   * Hook that runs at the start of each turn.
   * Associates pending snapshots with user message entries.
   */
  pi.on("turn_start", async (_event: TurnStartEvent, ctx: ExtensionContext) => {
    const entries = ctx.sessionManager.getBranch();
    const userEntries = entries.filter(
      (e) => e.type === "message" && e.message.role === "user",
    );
    if (userEntries.length >= 1) {
      // Always update lastUserMessageEntryId to the latest user message
      lastUserMessageEntryId = userEntries[userEntries.length - 1].id;

      // Associate pending snapshot with the last user message
      const lastUserEntry = userEntries[userEntries.length - 1];
      const pendingSnapshot = snapshots.get("__pending__");
      if (pendingSnapshot) {
        snapshots.set(lastUserEntry.id, pendingSnapshot);
        snapshots.delete("__pending__");
      }
    }
  });

  /**
   * Undo command: Revert to the previous user message and restore repository state.
   * This removes all conversation after that message and restores JJ to before the next message was processed.
   */
  pi.registerCommand("undo", {
    description:
      "Revert to the previous user message and restore the repository state to before that message was processed",
    handler: async (args: string[], ctx: ExtensionCommandContext) => {
      // Find the most recent user message that has a snapshot
      const entries = ctx.sessionManager.getBranch();
      const userEntries = entries.filter(
        (e) => e.type === "message" && e.message.role === "user",
      );

      let targetEntryId: string | undefined;
      let changeId: string | undefined;

      // Find the last user message that has a snapshot
      for (let i = userEntries.length - 1; i >= 0; i--) {
        const entry = userEntries[i];
        const snapshot = snapshots.get(entry.id);
        if (snapshot) {
          targetEntryId = entry.id;
          changeId = snapshot;
          break;
        }
      }

      if (!targetEntryId || !changeId) {
        ctx.ui.notify("No snapshots available to revert to", "warning");
        return;
      }

      // Get current change ID before switching for redo
      const currentChangeId = await getCurrentChangeId();

      // Push current state to redo stack
      redoStack.push({
        changeId: currentChangeId,
        messageId: targetEntryId,
      });

      // Restore the jj checkpoint
      const success = await execJj(["edit", changeId], "Failed to undo", ctx);
      if (!success) {
        // Remove from redo stack if jj edit failed
        redoStack.pop();
        return;
      }

      // Update lastUserMessageEntryId to the target entry
      lastUserMessageEntryId = targetEntryId;

      // Find the previous user message with a snapshot for further undos
      const targetIndex = userEntries.findIndex((e) => e.id === targetEntryId);
      for (let i = targetIndex - 1; i >= 0; i--) {
        const entry = userEntries[i];
        if (snapshots.has(entry.id)) {
          lastUserMessageEntryId = entry.id;
          break;
        }
      }

      // Navigate back in the session tree to the user message
      // This should put the user back in edit mode at that message
      const result = await ctx.navigateTree(targetEntryId, {
        summarize: false, // Don't create a summary, just navigate
      });

      if (result.cancelled) {
        ctx.ui.notify("Navigation was cancelled", "warning");
      } else {
        ctx.ui.notify(
          `Reverted to checkpoint ${changeId} and restored edit mode`,
          "info",
        );
      }
    },
  });

  /**
   * Redo command: Restore to the checkpoint before the last undo.
   * Supports multiple redos by maintaining a stack.
   */
  pi.registerCommand("redo", {
    description:
      "Redo the last undo operation by switching back to the previous checkpoint",
    handler: async (args: string[], ctx: ExtensionCommandContext) => {
      if (redoStack.length === 0) {
        ctx.ui.notify("No undo operation to redo", "warning");
        return;
      }

      // Pop the last redo checkpoint
      const redoEntry = redoStack.pop()!;
      const { changeId: redoChangeId, messageId: redoMessageId } = redoEntry;

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

      // Update lastUserMessageEntryId to the redone message for further operations
      lastUserMessageEntryId = redoMessageId;

      // Navigate forward in the session tree to the message
      // This should put the user back in edit mode at that message
      const result = await ctx.navigateTree(redoMessageId, {
        summarize: false, // Don't create a summary, just navigate
      });

      if (result.cancelled) {
        ctx.ui.notify("Navigation was cancelled", "warning");
      } else {
        ctx.ui.notify(
          `Redid to checkpoint ${redoChangeId} and restored edit mode`,
          "info",
        );
      }
    },
  });

  /**
   * Snapshots command: Show available snapshots with user-friendly formatting.
   */
  pi.registerCommand("snapshots", {
    description: "Show available snapshots",
    handler: async (args: string[], ctx: ExtensionCommandContext) => {
      if (snapshots.size === 0) {
        ctx.ui.notify("No snapshots available", "info");
        return;
      }

      // Get current change ID for context
      const currentId = await getCurrentChangeId();

      // Format snapshots with descriptions
      const snapshotList = Array.from(snapshots.entries())
        .filter(([entryId]) => entryId !== "__pending__")
        .map(([entryId, changeId]) => {
          const isCurrent = changeId === currentId ? " (current)" : "";
          return `${changeId.substring(0, 8)}...${isCurrent} - Entry: ${entryId}`;
        })
        .join("\n");

      const redoInfo =
        redoStack.length > 0
          ? `\nRedo available: ${redoStack.length} level(s)`
          : "";

      ctx.ui.notify(`Available snapshots:\n${snapshotList}${redoInfo}`, "info");
    },
  });
}
