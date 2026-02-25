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
import {
  Key,
  truncateToWidth,
  visibleWidth,
  type KeyId,
} from "@mariozechner/pi-tui";

import { fetchUsageForModel, type UsageSnapshot } from "./footer/usage";
import {
  generateWorkspaceName,
  createWorkspace,
  getCurrentChangeId,
  isCurrentChangeEmpty,
} from "./workspace";
import { createWorkspacesComponent } from "./components/workspaces";
import { createBookmarkPromptComponent } from "./components/bookmark-prompt";
import { saveLinearApiKey } from "./components/linear-issues";
import { registerAllTools } from "./tools/registration";
import {
  setBookmarkToChange,
  getJjLogForSystemPrompt,
  getVcsLabel,
  notifyMutation,
} from "./jj";

// Overlay imports
import { openFilesPicker } from "./overlays/files";
import { openSymbolsPicker } from "./overlays/symbols";
import { openBookmarksBrowser } from "./overlays/bookmarks";
import { openOpLogBrowser } from "./overlays/oplog";
import { openSkillBrowser } from "./overlays/skills";
import { openPullRequestsBrowser } from "./overlays/pull-requests";
import { openLinearIssuesBrowser } from "./overlays/linear";
import {
  openCommandPalette,
  type RegisteredShortcut,
} from "./overlays/command-palette";
import { openChangesBrowser } from "./overlays/changes";
import { monitorWorkspace } from "./overlays/workspace-monitor";
import { FULL_OVERLAY_OPTIONS } from "./overlays/options";

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

interface ThemeWithFg {
  fg(color: string, text: string): string;
}

function colorizeUsagePercent(theme: ThemeWithFg, usedPercent: number): string {
  const percentText = `${usedPercent}%`;
  if (usedPercent > 90) return theme.fg("error", percentText);
  if (usedPercent > 70) return theme.fg("warning", percentText);
  return theme.fg("dim", percentText);
}

function formatCompactQuota(
  usage: UsageSnapshot | undefined,
  theme: ThemeWithFg,
): string {
  if (!usage || usage.error || usage.windows.length === 0) {
    return "";
  }

  return usage.windows
    .map((window) => {
      const usedPercent = Math.round(window.usedPercent);
      const label = theme.fg("dim", `${window.label}: `);
      const resetSuffix = window.resetDescription
        ? theme.fg("dim", ` (${window.resetDescription})`)
        : "";
      return `${label}${colorizeUsagePercent(theme, usedPercent)}${resetSuffix}`;
    })
    .join(theme.fg("dim", ", "));
}

function padLine(
  left: string,
  center: string,
  right: string,
  width: number,
): string {
  const leftWidth = visibleWidth(left);
  const centerWidth = visibleWidth(center);
  const rightWidth = visibleWidth(right);

  const totalContent = leftWidth + centerWidth + rightWidth;
  if (totalContent >= width) {
    return left + " " + center + " " + right;
  }

  const availableSpace = width - totalContent;
  const leftPad = Math.floor(availableSpace / 2);
  const rightPad = availableSpace - leftPad;

  return left + " ".repeat(leftPad) + center + " ".repeat(rightPad) + right;
}

async function spawnWorkspaceAgent(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  workspacePath: string,
  workspaceName: string,
  description: string,
  sessionFile: string,
): Promise<void> {
  const { spawnAgent, forkSessionToWorkspace } = await import("./workspace");

  const newSessionFile = forkSessionToWorkspace(sessionFile, workspacePath);

  await spawnAgent(
    pi,
    workspacePath,
    workspaceName,
    description,
    newSessionFile,
  );

  if (ctx.hasUI) {
    ctx.ui.notify(`Spawned agent in workspace ${workspaceName}`, "info");
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
          const quotaText = formatCompactQuota(currentUsage, theme);
          const modelText = ctx.model
            ? `${ctx.model.id} • ${thinkingLevel}`
            : "no-model";

          const leftText = `${theme.fg("accent", cwd)}${currentVcsLabel ? ` ${theme.fg("dim", currentVcsLabel)}` : ""}${sessionName ? theme.fg("dim", ` ${sessionName}`) : ""}`;
          const centerText =
            quotaText.length > 0 ? `${modelText} ${quotaText}` : modelText;
          const rightText = `${theme.fg("dim", costText)} ${contextColored}`;
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

  // Event handlers
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

  // Bookmark prompt helper
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

  // Automatic jj change creation on first write tool
  let pendingChangeDescription: string | null = null;

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
    if (event.toolName === "read") return true;
    if (event.toolName === "bash") {
      const input = event.input as { command?: string } | undefined;
      const command = input?.command?.trim() ?? "";
      const firstWord = command.split(/\s+/)[0] ?? "";
      return READONLY_BASH_COMMANDS.has(firstWord);
    }
    return false;
  }

  pi.on("tool_call", async (event, ctx) => {
    if (!pendingChangeDescription) return;
    if (isReadonlyToolCall(event)) return;

    try {
      if (await isCurrentChangeEmpty(pi, ctx.cwd)) {
        const descResult = await pi.exec(
          "jj",
          ["desc", "-m", pendingChangeDescription],
          {
            cwd: ctx.cwd,
          },
        );
        notifyMutation(pi, "jj desc", descResult.stderr || descResult.stdout);
      } else {
        const newResult = await pi.exec(
          "jj",
          ["new", "-m", pendingChangeDescription],
          {
            cwd: ctx.cwd,
          },
        );
        notifyMutation(pi, "jj new", newResult.stderr || newResult.stdout);
      }
    } catch {
      // Silently fail if jj commands fail
    } finally {
      pendingChangeDescription = null;
    }
  });

  // Hook into /fork to create a jj workspace
  pi.on("session_fork", async (event, ctx) => {
    try {
      const parentChangeId = await getCurrentChangeId(pi, ctx.cwd);
      const workspaceName = generateWorkspaceName();
      const description = `Fork from ${event.previousSessionFile || "session"}`;
      const workspacePath = await createWorkspace(
        pi,
        workspaceName,
        description,
        parentChangeId,
      );

      const newSessionFile = ctx.sessionManager.getSessionFile();
      if (!newSessionFile) throw new Error("No session file available");

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

  // Commands
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    handler: async (args, ctx) => {
      const description = args.trim();
      if (!description) {
        if (ctx.hasUI)
          ctx.ui.notify("Usage: /workspace <task description>", "warning");
        return;
      }

      try {
        const parentChangeId = await getCurrentChangeId(pi);
        const workspaceName = generateWorkspaceName();
        const workspacePath = await createWorkspace(
          pi,
          workspaceName,
          description,
          parentChangeId,
        );

        const currentSessionFile = ctx.sessionManager.getSessionFile();
        if (!currentSessionFile) throw new Error("No session file available");

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
        if (ctx.hasUI)
          ctx.ui.notify(`Failed to create workspace: ${msg}`, "error");
      }
    },
  });

  pi.registerCommand("workspaces", {
    description: "Review ide workspaces and their diffs",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
        return createWorkspacesComponent(pi, tui, theme, keybindings, done);
      }, FULL_OVERLAY_OPTIONS);
    },
  });

  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openSymbolsPicker(pi, ctx, args.trim());
    },
  });

  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openFilesPicker(pi, ctx, args.trim());
    },
  });

  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openBookmarksBrowser(pi, ctx);
    },
  });

  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openOpLogBrowser(pi, ctx);
    },
  });

  pi.registerCommand("skills", {
    description: "Browse local skills and install from skills.sh",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openSkillBrowser(pi, ctx, args.trim());
    },
  });

  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openPullRequestsBrowser(pi, ctx);
    },
  });

  pi.registerCommand("linear", {
    description: "Browse Linear issues with markdown preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openLinearIssuesBrowser(pi, ctx);
    },
  });

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
        if (ctx.hasUI)
          ctx.ui.notify("Linear API key saved successfully", "info");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) ctx.ui.notify(`Failed to save API key: ${msg}`, "error");
      }
    },
  });

  // Shortcuts - single source of truth for both registration and command palette
  interface ShortcutDef {
    key: KeyId;
    description: string;
    handler: (ctx: ExtensionContext) => Promise<void>;
  }

  const shortcuts: ShortcutDef[] = [
    {
      key: Key.ctrl("t"),
      description: "Open symbol picker",
      handler: async (ctx) => openSymbolsPicker(pi, ctx, ""),
    },
    {
      key: Key.ctrl("p"),
      description: "Open file picker",
      handler: async (ctx) => openFilesPicker(pi, ctx, ""),
    },
    {
      key: Key.ctrl("b"),
      description: "Open bookmarks browser",
      handler: async (ctx) => openBookmarksBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("j"),
      description: "Open workspaces review",
      handler: async (ctx) =>
        ctx.ui.custom<void>(
          (tui, theme, keybindings, done) =>
            createWorkspacesComponent(pi, tui, theme, keybindings, done),
          FULL_OVERLAY_OPTIONS,
        ),
    },
    {
      key: Key.ctrl("k"),
      description: "Open changes browser",
      handler: async (ctx) => openChangesBrowser(pi, ctx, promptAndSetBookmark),
    },
    {
      key: Key.ctrl("o"),
      description: "Open operation log browser",
      handler: async (ctx) => openOpLogBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("s"),
      description: "Open skill browser",
      handler: async (ctx) => openSkillBrowser(pi, ctx, ""),
    },
    {
      key: Key.ctrl("g"),
      description: "Open pull requests browser",
      handler: async (ctx) => openPullRequestsBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("u"),
      description: "Open Linear issues browser",
      handler: async (ctx) => openLinearIssuesBrowser(pi, ctx),
    },
  ];

  // Register all shortcuts
  for (const shortcut of shortcuts) {
    pi.registerShortcut(shortcut.key, {
      description: shortcut.description,
      handler: async (ctx) => {
        if (!ctx.hasUI) return;
        await shortcut.handler(ctx);
      },
    });
  }

  // Build command palette list from shortcuts
  let currentCtx: ExtensionContext | null = null;

  const registeredShortcuts: RegisteredShortcut[] = shortcuts.map((s) => ({
    shortcut: s.key,
    description: s.description,
    execute: () => {
      if (currentCtx) void s.handler(currentCtx);
    },
  }));

  // Add command palette itself (self-referential, no-op execute)
  registeredShortcuts.push({
    shortcut: Key.ctrlShift("p"),
    description: "Open command palette",
    execute: () => {},
  });

  pi.registerCommand("commands", {
    description: "Open command palette to search and execute commands",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      currentCtx = ctx;
      await openCommandPalette(pi, ctx, registeredShortcuts);
      currentCtx = null;
    },
  });

  pi.registerShortcut(Key.ctrlShift("p"), {
    description: "Open command palette",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      currentCtx = ctx;
      await openCommandPalette(pi, ctx, registeredShortcuts);
      currentCtx = null;
    },
  });

  // Register all tools
  registerAllTools(pi);
}
