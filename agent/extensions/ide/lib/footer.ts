import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

import { detectAndFetchUsage, type UsageSnapshot } from "./usage/shared";
import { getVcsLabel } from "../jj/changes";


function calculateTotalCost(
  sessionManager: ExtensionContext["sessionManager"],
): number {
  return sessionManager.getEntries().reduce((sum, entry) => {
    const cost =
      entry.type === "message" && entry.message?.role === "assistant"
        ? (entry.message.usage?.cost?.total ?? 0)
        : 0;
    return sum + cost;
  }, 0);
}


function formatCostText(totalCost: number, ctx: ExtensionContext): string {
  const usingSubscription = ctx.model
    ? ctx.modelRegistry.isUsingOAuth(ctx.model)
    : false;
  return `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`;
}


function buildContextText(
  percent: number | null,
  contextWindow: number,
): string {
  const windowStr = formatTokenCount(contextWindow);
  if (percent === null) return `?/${windowStr} (auto)`;
  return `${percent.toFixed(1)}%/${windowStr} (auto)`;
}


function colorizePercent(
  text: string,
  percent: number | null,
  theme: Theme,
): string {
  if (percent === null) return text;
  if (percent > 90) return theme.fg("error", text);
  if (percent > 70) return theme.fg("warning", text);
  return text;
}


function formatCompactQuota(
  usage: UsageSnapshot | undefined,
  theme: Theme,
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


interface FooterState {
  ctx: ExtensionContext;
  vcsLabel: string | null;
  usage: UsageSnapshot | undefined;
}


function buildCenterText(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  usage: UsageSnapshot | undefined,
  theme: Theme,
): string {
  const thinkingLevel = pi.getThinkingLevel();
  const modelText = ctx.model
    ? `${ctx.model.id} • ${thinkingLevel}`
    : "no-model";
  const quotaText = formatCompactQuota(usage, theme);
  return quotaText ? `${modelText} ${quotaText}` : modelText;
}


function buildRightText(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  theme: Theme,
): string {
  const totalCost = calculateTotalCost(ctx.sessionManager);
  const costText = formatCostText(totalCost, ctx);

  const usage = ctx.getContextUsage();
  const window = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
  const percent = usage?.percent ?? null;
  const contextText = colorizePercent(
    buildContextText(percent, window),
    percent,
    theme,
  );

  return `${theme.fg("dim", costText)} ${contextText}`;
}


function buildLeftText(
  ctx: ExtensionContext,
  vcsLabel: string | null,
  theme: Theme,
): string {
  const parts: string[] = [theme.fg("accent", shortenHomePath(ctx.cwd))];
  if (vcsLabel) parts.push(theme.fg("dim", vcsLabel));
  const sessionName = ctx.sessionManager.getSessionName();
  if (sessionName) parts.push(theme.fg("dim", sessionName));
  return parts.join(" ");
}


function renderFooterLine(
  pi: ExtensionAPI,
  state: FooterState,
  theme: Theme,
  width: number,
): string {
  const left = buildLeftText(state.ctx, state.vcsLabel, theme);
  const center = buildCenterText(state.ctx, pi, state.usage, theme);
  const right = buildRightText(state.ctx, pi, theme);

  const line = padLine(left, center, right, width);
  return truncateToWidth(line, width);
}


export function createFooter(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): {
  
  register(): () => void;
  
  refresh(): Promise<void>;
} {
  const state: FooterState = {
    ctx,
    vcsLabel: null,
    usage: undefined,
  };

  let requestRender: (() => void) | undefined;

  async function refreshData(): Promise<void> {
    try {
      const [vcsLabel, usage] = await Promise.all([
        getVcsLabel(pi, state.ctx.cwd),
        state.ctx.model ? detectAndFetchUsage(state.ctx.model) : undefined,
      ]);
      state.vcsLabel = vcsLabel;
      state.usage = usage;
    } catch {
      // Best-effort refresh
    }
    requestRender?.();
  }

  function register(): () => void {
    if (!ctx.hasUI) return () => {};

    ctx.ui.setFooter((tui, theme, footerData) => {
      requestRender = () => {
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
          requestRender = undefined;
        },
        invalidate() {},
        render(width: number): string[] {
          return [renderFooterLine(pi, state, theme, width)];
        },
      };
    });

    return () => {};
  }

  return { register, refresh: refreshData };
}


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


function colorizeUsagePercent(
  theme: { fg(color: string, text: string): string },
  usedPercent: number,
): string {
  const percentText = `${usedPercent}%`;
  if (usedPercent > 90) return theme.fg("error", percentText);
  if (usedPercent > 70) return theme.fg("warning", percentText);
  return theme.fg("dim", percentText);
}


export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
