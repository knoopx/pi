/**
 * Git Checkpoint Extension
 *
 * Creates git stash checkpoints at each turn so /fork and /undo can restore code state.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>();

	async function createCheckpoint(entryId: string) {
		try {
			const { stdout: status } = await pi.exec("git", ["status", "--porcelain"]);
			if (!status.trim()) return; // No changes, no need to checkpoint

			await pi.exec("git", ["stash", "push", "-m", `checkpoint-${entryId}`]);
			const { stdout } = await pi.exec("git", ["rev-parse", "stash@{0}"]);
			const ref = stdout.trim();
			if (ref) {
				checkpoints.set(entryId, ref);
			}
		} catch (e) {
			// Ignore git errors (e.g. not a git repo)
		}
	}

	// Initialize checkpoint for the current state
	pi.on("session_start", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafId();
		if (leaf) await createCheckpoint(leaf);
	});

	// Checkpoint before agent starts processing a prompt
	pi.on("before_agent_start", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafId();
		if (leaf) await createCheckpoint(leaf);
	});

	// Checkpoint at each turn start
	pi.on("turn_start", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafId();
		if (leaf) await createCheckpoint(leaf);
	});

	// Also checkpoint after tool results to allow forking/undoing from them
	pi.on("tool_result", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafId();
		if (leaf) await createCheckpoint(leaf);
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;

		if (!ctx.hasUI) return;

		const choice = await ctx.ui.select("Restore code state?", [
			"Yes, restore code to that point",
			"No, keep current code",
		]);

		if (choice?.startsWith("Yes")) {
			try {
				await pi.exec("git", ["stash", "apply", ref]);
				await pi.exec("git", ["stash", "drop", ref]);
				ctx.ui.notify("Code restored to checkpoint", "info");
			} catch (e) {
				ctx.ui.notify(`Failed to restore code: ${e}`, "error");
			}
		}
	});

	pi.registerCommand("undo", {
		description: "Undo the last user message and its edits",
		handler: async (args, ctx) => {
			await ctx.waitForIdle();
			const branch = ctx.sessionManager.getBranch();
			// Find the last message from user
			const lastUserMsg = [...branch].reverse().find((e) => e.type === "message" && e.message.role === "user");

			if (!lastUserMsg) {
				ctx.ui.notify("No user message to undo", "warning");
				return;
			}

			// The state before the user message is its parent
			const checkpointId = lastUserMsg.id;
			const targetId = lastUserMsg.parentId;
			if (!targetId) {
				ctx.ui.notify("Cannot undo the first message", "warning");
				return;
			}

			const ref = checkpoints.get(checkpointId);
			if (!ref) {
				ctx.ui.notify("No checkpoint found for that point", "warning");
				return;
			}

			const confirmed = await ctx.ui.confirm("Undo?", "This will revert code and conversation to before your last message.");
			if (!confirmed) return;

			try {
				// Apply and drop the checkpoint stash
				await pi.exec("git", ["stash", "apply", ref]);
				await pi.exec("git", ["stash", "drop", ref]);
				
				// Rewind the conversation tree
				await ctx.navigateTree(targetId);
				ctx.ui.notify("Undone!", "info");
			} catch (e) {
				ctx.ui.notify(`Undo failed: ${e}`, "error");
			}
		},
	});

	pi.on("session_shutdown", async () => {
		for (const ref of checkpoints.values()) {
			try {
				await pi.exec("git", ["stash", "drop", ref]);
			} catch (e) {
				// Ignore errors, stash may already be dropped
			}
		}
	});
}
