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
import { setBookmarkToChange, getVcsLabel, createNewChange } from "./jj";

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

const promptAndSetBookmark = (
  pi: ExtensionAPI,
): ((ctx: ExtensionContext, changeId: string) => Promise<string | null>) => {
  return async (
    ctx: ExtensionContext,
    changeId: string,
  ): Promise<string | null> => {
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
  };
};

// --- Footer state and helpers ---

let _lastContext: ExtensionContext | null = null;
let _currentVcsLabel: string | null = null;
let _currentUsage: UsageSnapshot | undefined;
let _requestFooterRender: (() => void) | undefined;

function calculateTotalCost(sessionManager: {
  getEntries(): {
    type: string;
    message?: { role: string; usage?: { cost?: { total: number } } };
  }[];
}): number {
  let totalCost = 0;
  for (const entry of sessionManager.getEntries()) {
    if (entry.type === "message" && entry.message?.role === "assistant")
      totalCost += entry.message.usage?.cost?.total ?? 0;
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
  pi: ExtensionAPI,
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

function registerFooter(ctx: ExtensionContext, pi: ExtensionAPI): void {
  if (!ctx.hasUI) return;
  ctx.ui.setFooter(createFooterHandler(ctx, pi));
}

function createFooterHandler(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): (
  tui: { requestRender: () => void },
  theme: Theme,
  footerData: { onBranchChange: (cb: () => void) => () => void },
) => {
  dispose(): void;
  invalidate(): void;
  render(width: number): string[];
} {
  return (tui, theme, footerData) => {
    _requestFooterRender = () => {
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
        if (_requestFooterRender) _requestFooterRender = undefined;
      },
      invalidate(): void {
        // No cleanup needed for invalidate
      },
      render(width: number): string[] {
        const totalCost = calculateTotalCost(ctx.sessionManager);
        const costText = formatCostText(totalCost, ctx);
        const contextInfo = formatContextInfo(ctx, theme);
        const modelInfo = formatModelInfo(ctx, _currentUsage, pi, theme);
        const leftText = formatLeftText(ctx, _currentVcsLabel, theme);
        const centerText = modelInfo.quotaText
          ? `${modelInfo.modelText} ${modelInfo.quotaText}`
          : modelInfo.modelText;
        const rightText = `${theme.fg("dim", costText)} ${contextInfo.text}`;
        const line = padLine(leftText, centerText, rightText, width);
        return [truncateToWidth(line, width)];
      },
    };
  };
}

async function refreshFooterData(
  pi: ExtensionAPI,
  getVcsLabelFn: typeof getVcsLabel,
): Promise<void> {
  if (!_lastContext) return;

  try {
    const [vcsLabel, usage] = await Promise.all([
      getVcsLabelFn(pi, _lastContext!.cwd),
      _lastContext.model ? detectAndFetchUsage(_lastContext.model) : undefined,
    ]);
    _currentVcsLabel = vcsLabel;
    _currentUsage = usage;
    _requestFooterRender?.();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    _requestFooterRender?.();
    if (msg !== "undefined") return;
  }
}

function handleSessionStart(pi: ExtensionAPI, ctx: ExtensionContext): void {
  _lastContext = ctx;
  registerFooter(ctx, pi);
  void createNewChange(pi, ctx.cwd)
    .then((changeResult) => {
      if (!changeResult.success && ctx.hasUI)
        ctx.ui.notify(
          `Failed to create jj change: ${changeResult.error}`,
          "warning",
        );
      else if (changeResult.created && ctx.hasUI)
        ctx.ui.notify(
          `New jj change: ${changeResult.changeId ?? "(no id)"}`,
          "info",
        );
    })
    .catch(() => {});
}

function handleModelSelect(pi: ExtensionAPI, ctx: ExtensionContext): void {
  _lastContext = ctx;
  registerFooter(ctx, pi);
  void refreshFooterData(pi, getVcsLabel);
}

function handleSessionFork(
  pi: ExtensionAPI,
  _event: { entryId: string },
  ctx: ExtensionContext,
): void {
  const workspaceName = generateWorkspaceName();
  const description = "Forked session";

  getCurrentChangeId(pi, ctx.cwd)
    .then(async (parentChangeId) => {
      if (!parentChangeId) return;
      return createWorkspace(pi, workspaceName, description, parentChangeId);
    })
    .then((workspacePath) => {
      if (!workspacePath) return;
      const newSessionFile = ctx.sessionManager.getSessionFile();
      if (!newSessionFile) return;
      return spawnWorkspaceAgent(
        pi,
        ctx,
        workspacePath,
        workspaceName,
        description,
        newSessionFile,
      );
    })
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (ctx.hasUI)
        ctx.ui.notify(`Failed to create workspace on fork: ${msg}`, "error");
    });
}

function handleWorkspaceCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  const description = args.trim();
  if (description.length === 0) {
    if (ctx.hasUI)
      ctx.ui.notify("Usage: /workspace <task description>", "warning");
    return;
  }

  void getCurrentChangeId(pi)
    .then((parentChangeId) =>
      createWorkspace(pi, generateWorkspaceName(), description, parentChangeId)
        .then((workspacePath) => {
          const currentSessionFile = ctx.sessionManager.getSessionFile();
          if (!currentSessionFile) return;
          return spawnWorkspaceAgent(
            pi,
            ctx,
            workspacePath,
            generateWorkspaceName(),
            description,
            currentSessionFile,
          );
        })
        .catch((error) => {
          const msg = error instanceof Error ? error.message : String(error);
          if (ctx.hasUI)
            ctx.ui.notify(`Failed to create workspace: ${msg}`, "error");
        }),
    )
    .catch(() => {});
}

function handleWorkspacesCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  ctx.ui.custom(
    (tui, theme, keybindings, done) =>
      createWorkspacesComponent(pi, tui, theme, keybindings, done),
    FULL_OVERLAY_OPTIONS,
  );
}

function handleSymbolsCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  openSymbolsPicker(pi, ctx, args);
}

function handleFilesCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  openFilesPicker(pi, ctx, args);
}

function handleBookmarksCommand(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  openBookmarksBrowser(pi, ctx);
}

function handleChangeCommand(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  openChangesBrowser(pi, ctx, (cid) => promptAndSetBookmark(pi)(ctx, cid));
}

function handleOplogCommand(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  openOpLogBrowser(pi, ctx);
}

function handlePullRequestsCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  openPullRequestsBrowser(pi, ctx);
}

function handleTodosCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  openTodosBrowser(pi, ctx, args);
}

interface ShortcutDef {
  key: KeyId;
  description: string;
  handler: (ctx: ExtensionContext) => Promise<void>;
}

function registerShortcuts(pi: ExtensionAPI): void {
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
      handler: async (ctx) => {
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
      handler: async (ctx) =>
        openChangesBrowser(pi, ctx, (cid) =>
          promptAndSetBookmark(pi)(ctx, cid),
        ),
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

  for (const shortcut of shortcuts) {
    pi.registerShortcut(shortcut.key, {
      description: shortcut.description,
      async handler(ctx) {
        if (!ctx.hasUI) return;
        await shortcut.handler(ctx);
      },
    });
  }
}

function registerCommands(pi: ExtensionAPI): void {
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    async handler(args, ctx) {
      handleWorkspaceCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("workspaces", {
    description: "Review ide workspaces and their diffs",
    async handler(_args, ctx) {
      handleWorkspacesCommand(pi, ctx);
    },
  });

  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    async handler(args, ctx) {
      handleSymbolsCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    async handler(args, ctx) {
      handleFilesCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    async handler(_args, ctx) {
      handleBookmarksCommand(pi, ctx);
    },
  });

  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    async handler(_args, ctx) {
      handleChangeCommand(pi, ctx);
    },
  });

  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    async handler(_args, ctx) {
      handleOplogCommand(pi, ctx);
    },
  });

  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    async handler(_args, ctx) {
      handlePullRequestsCommand(pi, ctx);
    },
  });

  pi.registerCommand("todos", {
    description: "Browse TODO/FIXME/HACK/XXX comments with source preview",
    async handler(args, ctx) {
      handleTodosCommand(pi, args, ctx);
    },
  });
}

export default async function ideExtension(pi: ExtensionAPI): Promise<void> {
  // Install periodic footer refresh
  setInterval(() => void refreshFooterData(pi, getVcsLabel), 5 * 60 * 1000);

  pi.on("session_start", (_event, ctx) => handleSessionStart(pi, ctx));
  pi.on("model_select", (_event, ctx) => handleModelSelect(pi, ctx));
  pi.on("session_before_fork", (_event, ctx) =>
    handleSessionFork(pi, _event, ctx),
  );

  registerShortcuts(pi);
  registerCommands(pi);
  await registerAllTools(pi);
}
