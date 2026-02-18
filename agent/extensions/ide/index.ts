/**
 * IDE Extension
 *
 * Manage pi subagents in isolated jujutsu workspaces.
 *
 * Hooks into /fork to create jj workspaces with subagents.
 *
 * Commands:
 * - /workspaces - Review workspace list and diffs (split view with file panel)
 * - /symbols - Browse symbols and insert path:line references
 * - /files - Browse files and insert path references
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Key, Text, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { textResult, errorResult } from "../../shared/tool-utils";
import { formatFileStats } from "./types";
import { fetchUsageForModel, type UsageSnapshot } from "./footer/usage";
import {
  generateWorkspaceName,
  createWorkspace,
  spawnAgent,
  forkSessionToWorkspace,
  getCurrentChangeId,
  isCurrentChangeEmpty,
  loadAgentWorkspaces,
} from "./workspace";
import { createWorkspacesComponent } from "./components/workspaces-component";
import {
  createSymbolsComponent,
  type SymbolResult,
} from "./components/symbols-component";
import {
  createCmResultsComponent,
  CM_COMMANDS,
  type CmResult,
  type CmActionType,
} from "./components/cm-results-component";
import {
  createFilesComponent,
  type FileResult,
} from "./components/files-component";

import { createChangesComponent } from "./components/changes-component";
import { createBookmarkPromptComponent } from "./components/bookmark-prompt-component";
import { createBookmarksComponent } from "./components/bookmarks-component";
import { createOpLogComponent } from "./components/oplog-component";
import { createSkillBrowserComponent } from "./components/skill-browser-component";
import { createCommandPaletteComponent } from "./components/command-palette-component";
import { createPullRequestsComponent } from "./components/pull-requests-component";
import {
  createLinearIssuesComponent,
  createLinearIssueForm,
  getLinearApiKey,
  saveLinearApiKey,
  linearGraphQL,
  type LinearIssuesResult,
  type IssueFormResult,
} from "./components/linear-issues-component";
import {
  setBookmarkToChange,
  getJjLogForSystemPrompt,
  getVcsLabel,
} from "./jj";
import type { AppAction } from "@mariozechner/pi-coding-agent";
import type { KeyId } from "@mariozechner/pi-tui";

// Common overlay options for full-screen components
const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "95%" as const,
    anchor: "center" as const,
  },
};

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}m`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(value);
}

function shortenHomePath(cwd: string): string {
  const home = process.env.HOME;
  if (!home) {
    return cwd;
  }
  if (cwd === home) {
    return "~";
  }
  if (cwd.startsWith(`${home}/`)) {
    return `~${cwd.slice(home.length)}`;
  }
  return cwd;
}

function formatCompactQuota(usage: UsageSnapshot | undefined): string {
  if (!usage || usage.error || usage.windows.length === 0) {
    return "";
  }

  return usage.windows
    .map((window) => {
      const usedPercent = Math.round(window.usedPercent);
      const resetSuffix = window.resetDescription
        ? ` (${window.resetDescription})`
        : "";
      return `${window.label}: ${usedPercent}%${resetSuffix}`;
    })
    .join(", ");
}

function padLine(
  left: string,
  center: string,
  right: string,
  width: number,
): string {
  const minGap = 2;
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const centerWidth = visibleWidth(center);

  const availableCenter = width - leftWidth - rightWidth - minGap * 2;

  if (availableCenter <= 0) {
    return truncateToWidth(`${left} ${right}`, width);
  }

  const centerText =
    centerWidth > availableCenter
      ? truncateToWidth(center, availableCenter)
      : center;

  const currentWidth = leftWidth + visibleWidth(centerText) + rightWidth;
  const remaining = Math.max(0, width - currentWidth);
  const leftGap = " ".repeat(minGap);
  const rightGap = " ".repeat(Math.max(minGap, remaining - minGap));

  return truncateToWidth(
    `${left}${leftGap}${centerText}${rightGap}${right}`,
    width,
  );
}

async function spawnWorkspaceAgent(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  workspacePath: string,
  workspaceName: string,
  description: string,
  sessionFile: string,
): Promise<void> {
  const forkedSessionPath = forkSessionToWorkspace(sessionFile, workspacePath);

  await spawnAgent(
    pi,
    workspacePath,
    workspaceName,
    description,
    forkedSessionPath,
  );

  if (ctx.hasUI) {
    ctx.ui.notify(
      `Created workspace ${workspaceName} and spawned agent`,
      "info",
    );
  }

  void monitorWorkspace(pi, workspaceName, ctx);
}

export default function ideExtension(pi: ExtensionAPI) {
  let jjLog: string | null = null;
  let lastContext: ExtensionContext | null = null;
  let currentVcsLabel: string | null = null;
  let currentUsage: UsageSnapshot | undefined;
  let isFooterRefreshInProgress = false;
  let requestFooterRender: (() => void) | undefined;

  function installGlobalFooter(ctx: ExtensionContext): void {
    if (!ctx.hasUI) {
      return;
    }

    ctx.ui.setFooter((tui, theme, footerData) => {
      requestFooterRender = () => {
        tui.requestRender();
      };
      const unsubscribe = footerData.onBranchChange(() => {
        tui.requestRender();
      });
      const refreshTimer = setInterval(() => {
        tui.requestRender();
      }, 60_000);

      return {
        dispose() {
          unsubscribe();
          clearInterval(refreshTimer);
          if (requestFooterRender) {
            requestFooterRender = undefined;
          }
        },
        invalidate() {},
        render(width: number): string[] {
          let totalCost = 0;

          for (const entry of ctx.sessionManager.getEntries()) {
            if (
              entry.type !== "message" ||
              entry.message.role !== "assistant"
            ) {
              continue;
            }

            const message = entry.message;
            totalCost += message.usage.cost.total;
          }

          const sessionName = ctx.sessionManager.getSessionName();
          const cwd = shortenHomePath(ctx.cwd);

          const usingSubscription = ctx.model
            ? ctx.modelRegistry.isUsingOAuth(ctx.model)
            : false;
          const costText = `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;

          const contextUsage = ctx.getContextUsage();
          const contextWindow =
            contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
          const contextPercent = contextUsage?.percent;
          const contextText =
            contextPercent === null || contextPercent === undefined
              ? `?/${formatTokenCount(contextWindow)} (auto)`
              : `${contextPercent.toFixed(1)}%/${formatTokenCount(contextWindow)} (auto)`;

          let contextColored = contextText;
          if (contextPercent !== null && contextPercent !== undefined) {
            if (contextPercent > 90) {
              contextColored = theme.fg("error", contextText);
            } else if (contextPercent > 70) {
              contextColored = theme.fg("warning", contextText);
            }
          }

          const thinkingLevel = pi.getThinkingLevel();
          const quotaText = formatCompactQuota(currentUsage);
          const modelText = ctx.model
            ? `${ctx.model.id} • ${thinkingLevel}`
            : "no-model";

          const leftText = `${theme.fg("accent", cwd)}${currentVcsLabel ? ` ${theme.fg("dim", currentVcsLabel)}` : ""}${sessionName ? theme.fg("dim", ` • ${sessionName}`) : ""}`;
          const centerText =
            quotaText.length > 0
              ? `${modelText} • ${theme.fg("dim", quotaText)}`
              : modelText;
          const rightText = `${theme.fg("dim", costText)} • ${contextColored}`;
          const line = padLine(leftText, centerText, rightText, width);

          return [truncateToWidth(line, width)];
        },
      };
    });
  }

  async function refreshFooterData(): Promise<void> {
    if (!lastContext || isFooterRefreshInProgress) {
      return;
    }

    isFooterRefreshInProgress = true;
    try {
      const [vcsLabel, usage] = await Promise.all([
        getVcsLabel(pi, lastContext.cwd),
        lastContext.model ? fetchUsageForModel(lastContext.model) : undefined,
      ]);
      currentVcsLabel = vcsLabel;
      currentUsage = usage;
      requestFooterRender?.();
    } finally {
      isFooterRefreshInProgress = false;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    lastContext = ctx;
    installGlobalFooter(ctx);
    jjLog = await getJjLogForSystemPrompt(pi, ctx.cwd);
    await refreshFooterData();
  });

  pi.on("model_select", async (_event, ctx) => {
    lastContext = ctx;
    installGlobalFooter(ctx);
    await refreshFooterData();
  });

  setInterval(
    () => {
      void refreshFooterData();
    },
    5 * 60 * 1000,
  );

  pi.on("before_agent_start", async (event) => {
    if (!jjLog) return;
    return { systemPrompt: event.systemPrompt + "\n\n" + jjLog };
  });

  async function promptAndSetBookmark(
    ctx: ExtensionContext,
    changeId: string,
  ): Promise<string | null> {
    if (!ctx.hasUI) {
      return null;
    }

    const bookmarkName = await ctx.ui.custom<string | null>(
      (tui, theme, keybindings, done) => {
        return createBookmarkPromptComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          changeId,
          ctx.cwd,
        );
      },
      {
        overlay: true,
        overlayOptions: {
          width: "56%",
          minWidth: 48,
          maxHeight: 10,
          anchor: "center",
        },
      },
    );

    if (!bookmarkName) {
      return null;
    }

    await setBookmarkToChange(pi, ctx.cwd, bookmarkName, changeId);
    return bookmarkName;
  }

  let pendingChangeDescription: string | null = null;

  /**
   * Capture interactive prompt text and defer change creation until tool execution.
   */
  pi.on("input", async (event) => {
    if (event.source !== "interactive") {
      return;
    }

    pendingChangeDescription = event.text.split("\n")[0]?.trim() || null;
  });

  const READONLY_BASH_COMMANDS = new Set([
    "ls",
    "cat",
    "head",
    "tail",
    "grep",
    "rg",
    "find",
    "fd",
    "tree",
    "file",
    "stat",
    "wc",
    "diff",
    "which",
    "type",
    "echo",
    "pwd",
    "env",
    "printenv",
    "date",
    "whoami",
    "hostname",
    "uname",
    "df",
    "du",
    "free",
    "ps",
    "top",
    "htop",
    "jj",
    "git",
    "bat",
    "less",
    "more",
  ]);

  function isReadonlyToolCall(event: {
    toolName: string;
    input?: unknown;
  }): boolean {
    if (event.toolName === "read") {
      return true;
    }

    if (event.toolName === "bash") {
      const input = event.input as { command?: string } | undefined;
      const command = input?.command?.trim() ?? "";
      const firstWord = command.split(/\s+/)[0] ?? "";
      return READONLY_BASH_COMMANDS.has(firstWord);
    }

    return false;
  }

  /**
   * Create a jj change only when the agent actually starts executing a write tool.
   */
  pi.on("tool_call", async (event, ctx) => {
    if (!pendingChangeDescription) {
      return;
    }

    if (isReadonlyToolCall(event)) {
      return;
    }

    try {
      if (await isCurrentChangeEmpty(pi, ctx.cwd)) {
        await pi.exec("jj", ["desc", "-m", pendingChangeDescription], {
          cwd: ctx.cwd,
        });
      } else {
        await pi.exec("jj", ["new", "-m", pendingChangeDescription], {
          cwd: ctx.cwd,
        });
      }
    } catch {
      // Silently fail if jj commands fail (e.g., not a jj repo)
    } finally {
      pendingChangeDescription = null;
    }
  });

  /**
   * Hook into /fork to create a jj workspace and spawn a subagent
   */
  pi.on("session_fork", async (event, ctx) => {
    try {
      // Get current change ID
      const parentChangeId = await getCurrentChangeId(pi, ctx.cwd);

      // Generate workspace name
      const workspaceName = generateWorkspaceName();

      // Get a description from the forked session or use a default
      const description = `Fork from ${event.previousSessionFile || "session"}`;

      // Create the jj workspace
      const workspacePath = await createWorkspace(
        pi,
        workspaceName,
        description,
        parentChangeId,
      );

      // The new session file is already created by /fork
      // We use it directly for the subagent
      const newSessionFile = ctx.sessionManager.getSessionFile();
      if (!newSessionFile) {
        throw new Error("No session file available");
      }

      // Spawn agent in workspace
      await spawnWorkspaceAgent(
        pi,
        ctx,
        workspacePath,
        workspaceName,
        description,
        newSessionFile,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (ctx.hasUI) {
        ctx.ui.notify(`Failed to create workspace on fork: ${msg}`, "error");
      }
    }
  });

  /**
   * /workspace <desc> - Create a workspace and spawn a subagent
   */
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    handler: async (args, ctx) => {
      const description = args.trim();

      if (!description) {
        if (ctx.hasUI) {
          ctx.ui.notify("Usage: /workspace <task description>", "warning");
        }
        return;
      }

      try {
        // Get current change ID
        const parentChangeId = await getCurrentChangeId(pi);

        // Generate workspace name
        const workspaceName = generateWorkspaceName();

        // Create the workspace
        const workspacePath = await createWorkspace(
          pi,
          workspaceName,
          description,
          parentChangeId,
        );

        // Fork the current session to the workspace for context continuity
        const currentSessionFile = ctx.sessionManager.getSessionFile();
        if (!currentSessionFile) {
          throw new Error("No session file available");
        }

        // Spawn agent in workspace
        await spawnWorkspaceAgent(
          pi,
          ctx,
          workspacePath,
          workspaceName,
          description,
          currentSessionFile,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.notify(`Failed to create workspace: ${msg}`, "error");
        }
      }
    },
  });

  /**
   * /workspaces - Open the review interface
   */
  pi.registerCommand("workspaces", {
    description: "Review ide workspaces and their diffs",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        return;
      }

      await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
        return createWorkspacesComponent(pi, tui, theme, keybindings, done);
      }, FULL_OVERLAY_OPTIONS);
    },
  });

  /**
   * /symbols - Browse and pick symbols from the codebase
   */
  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openSymbolsPicker(pi, ctx, args.trim());
    },
  });

  /**
   * /files - Browse and pick files from the codebase
   */
  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openFilesPicker(pi, ctx, args.trim());
    },
  });

  /**
   * /bookmarks - Browse bookmarks and forget selected
   */
  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openBookmarksBrowser(pi, ctx);
    },
  });

  /**
   * /changes - Browse jujutsu changes on current branch with diff preview
   */
  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  /**
   * /oplog - Browse jujutsu operation log
   */
  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openOpLogBrowser(pi, ctx);
    },
  });

  /**
   * /skills - Browse and install skills
   */
  pi.registerCommand("skills", {
    description: "Browse local skills and install from skills.sh",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openSkillBrowser(pi, ctx, args.trim());
    },
  });

  /**
   * /pull-requests - Browse GitHub pull requests
   */
  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openPullRequestsBrowser(pi, ctx);
    },
  });

  /**
   * /linear - Browse Linear issues
   */
  pi.registerCommand("linear", {
    description: "Browse Linear issues with markdown preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openLinearIssuesBrowser(pi, ctx);
    },
  });

  /**
   * /linear-login - Save Linear API key
   */
  pi.registerCommand("linear-login", {
    description: "Save Linear API key for /linear command",
    handler: async (args, ctx) => {
      const apiKey = args.trim();

      if (!apiKey) {
        if (ctx.hasUI) {
          ctx.ui.notify(
            "Usage: /linear-login <api-key> (get key from Linear Settings > API)",
            "warning",
          );
        }
        return;
      }

      try {
        saveLinearApiKey(apiKey);
        if (ctx.hasUI) {
          ctx.ui.notify("Linear API key saved successfully", "info");
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.notify(`Failed to save API key: ${msg}`, "error");
        }
      }
    },
  });

  /**
   * Ctrl+T shortcut to launch symbol picker
   */
  pi.registerShortcut(Key.ctrl("t"), {
    description: "Open symbol picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openSymbolsPicker(pi, ctx, "");
    },
  });

  /**
   * Ctrl+P shortcut to launch file picker
   */
  pi.registerShortcut(Key.ctrl("p"), {
    description: "Open file picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openFilesPicker(pi, ctx, "");
    },
  });

  /**
   * Ctrl+B shortcut to open bookmarks browser
   */
  pi.registerShortcut(Key.ctrl("b"), {
    description: "Open bookmarks browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openBookmarksBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+J shortcut to open workspaces review
   */
  pi.registerShortcut(Key.ctrl("j"), {
    description: "Open workspaces review",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
        return createWorkspacesComponent(pi, tui, theme, keybindings, done);
      }, FULL_OVERLAY_OPTIONS);
    },
  });

  /**
   * Ctrl+K shortcut to open changes browser
   */
  pi.registerShortcut(Key.ctrl("k"), {
    description: "Open changes browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  /**
   * Ctrl+O shortcut to open op log browser
   */
  pi.registerShortcut(Key.ctrl("o"), {
    description: "Open operation log browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openOpLogBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+S shortcut to open skill browser
   */
  pi.registerShortcut(Key.ctrl("s"), {
    description: "Open skill browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openSkillBrowser(pi, ctx, "");
    },
  });

  /**
   * Ctrl+G shortcut to open pull requests browser
   */
  pi.registerShortcut(Key.ctrl("g"), {
    description: "Open pull requests browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openPullRequestsBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+U shortcut to open Linear issues browser
   */
  pi.registerShortcut(Key.ctrl("u"), {
    description: "Open Linear issues browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openLinearIssuesBrowser(pi, ctx);
    },
  });

  // Track registered shortcuts for command palette
  // The execute functions capture ctx from openCommandPalette
  let currentCtx: ExtensionContext | null = null;

  const registeredShortcuts: {
    shortcut: KeyId;
    description?: string;
    execute: () => void;
  }[] = [
    {
      shortcut: Key.ctrl("t"),
      description: "Open symbol picker",
      execute: () => {
        if (currentCtx) {
          void openSymbolsPicker(pi, currentCtx, "");
        }
      },
    },
    {
      shortcut: Key.ctrl("p"),
      description: "Open file picker",
      execute: () => {
        if (currentCtx) {
          void openFilesPicker(pi, currentCtx, "");
        }
      },
    },
    {
      shortcut: Key.ctrl("b"),
      description: "Open bookmarks browser",
      execute: () => {
        if (currentCtx) {
          void openBookmarksBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrl("j"),
      description: "Open workspaces review",
      execute: () => {
        if (currentCtx) {
          void currentCtx.ui.custom<void>((tui, theme, keybindings, done) => {
            return createWorkspacesComponent(pi, tui, theme, keybindings, done);
          }, FULL_OVERLAY_OPTIONS);
        }
      },
    },
    {
      shortcut: Key.ctrl("k"),
      description: "Open changes browser",
      execute: () => {
        if (currentCtx) {
          void openChangesBrowser(pi, currentCtx, promptAndSetBookmark);
        }
      },
    },
    {
      shortcut: Key.ctrl("o"),
      description: "Open operation log browser",
      execute: () => {
        if (currentCtx) {
          void openOpLogBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrl("s"),
      description: "Open skill browser",
      execute: () => {
        if (currentCtx) {
          void openSkillBrowser(pi, currentCtx, "");
        }
      },
    },
    {
      shortcut: Key.ctrl("g"),
      description: "Open pull requests browser",
      execute: () => {
        if (currentCtx) {
          void openPullRequestsBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrl("u"),
      description: "Open Linear issues browser",
      execute: () => {
        if (currentCtx) {
          void openLinearIssuesBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrlShift("p"),
      description: "Open command palette",
      execute: () => {
        // Don't re-open command palette from itself
      },
    },
  ];

  /**
   * /commands - Open the command palette
   */
  pi.registerCommand("commands", {
    description: "Open command palette to search and execute commands",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      currentCtx = ctx;
      await openCommandPalette(pi, ctx, registeredShortcuts);
      currentCtx = null;
    },
  });

  /**
   * Ctrl+Shift+P shortcut handler also needs to set currentCtx
   */
  pi.registerShortcut(Key.ctrlShift("p"), {
    description: "Open command palette",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      currentCtx = ctx;
      await openCommandPalette(pi, ctx, registeredShortcuts);
      currentCtx = null;
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Linear Tools
  // ─────────────────────────────────────────────────────────────────────────

  interface LinearIssueQueryResult {
    issues: {
      nodes: {
        id: string;
        identifier: string;
        title: string;
        description: string | null;
        priority: number;
        url: string;
        state: { name: string; type: string } | null;
        team: { key: string; name: string } | null;
        assignee: { name: string; displayName: string | null } | null;
      }[];
    };
  }

  interface LinearSingleIssueResult {
    issue: {
      id: string;
      identifier: string;
      title: string;
      description: string | null;
      priority: number;
      url: string;
      state: { name: string; type: string } | null;
      team: { key: string; name: string } | null;
      assignee: { name: string; displayName: string | null } | null;
      labels: { nodes: { name: string }[] };
      comments: { nodes: { body: string; user: { name: string } | null }[] };
    } | null;
  }

  interface LinearCreateResult {
    issueCreate: {
      success: boolean;
      issue: {
        id: string;
        identifier: string;
        url: string;
        title: string;
      } | null;
    };
  }

  interface LinearUpdateResult {
    issueUpdate: {
      success: boolean;
      issue: { id: string; identifier: string; title: string } | null;
    };
  }

  interface LinearTeamsResult {
    teams: { nodes: { id: string; key: string; name: string }[] };
  }

  function formatIssueForAgent(issue: {
    identifier: string;
    title: string;
    description: string | null;
    priority: number;
    url: string;
    state: { name: string; type: string } | null;
    team: { key: string; name: string } | null;
    assignee: { name: string; displayName: string | null } | null;
  }): string {
    const priority =
      ["none", "urgent", "high", "normal", "low"][issue.priority] ?? "none";
    const state = issue.state?.name ?? "unknown";
    const team = issue.team?.key ?? "-";
    const assignee =
      issue.assignee?.displayName ?? issue.assignee?.name ?? "unassigned";
    return `${issue.identifier}: ${issue.title}\n  State: ${state} | Priority: ${priority} | Team: ${team} | Assignee: ${assignee}\n  URL: ${issue.url}`;
  }

  /**
   * Tool: linear-search - Search Linear issues
   */
  pi.registerTool({
    name: "linear-search",
    label: "Linear Search",
    description:
      "Search Linear issues. Returns a list of issues matching the query.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description: "Search query (searches title and description)",
        }),
      ),
      assignedToMe: Type.Optional(
        Type.Boolean({ description: "Filter to issues assigned to me" }),
      ),
      state: Type.Optional(
        Type.String({
          description: "Filter by state name (e.g., 'In Progress', 'Done')",
        }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 20)" }),
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const apiKey = getLinearApiKey();
      if (!apiKey) {
        return errorResult("Not logged in to Linear. Run /linear-login first.");
      }

      const limit = params.limit ?? 20;
      const filters: string[] = [];

      if (params.query) {
        filters.push(
          `{ or: [{ title: { containsIgnoreCase: "${params.query}" } }, { description: { containsIgnoreCase: "${params.query}" } }] }`,
        );
      }
      if (params.assignedToMe) {
        filters.push(`{ assignee: { isMe: { eq: true } } }`);
      }
      if (params.state) {
        filters.push(
          `{ state: { name: { eqIgnoreCase: "${params.state}" } } }`,
        );
      }

      const filterClause =
        filters.length > 0 ? `filter: { and: [${filters.join(", ")}] },` : "";

      const query = `
        query SearchIssues {
          issues(first: ${limit}, ${filterClause} orderBy: updatedAt) {
            nodes {
              id identifier title description priority url
              state { name type }
              team { key name }
              assignee { name displayName }
            }
          }
        }
      `;

      try {
        const data = await linearGraphQL<LinearIssueQueryResult>(apiKey, {
          query,
        });
        const issues = data.issues.nodes;

        if (issues.length === 0) {
          return textResult("No issues found.");
        }

        const text = issues.map(formatIssueForAgent).join("\n\n");
        return textResult(`Found ${issues.length} issue(s):\n\n${text}`, {
          issues,
        });
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      let text = theme.fg("toolTitle", theme.bold("linear-search"));
      if (args.query) text += theme.fg("muted", ` "${args.query}"`);
      if (args.assignedToMe) text += theme.fg("dim", " (mine)");
      if (args.state) text += theme.fg("dim", ` state:${args.state}`);
      return new Text(text, 0, 0);
    },
  });

  /**
   * Tool: linear-get-issue - Get a specific Linear issue
   */
  pi.registerTool({
    name: "linear-get-issue",
    label: "Linear Get Issue",
    description:
      "Get details of a specific Linear issue by identifier (e.g., 'ENG-123').",
    parameters: Type.Object({
      identifier: Type.String({
        description: "Issue identifier (e.g., 'ENG-123')",
      }),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const apiKey = getLinearApiKey();
      if (!apiKey) {
        return errorResult("Not logged in to Linear. Run /linear-login first.");
      }

      const query = `
        query GetIssue($id: String!) {
          issue(id: $id) {
            id identifier title description priority url
            state { name type }
            team { key name }
            assignee { name displayName }
            labels { nodes { name } }
            comments(first: 10) { nodes { body user { name } } }
          }
        }
      `;

      try {
        const data = await linearGraphQL<LinearSingleIssueResult>(apiKey, {
          query,
          variables: { id: params.identifier },
        });

        if (!data.issue) {
          return errorResult(`Issue ${params.identifier} not found.`);
        }

        const issue = data.issue;
        const labels =
          issue.labels.nodes.map((l) => l.name).join(", ") || "none";
        const comments = issue.comments.nodes
          .map(
            (c) =>
              `  - ${c.user?.name ?? "Unknown"}: ${c.body.slice(0, 100)}${c.body.length > 100 ? "..." : ""}`,
          )
          .join("\n");

        let text = formatIssueForAgent(issue);
        text += `\n  Labels: ${labels}`;
        if (issue.description) {
          text += `\n\nDescription:\n${issue.description}`;
        }
        if (comments) {
          text += `\n\nRecent comments:\n${comments}`;
        }

        return textResult(text, { issue });
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("linear-get-issue")) +
          theme.fg("muted", ` ${args.identifier}`),
        0,
        0,
      );
    },
  });

  /**
   * Tool: linear-create-issue - Create a new Linear issue (requires confirmation)
   */
  pi.registerTool({
    name: "linear-create-issue",
    label: "Linear Create Issue",
    description: "Create a new Linear issue. Requires user confirmation.",
    parameters: Type.Object({
      title: Type.String({ description: "Issue title" }),
      description: Type.Optional(
        Type.String({ description: "Issue description (markdown)" }),
      ),
      teamKey: Type.Optional(
        Type.String({
          description:
            "Team key (e.g., 'ENG'). Uses first team if not specified.",
        }),
      ),
      priority: Type.Optional(
        Type.Number({
          description: "Priority: 0=none, 1=urgent, 2=high, 3=normal, 4=low",
        }),
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const apiKey = getLinearApiKey();
      if (!apiKey) {
        return errorResult("Not logged in to Linear. Run /linear-login first.");
      }

      // Require confirmation
      if (ctx.hasUI) {
        const confirmed = await ctx.ui.confirm(
          "Create Linear Issue",
          `Create issue: "${params.title}"?`,
        );
        if (!confirmed) {
          return textResult("Issue creation cancelled by user.");
        }
      }

      try {
        // Get team ID
        let teamId: string;
        if (params.teamKey) {
          const teamsQuery = `query { teams { nodes { id key } } }`;
          const teamsData = await linearGraphQL<LinearTeamsResult>(apiKey, {
            query: teamsQuery,
          });
          const team = teamsData.teams.nodes.find(
            (t) => t.key.toLowerCase() === params.teamKey!.toLowerCase(),
          );
          if (!team) {
            return errorResult(`Team '${params.teamKey}' not found.`);
          }
          teamId = team.id;
        } else {
          const teamsQuery = `query { teams(first: 1) { nodes { id } } }`;
          const teamsData = await linearGraphQL<LinearTeamsResult>(apiKey, {
            query: teamsQuery,
          });
          if (teamsData.teams.nodes.length === 0) {
            return errorResult("No teams found.");
          }
          teamId = teamsData.teams.nodes[0].id;
        }

        const mutation = `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue { id identifier url title }
            }
          }
        `;

        const input: Record<string, unknown> = {
          teamId,
          title: params.title,
        };
        if (params.description) input.description = params.description;
        if (params.priority !== undefined) input.priority = params.priority;

        const data = await linearGraphQL<LinearCreateResult>(apiKey, {
          query: mutation,
          variables: { input },
        });

        if (!data.issueCreate.success || !data.issueCreate.issue) {
          return errorResult("Failed to create issue.");
        }

        const issue = data.issueCreate.issue;
        return textResult(
          `Created ${issue.identifier}: ${issue.title}\nURL: ${issue.url}`,
          { issue },
        );
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("linear-create-issue")) +
          theme.fg("muted", ` "${args.title}"`),
        0,
        0,
      );
    },
  });

  /**
   * Tool: linear-update-issue - Update a Linear issue (requires confirmation)
   */
  pi.registerTool({
    name: "linear-update-issue",
    label: "Linear Update Issue",
    description: "Update an existing Linear issue. Requires user confirmation.",
    parameters: Type.Object({
      identifier: Type.String({
        description: "Issue identifier (e.g., 'ENG-123')",
      }),
      title: Type.Optional(Type.String({ description: "New title" })),
      description: Type.Optional(
        Type.String({ description: "New description (markdown)" }),
      ),
      state: Type.Optional(
        Type.String({
          description: "New state name (e.g., 'In Progress', 'Done')",
        }),
      ),
      priority: Type.Optional(
        Type.Number({
          description: "Priority: 0=none, 1=urgent, 2=high, 3=normal, 4=low",
        }),
      ),
    }),

    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const apiKey = getLinearApiKey();
      if (!apiKey) {
        return errorResult("Not logged in to Linear. Run /linear-login first.");
      }

      const changes: string[] = [];
      if (params.title) changes.push(`title: "${params.title}"`);
      if (params.description) changes.push(`description: (updated)`);
      if (params.state) changes.push(`state: ${params.state}`);
      if (params.priority !== undefined)
        changes.push(`priority: ${params.priority}`);

      if (changes.length === 0) {
        return errorResult("No changes specified.");
      }

      // Require confirmation
      if (ctx.hasUI) {
        const confirmed = await ctx.ui.confirm(
          "Update Linear Issue",
          `Update ${params.identifier}?\n\nChanges:\n${changes.map((c) => `  - ${c}`).join("\n")}`,
        );
        if (!confirmed) {
          return textResult("Issue update cancelled by user.");
        }
      }

      try {
        // First get the issue ID from identifier
        const getQuery = `query GetIssue($id: String!) { issue(id: $id) { id } }`;
        const issueData = await linearGraphQL<{ issue: { id: string } | null }>(
          apiKey,
          {
            query: getQuery,
            variables: { id: params.identifier },
          },
        );

        if (!issueData.issue) {
          return errorResult(`Issue ${params.identifier} not found.`);
        }

        const input: Record<string, unknown> = {};
        if (params.title) input.title = params.title;
        if (params.description) input.description = params.description;
        if (params.priority !== undefined) input.priority = params.priority;

        // Handle state change
        if (params.state) {
          const statesQuery = `query { workflowStates { nodes { id name } } }`;
          const statesData = await linearGraphQL<{
            workflowStates: { nodes: { id: string; name: string }[] };
          }>(apiKey, { query: statesQuery });
          const state = statesData.workflowStates.nodes.find(
            (s) => s.name.toLowerCase() === params.state!.toLowerCase(),
          );
          if (!state) {
            return errorResult(`State '${params.state}' not found.`);
          }
          input.stateId = state.id;
        }

        const mutation = `
          mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue { id identifier title }
            }
          }
        `;

        const data = await linearGraphQL<LinearUpdateResult>(apiKey, {
          query: mutation,
          variables: { id: issueData.issue.id, input },
        });

        if (!data.issueUpdate.success || !data.issueUpdate.issue) {
          return errorResult("Failed to update issue.");
        }

        const issue = data.issueUpdate.issue;
        return textResult(`Updated ${issue.identifier}: ${issue.title}`, {
          issue,
        });
      } catch (error) {
        return errorResult(error);
      }
    },

    renderCall(args, theme) {
      let text =
        theme.fg("toolTitle", theme.bold("linear-update-issue")) +
        theme.fg("muted", ` ${args.identifier}`);
      if (args.title)
        text += theme.fg("dim", ` title:"${args.title.slice(0, 30)}..."`);
      if (args.state) text += theme.fg("dim", ` state:${args.state}`);
      return new Text(text, 0, 0);
    },
  });
}

/**
 * Navigation stack for overlay history.
 * Escape pops to previous screen instead of closing all.
 */
type ScreenFactory<T> = (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
) => Promise<{ result: T | null; action?: CmActionType; target?: string }>;

interface NavScreen {
  factory: ScreenFactory<unknown>;
}

/**
 * Run a navigation stack loop. Screens can push new screens via actions,
 * and escape pops back to the previous screen.
 */
async function runNavigationStack<T>(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialScreen: ScreenFactory<T>,
): Promise<T | null> {
  const stack: NavScreen[] = [
    { factory: initialScreen as ScreenFactory<unknown> },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { result, action, target } = await current.factory(pi, ctx);

    if (result === null) {
      // Escape pressed - pop current screen
      stack.pop();
      continue;
    }

    if (action && target) {
      // Action triggered - push cm results screen
      const cmDef = CM_COMMANDS[action];
      if (cmDef) {
        stack.push({
          factory: async (pi, ctx) => {
            const cmResult = await ctx.ui.custom<CmResult | null>(
              (tui, theme, keybindings, done) =>
                createCmResultsComponent(pi, tui, theme, keybindings, done, {
                  title: cmDef.titleFn(target),
                  command: cmDef.command,
                  args: cmDef.argsFn(target),
                  cwd: ctx.cwd,
                }),
              FULL_OVERLAY_OPTIONS,
            );
            if (!cmResult) return { result: null };
            return {
              result: cmResult.item,
              action: cmResult.action,
              target: cmResult.item.name,
            };
          },
        });
      }
      continue;
    }

    // Final selection - return result and clear stack
    return result as T;
  }

  return null;
}

/**
 * Handler factories to reduce duplication between commands and shortcuts
 */

async function openFilesPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const fileResult = await ctx.ui.custom<FileResult | null>(
      (tui, theme, keybindings, done) =>
        createFilesComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          initialQuery,
          ctx.cwd,
        ),
      FULL_OVERLAY_OPTIONS,
    );
    if (!fileResult) return { result: null };
    return {
      result: fileResult.file,
      action: fileResult.action,
      target: fileResult.file.path,
    };
  });

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(currentText + result.path);
  }
}

async function openSymbolsPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const symbolResult = await ctx.ui.custom<SymbolResult | null>(
      (tui, theme, keybindings, done) =>
        createSymbolsComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          initialQuery,
          ctx.cwd,
        ),
      FULL_OVERLAY_OPTIONS,
    );
    if (!symbolResult) return { result: null };
    return {
      result: symbolResult.symbol,
      action: symbolResult.action,
      target: symbolResult.symbol.name,
    };
  });

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(currentText + `${result.path}:${result.startLine}`);
  }
}

async function openBookmarksBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom((tui, theme, keybindings, done) => {
    return createBookmarksComponent(
      pi,
      tui,
      theme,
      keybindings,
      done,
      ctx.cwd,
      (text) => {
        ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
      },
    );
  }, FULL_OVERLAY_OPTIONS);
}

async function openOpLogBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom((tui, theme, keybindings, done) => {
    return createOpLogComponent(pi, tui, theme, keybindings, done, ctx.cwd);
  }, FULL_OVERLAY_OPTIONS);
}

async function openSkillBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await ctx.ui.custom<string | undefined>(
    (tui, theme, keybindings, done) => {
      return createSkillBrowserComponent(
        pi,
        tui,
        theme,
        keybindings,
        done,
        initialQuery,
        ctx,
      );
    },
    FULL_OVERLAY_OPTIONS,
  );

  if (result) {
    ctx.ui.setEditorText(result);
  }
}

async function openPullRequestsBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom((tui, theme, keybindings, done) => {
    return createPullRequestsComponent(
      pi,
      tui,
      theme,
      keybindings,
      done,
      ctx.cwd,
      (text) => {
        ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
      },
    );
  }, FULL_OVERLAY_OPTIONS);
}

async function openLinearIssuesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  const apiKey = getLinearApiKey();

  while (true) {
    const result = await ctx.ui.custom<LinearIssuesResult>(
      (tui, theme, keybindings, done) => {
        return createLinearIssuesComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          ctx.cwd,
          (text) => {
            ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
          },
        );
      },
      FULL_OVERLAY_OPTIONS,
    );

    if (!result.action) {
      break;
    }

    if (!apiKey) {
      ctx.ui.notify("Not logged in to Linear", "error");
      break;
    }

    const formResult = await ctx.ui.custom<IssueFormResult>(
      (tui, theme, keybindings, done) => {
        const issue =
          result.action?.type === "edit" ? result.action.issue : null;
        return createLinearIssueForm(
          pi,
          tui,
          theme,
          keybindings,
          done,
          apiKey,
          issue,
        );
      },
      {
        overlay: true,
        overlayOptions: {
          width: "70%",
          minWidth: 60,
          anchor: "center",
        },
      },
    );

    if (formResult.action === "saved" && formResult.issue) {
      ctx.ui.notify(`Created ${formResult.issue.identifier}`, "info");
    }
  }
}

async function openCommandPalette(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  registeredShortcuts: {
    shortcut: KeyId;
    description?: string;
    execute: () => void;
  }[],
): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, keybindings, done) => {
      return createCommandPaletteComponent(
        pi,
        tui,
        theme,
        keybindings,
        done,
        (command) => {
          // Execute a slash command by setting it in the editor
          ctx.ui.setEditorText(command);
        },
        (action: AppAction) => {
          // Execute actions that we can handle directly
          if (action === "interrupt") {
            ctx.abort();
          } else {
            // Actions that can only be triggered via keybinding
            const keys = keybindings.getKeys(action);
            const keyStr = keys.length > 0 ? keys[0] : "no keybinding";
            ctx.ui.notify(`Press ${keyStr} to ${action}`, "info");
          }
        },
        registeredShortcuts,
      );
    },
    {
      overlay: true,
      overlayOptions: {
        width: "70%",
        maxHeight: "60%",
        minWidth: 60,
        anchor: "center",
      },
    },
  );
}

async function openChangesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
  ) => Promise<string | null>,
): Promise<void> {
  const showChanges = async (): Promise<{
    filePath: string;
    action: CmActionType;
  } | null> => {
    let pendingCmAction: { filePath: string; action: CmActionType } | null =
      null;

    await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
      return createChangesComponent(
        { pi, tui, theme, keybindings, cwd: ctx.cwd },
        done,
        (text) => {
          ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
        },
        (changeId) => promptAndSetBookmark(ctx, changeId),
        async (filePath, action) => {
          pendingCmAction = { filePath, action };
          done();
        },
      );
    }, FULL_OVERLAY_OPTIONS);

    return pendingCmAction;
  };

  // Loop to handle cm actions and return to changes
  while (true) {
    const cmAction = await showChanges();

    if (!cmAction) break;

    // Show cm results, then loop back to changes
    const cmDef = CM_COMMANDS[cmAction.action];
    if (cmDef) {
      await ctx.ui.custom<CmResult | null>(
        (tui, theme, keybindings, done) =>
          createCmResultsComponent(pi, tui, theme, keybindings, done, {
            title: cmDef.titleFn(cmAction.filePath),
            command: cmDef.command,
            args: cmDef.argsFn(cmAction.filePath),
            cwd: ctx.cwd,
          }),
        FULL_OVERLAY_OPTIONS,
      );
    }
  }
}

/**
 * Monitor a workspace and notify when the agent completes
 */
async function monitorWorkspace(
  pi: ExtensionAPI,
  workspaceName: string,
  ctx: ExtensionContext,
): Promise<void> {
  const checkInterval = 5000; // 5 seconds
  const maxWait = 3600000; // 1 hour

  const startTime = Date.now();

  const check = async (): Promise<void> => {
    if (Date.now() - startTime > maxWait) {
      return;
    }

    try {
      const workspaces = await loadAgentWorkspaces(pi);
      const ws = workspaces.find((w) => w.name === workspaceName);

      if (!ws) {
        return; // Workspace was deleted
      }

      if (ws.status !== "running") {
        // Agent finished
        const stats = formatFileStats(ws);
        const statusText = ws.status === "completed" ? "completed" : ws.status;

        if (ctx.hasUI) {
          ctx.ui.notify(
            `Agent ${workspaceName} ${statusText} ${stats}`,
            ws.status === "completed" ? "info" : "warning",
          );
        }

        // Send desktop notification
        await pi.exec("notify-send", [
          "-a",
          "IDE",
          `Agent ${statusText}`,
          `${ws.description}\n${stats}`,
        ]);

        return;
      }

      // Still running, check again later
      setTimeout(() => void check(), checkInterval);
    } catch {
      // Error checking, try again
      setTimeout(() => void check(), checkInterval);
    }
  };

  // Start checking after initial delay
  setTimeout(() => void check(), checkInterval);
}
