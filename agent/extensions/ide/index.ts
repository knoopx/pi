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
  Theme,
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
} from "./workspace";
import { createWorkspacesComponent } from "./components/workspaces";
import { createBookmarkPromptComponent } from "./components/bookmark-prompt";
import { registerAllTools } from "./tools/registration";
import { setBookmarkToChange, getVcsLabel } from "./jj";

// Overlay imports
import { openFilesPicker } from "./overlays/files";
import { openSymbolsPicker } from "./overlays/symbols";
import { openBookmarksBrowser } from "./overlays/bookmarks";
import { openOpLogBrowser } from "./overlays/oplog";
import { openPullRequestsBrowser } from "./overlays/pull-requests";
import { openChangesBrowser } from "./overlays/changes";
import { openTodosBrowser } from "./overlays/todos";
import { monitorWorkspace } from "./overlays/workspace-monitor";
import { FULL_OVERLAY_OPTIONS } from "./overlays/options";

/** Load IDE settings from settings.json */
async function loadIdeSettings(
  pi: ExtensionAPI,
  cwd: string,
): Promise<IdeSettings> {
  try {
    const settingsPath = `${cwd}/agent/settings.json`;
    const result = await pi.exec("cat", [settingsPath], { cwd: undefined });
    if (result.code !== 0) return {};
    const settings = JSON.parse(result.stdout) as Settings;
    return settings.ide ?? {};
  } catch {
    return {};
  }
}

/** Save IDE settings to settings.json */
async function saveIdeSettings(
  pi: ExtensionAPI,
  cwd: string,
  ideSettings: IdeSettings,
): Promise<void> {
  try {
    const settingsPath = `${cwd}/agent/settings.json`;
    const result = await pi.exec("cat", [settingsPath], { cwd: undefined });
    const existingSettings: Settings =
      result.code === 0 ? (JSON.parse(result.stdout) as Settings) : {};
    existingSettings.ide = { ...existingSettings.ide, ...ideSettings };
    const json = JSON.stringify(existingSettings, null, 2);
    await pi.exec("bash", ["-c", `echo '${json}' > '${settingsPath}'`], {
      cwd: undefined,
    });
  } catch {
    // Silently fail - setting won't persist but toggle still works in-memory
  }
}

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

interface IdeSettings {
  jujutsuChangeTracking?: boolean;
  readonlyTools?: string[];
}

interface Settings {
  ide?: IdeSettings;
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

export default async function ideExtension(pi: ExtensionAPI) {
  let lastContext: ExtensionContext | null = null;
  let currentVcsLabel: string | null = null;
  let currentUsage: UsageSnapshot | undefined;
  let isFooterRefreshInProgress = false;
  let requestFooterRender: (() => void) | undefined;
  let jujutsuChangeTrackingEnabled = true; // Default: enabled

  function calculateTotalCost(
    sessionManager: ExtensionContext["sessionManager"],
  ): number {
    let totalCost = 0;
    for (const entry of sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message.role === "assistant") {
        totalCost += entry.message.usage.cost.total;
      }
    }
    return totalCost;
  }

  function formatCostText(totalCost: number, ctx: ExtensionContext): string {
    const usingSubscription = ctx.model
      ? ctx.modelRegistry.isUsingOAuth(ctx.model)
      : false;
    return `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
  }

  function formatContextInfo(
    ctx: ExtensionContext,
    theme: Theme,
  ): { text: string } {
    const contextUsage = ctx.getContextUsage();
    const contextWindow =
      contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
    const contextPercent = contextUsage?.percent;
    const contextText =
      contextPercent === null || contextPercent === undefined
        ? `?/${formatTokenCount(contextWindow)} (auto)`
        : `${contextPercent.toFixed(1)}%/${formatTokenCount(contextWindow)} (auto)`;

    let coloredText = contextText;
    if (contextPercent !== null && contextPercent !== undefined) {
      if (contextPercent > 90) {
        coloredText = theme.fg("error", contextText);
      } else if (contextPercent > 70) {
        coloredText = theme.fg("warning", contextText);
      }
    }

    return { text: coloredText };
  }

  function formatModelInfo(
    ctx: ExtensionContext,
    usage: UsageSnapshot | undefined,
    theme: Theme,
  ): { modelText: string; quotaText: string } {
    const thinkingLevel = pi.getThinkingLevel();
    const quotaText = formatCompactQuota(usage, theme);
    const modelText = ctx.model
      ? `${ctx.model.id} • ${thinkingLevel}`
      : "no-model";
    return { modelText, quotaText };
  }

  function formatLeftText(
    ctx: ExtensionContext,
    vcsLabel: string | null,
    theme: Theme,
  ): string {
    const sessionName = ctx.sessionManager.getSessionName();
    const cwd = shortenHomePath(ctx.cwd);
    return `${theme.fg("accent", cwd)}${vcsLabel ? ` ${theme.fg("dim", vcsLabel)}` : ""}${sessionName ? theme.fg("dim", ` ${sessionName}`) : ""}`;
  }

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
          const totalCost = calculateTotalCost(ctx.sessionManager);
          const costText = formatCostText(totalCost, ctx);
          const contextInfo = formatContextInfo(ctx, theme);
          const modelInfo = formatModelInfo(ctx, currentUsage, theme);
          const leftText = formatLeftText(ctx, currentVcsLabel, theme);
          const centerText = modelInfo.quotaText
            ? `${modelInfo.modelText} ${modelInfo.quotaText}`
            : modelInfo.modelText;
          const rightText = `${theme.fg("dim", costText)} ${contextInfo.text}`;
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
    await refreshFooterData();
    // Load IDE settings
    const settings = await loadIdeSettings(pi, ctx.cwd);
    jujutsuChangeTrackingEnabled = settings.jujutsuChangeTracking ?? true;
    if (settings.readonlyTools && Array.isArray(settings.readonlyTools)) {
      readonlyTools = new Set(settings.readonlyTools);
    } else {
      readonlyTools = new Set(DEFAULT_READONLY_TOOLS);
    }
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
          maxHeight: 12,
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

  // JJ change guardrail: track if jj new has been called in current turn
  let jjNewCalled = false;

  // Reset on every user input
  pi.on("input", async (_event) => {
    jjNewCalled = false;
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
    "bun",
  ]);

  const DEFAULT_READONLY_TOOLS = new Set([
    "read",
    "ls",
    "grep",
    "find",
    "transcribe",
    "gh-search-repos",
    "gh-search-code",
    "gh-search-issues",
    "gh-search-prs",
    "gh-repo-contents",
    "gh-file-content",
    "gh-list-gists",
    "gh-get-gist",
    "gh-list-prs",
    "gh-view-pr",
    "gh-list-issues",
    "gh-view-issue",
    "gh-list-releases",
    "gh-view-release",
    "gh-list-workflows",
    "gh-list-runs",
    "gh-list-repo-files",
    "search-npm-packages",
    "npm-package-info",
    "npm-package-versions",
    "search-pypi-packages",
    "pypi-package-info",
    "search-nix-packages",
    "search-nix-options",
    "search-home-manager-options",
  ]);

  let readonlyTools: Set<string> = new Set(DEFAULT_READONLY_TOOLS);

  function isReadonlyToolCall(event: {
    toolName: string;
    input?: unknown;
  }): boolean {
    if (readonlyTools.has(event.toolName)) return true;

    if (event.toolName === "bash") {
      const input = event.input as { command?: string } | undefined;
      const command = input?.command?.trim() ?? "";
      const firstWord = command.split(/\s+/)[0] ?? "";
      return READONLY_BASH_COMMANDS.has(firstWord);
    }
    return false;
  }

  function isJjNewCommand(command: string): boolean {
    const trimmed = command.trim();
    // Match: jj new, jj new -m "...", jj new --message "..."
    // Also handle chains like: cd ... && jj new ... or ... && jj new ...
    return /(?:^|&&)\s*jj\s+new\b/.test(trimmed);
  }

  function getConventionalCommitGuidance(): string {
    return `THE RULE:

Before using edit or write → run: jj new -m 'type(scope): description'

Types: feat, fix, refactor, docs, test, chore, perf, build, ci, style

Examples:
- jj new -m 'fix(auth): resolve login issue'
- jj new -m 'feat(api): add user endpoint'

Readonly tools (read, ls, grep, find) → no jj new needed.
edit/write → BLOCKED until jj new is run first.`;
  }

  pi.on("tool_call", async (event, _ctx) => {
    // Skip guardrail if change tracking is disabled
    if (!jujutsuChangeTrackingEnabled) {
      return undefined; // Allow all tools
    }

    // Allow jj new commands and mark that it was called
    if (event.toolName === "bash") {
      const input = event.input as { command?: string } | undefined;
      const command = input?.command?.trim() ?? "";
      if (isJjNewCommand(command)) {
        jjNewCalled = true;
        return undefined; // Allow
      }
    }

    // Allow readonly tools without requiring jj new
    if (isReadonlyToolCall(event)) {
      return undefined; // Allow
    }

    // Block write/mutation tools if jj new hasn't been called
    if (!jjNewCalled) {
      return {
        block: true,
        reason: getConventionalCommitGuidance().trim(),
      };
    }

    return undefined; // Allow
  });

  // Hook into /fork to create a jj workspace
  pi.on("session_before_fork", async (event, ctx) => {
    try {
      const parentChangeId = await getCurrentChangeId(pi, ctx.cwd);
      const workspaceName = generateWorkspaceName();
      const description = "Forked session";
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

  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openPullRequestsBrowser(pi, ctx);
    },
  });

  pi.registerCommand("todos", {
    description: "Browse TODO/FIXME/HACK/XXX comments with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openTodosBrowser(pi, ctx, args.trim());
    },
  });

  pi.registerCommand("toggle-jujutsu-change-tracking", {
    description:
      "Toggle jujutsu change tracking (requires jj new before edits)",
    handler: async (_args, ctx) => {
      jujutsuChangeTrackingEnabled = !jujutsuChangeTrackingEnabled;
      const status = jujutsuChangeTrackingEnabled ? "enabled" : "disabled";
      if (ctx.hasUI) {
        ctx.ui.notify(
          `Jujutsu change tracking ${status}`,
          jujutsuChangeTrackingEnabled ? "info" : "warning",
        );
      }
      // Persist the setting
      await saveIdeSettings(pi, ctx.cwd, {
        jujutsuChangeTracking: jujutsuChangeTrackingEnabled,
      });
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
      key: Key.ctrl("g"),
      description: "Open pull requests browser",
      handler: async (ctx) => openPullRequestsBrowser(pi, ctx),
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

  // Register all tools
  await registerAllTools(pi);
}
