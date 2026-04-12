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

import { detectAndFetchUsage, type UsageSnapshot } from "./footer/usage/shared";
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

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function shortenHomePath(cwd: string): string {
  const home = process.env.HOME ?? undefined;
  if (home === undefined) return cwd;
  if (cwd === home) return "~";
  if (cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`;
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
  if (!usage || usage.error != null || usage.windows.length === 0) return "";

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
  if (totalContent >= width) return `${left} ${center} ${right}`;

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

  if (ctx.hasUI)
    ctx.ui.notify(`Spawned agent in workspace ${workspaceName}`, "info");

  void monitorWorkspace(pi, workspaceName, ctx);
}

export default async function ideExtension(pi: ExtensionAPI): Promise<void> {
  let lastContext: ExtensionContext | null = null;
  let currentVcsLabel: string | null = null;
  let currentUsage: UsageSnapshot | undefined;
  let requestFooterRender: (() => void) | undefined;

  function calculateTotalCost(
    sessionManager: ExtensionContext["sessionManager"],
  ): number {
    let totalCost = 0;
    for (const entry of sessionManager.getEntries()) {
      if (entry.type === "message" && entry.message.role === "assistant")
        totalCost += entry.message.usage.cost.total;
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
      if (contextPercent > 90) coloredText = theme.fg("error", contextText);
      else if (contextPercent > 70)
        coloredText = theme.fg("warning", contextText);
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
    return `${theme.fg("accent", cwd)}${vcsLabel != null && vcsLabel.length > 0 ? ` ${theme.fg("dim", vcsLabel)}` : ""}${sessionName != null && sessionName.length > 0 ? theme.fg("dim", ` ${sessionName}`) : ""}`;
  }

  function installGlobalFooter(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

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
          if (requestFooterRender) requestFooterRender = undefined;
        },
        invalidate(): void {
          // No cleanup needed for invalidate
        },
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
    if (!lastContext) return;

    try {
      const [vcsLabel, usage] = await Promise.all([
        getVcsLabel(pi, lastContext.cwd),
        lastContext.model ? detectAndFetchUsage(lastContext.model) : undefined,
      ]);
      currentVcsLabel = vcsLabel;
      currentUsage = usage;
      requestFooterRender?.();
    } catch {
      // Ignore errors during footer refresh
    }
  }

  // Event handlers
  pi.on("session_start", async (_event, ctx) => {
    lastContext = ctx;
    installGlobalFooter(ctx);
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

  // Bookmark prompt helper
  async function promptAndSetBookmark(
    ctx: ExtensionContext,
    changeId: string,
  ): Promise<string | null> {
    if (!ctx.hasUI) return null;

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

    if (bookmarkName === null) return null;

    await setBookmarkToChange(pi, ctx.cwd, bookmarkName, changeId);
    return bookmarkName;
  }

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
      if (!newSessionFile) return;

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
      if (ctx.hasUI)
        ctx.ui.notify(`Failed to create workspace on fork: ${msg}`, "error");
    }
  });

  // Commands
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    async handler(args, ctx): Promise<void> {
      const description = args.trim();
      if (description.length === 0) {
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
        if (!currentSessionFile) return;

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
    async handler(_args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await ctx.ui.custom((tui, theme, keybindings, done) => {
        return createWorkspacesComponent(pi, tui, theme, keybindings, done);
      }, FULL_OVERLAY_OPTIONS);
    },
  });

  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    async handler(args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openSymbolsPicker(pi, ctx, args);
    },
  });

  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    async handler(args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openFilesPicker(pi, ctx, args);
    },
  });

  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    async handler(_args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openBookmarksBrowser(pi, ctx);
    },
  });

  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    async handler(_args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    async handler(_args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openOpLogBrowser(pi, ctx);
    },
  });

  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    async handler(_args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openPullRequestsBrowser(pi, ctx);
    },
  });

  pi.registerCommand("todos", {
    description: "Browse TODO/FIXME/HACK/XXX comments with source preview",
    async handler(args, ctx): Promise<void> {
      if (!ctx.hasUI) return;
      await openTodosBrowser(pi, ctx, args);
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
      handler: async (ctx): Promise<void> => openSymbolsPicker(pi, ctx, ""),
    },
    {
      key: Key.ctrl("p"),
      description: "Open file picker",
      handler: async (ctx): Promise<void> => openFilesPicker(pi, ctx, ""),
    },
    {
      key: Key.ctrl("b"),
      description: "Open bookmarks browser",
      handler: async (ctx): Promise<void> => openBookmarksBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("j"),
      description: "Open workspaces review",
      handler: async (ctx): Promise<void> => {
        await ctx.ui.custom(
          (tui, theme, keybindings, done) =>
            createWorkspacesComponent(pi, tui, theme, keybindings, done),
          FULL_OVERLAY_OPTIONS,
        );
      },
    },
    {
      key: Key.ctrl("k"),
      description: "Open changes browser",
      handler: async (ctx): Promise<void> =>
        openChangesBrowser(pi, ctx, promptAndSetBookmark),
    },
    {
      key: Key.ctrl("o"),
      description: "Open operation log browser",
      handler: async (ctx): Promise<void> => openOpLogBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("g"),
      description: "Open pull requests browser",
      handler: async (ctx): Promise<void> => openPullRequestsBrowser(pi, ctx),
    },
  ];

  // Register all shortcuts
  for (const shortcut of shortcuts) {
    pi.registerShortcut(shortcut.key, {
      description: shortcut.description,
      async handler(ctx): Promise<void> {
        if (!ctx.hasUI) return;
        await shortcut.handler(ctx);
      },
    });
  }

  // Register all tools
  await registerAllTools(pi);
}
