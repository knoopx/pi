import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  handleWorkspaceCommand,
  handleWorkspacesCommand,
} from "../workspace/handlers";
import {
  handleSymbolsCommand,
  handleFilesCommand,
  handleBookmarksCommand,
  handleChangeCommand,
  handleOplogCommand,
  handlePullRequestsCommand,
  handleTodosCommand,
  handleSearchCommand,
} from "./handlers";

export function registerCommands(
  pi: ExtensionAPI,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
  ) => Promise<string | null>,
): void {
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    handler: async (args, ctx) => {
      void handleWorkspaceCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("workspaces", {
    description: "Review ide workspaces and their diffs",
    handler: async (_args, ctx) => {
      void handleWorkspacesCommand(pi, ctx);
    },
  });

  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    handler: async (args, ctx) => {
      void handleSymbolsCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      void handleFilesCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      void handleBookmarksCommand(pi, ctx);
    },
  });

  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      void handleChangeCommand(
        pi,
        ctx,
        async (cid) => await promptAndSetBookmark(ctx, cid),
      );
    },
  });

  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    handler: async (_args, ctx) => {
      void handleOplogCommand(pi, ctx);
    },
  });

  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    handler: async (_args, ctx) => {
      void handlePullRequestsCommand(pi, ctx);
    },
  });

  pi.registerCommand("todos", {
    description:
      "Search for task comments across the codebase with source preview",
    handler: async (args, ctx) => {
      void handleTodosCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("search", {
    description:
      "Search project files using ripgrep with syntax-highlighted previews",
    handler: async (args, ctx) => {
      void handleSearchCommand(pi, args, ctx);
    },
  });
}
