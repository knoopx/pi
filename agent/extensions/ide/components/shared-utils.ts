import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import type { MarkdownTheme } from "@mariozechner/pi-tui";
import { pad, buildHelpText, ensureWidth, truncateAnsi } from "./utils";

/** Create a markdown theme from the pi theme */
export function createMarkdownTheme(theme: Theme): MarkdownTheme {
  return {
    heading: (text) => theme.fg("mdHeading", theme.bold(text)),
    link: (text) => theme.fg("mdLink", text),
    linkUrl: (text) => theme.fg("mdLinkUrl", text),
    code: (text) => theme.fg("mdCode", text),
    codeBlock: (text) => theme.fg("mdCodeBlock", text),
    codeBlockBorder: (text) => theme.fg("mdCodeBlockBorder", text),
    quote: (text) => theme.fg("mdQuote", text),
    quoteBorder: (text) => theme.fg("mdQuoteBorder", text),
    hr: (text) => theme.fg("mdHr", text),
    listBullet: (text) => theme.fg("mdListBullet", text),
    bold: (text) => theme.bold(text),
    italic: (text) => theme.italic(text),
    strikethrough: (text) => theme.strikethrough(text),
    underline: (text) => theme.underline(text),
  };
}

/** Format a date string as relative time (e.g. "5m ago", "2h ago", "3d ago") */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** Interface for Linear issue */
export interface LinearIssue {
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  url: string;
  state: { name: string; type: string } | null;
  team: { key: string; name: string } | null;
  assignee: { name: string; displayName: string | null } | null;
}

/** Interface for Linear issue with extended fields */
export interface LinearIssueExtended extends LinearIssue {
  labels: { nodes: { name: string }[] };
  comments: { nodes: { body: string; user: { name: string } | null }[] };
}

const PRIORITY_LABELS = ["none", "urgent", "high", "normal", "low"] as const;

/** Extract common issue fields for display */
function extractIssueFields(issue: LinearIssue): {
  priority: string;
  state: string;
  team: string;
  assignee: string;
} {
  return {
    priority: PRIORITY_LABELS[issue.priority] ?? "none",
    state: issue.state?.name ?? "unknown",
    team: issue.team?.key ?? "-",
    assignee:
      issue.assignee?.displayName ?? issue.assignee?.name ?? "unassigned",
  };
}

/** Format a Linear issue for agent display */
export function formatLinearIssueForAgent(issue: LinearIssue): string {
  const { priority, state, team, assignee } = extractIssueFields(issue);
  return `${issue.identifier}: ${issue.title}\n  State: ${state} | Priority: ${priority} | Team: ${team} | Assignee: ${assignee}\n  URL: ${issue.url}`;
}

/** Format a Linear issue for agent display with additional fields */
export function formatLinearIssueForAgentExtended(
  issue: LinearIssueExtended,
): string {
  const { priority, state, team, assignee } = extractIssueFields(issue);
  const labels = issue.labels.nodes.map((l) => l.name).join(", ") || "none";

  let text = `**${issue.identifier}: ${issue.title}**\n`;
  text += `State: ${state} | Priority: ${priority} | Team: ${team} | Assignee: ${assignee}\n`;
  text += `URL: ${issue.url}\n`;
  text += `Labels: ${labels}`;

  if (issue.description) {
    text += `\n\nDescription:\n${issue.description}`;
  }

  const comments = issue.comments.nodes
    .map(
      (c) =>
        `  - ${c.user?.name ?? "Unknown"}: ${c.body.slice(0, 100)}${c.body.length > 100 ? "..." : ""}`,
    )
    .join("\n");

  if (comments) {
    text += `\n\nRecent comments:\n${comments}`;
  }

  return text;
}

/** Box drawing characters for bordered UI components */
export const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeLeft: "├",
  teeRight: "┤",
  teeDown: "┬",
  teeUp: "┴",
  cross: "┼",
} as const;

/** Create a bordered line with vertical bars on each side */
export function borderedLine(
  theme: Theme,
  content: string,
  innerWidth: number,
): string {
  const inner = ensureWidth(content, innerWidth);
  return `${theme.fg("dim", BOX.vertical)}${inner}${theme.fg("dim", BOX.vertical)}`;
}

/** Create a top border with centered title */
export function topBorderWithTitle(
  theme: Theme,
  title: string,
  innerWidth: number,
): string {
  const titleLen = title.length;
  const leftPad = Math.floor((innerWidth - titleLen) / 2);
  const rightPad = innerWidth - titleLen - leftPad;
  return (
    theme.fg("dim", BOX.topLeft + BOX.horizontal.repeat(leftPad)) +
    theme.fg("accent", theme.bold(title)) +
    theme.fg("dim", BOX.horizontal.repeat(rightPad) + BOX.topRight)
  );
}

/** Create a horizontal separator with tee connectors */
export function horizontalSeparator(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.teeLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.teeRight)
  );
}

/** Create a bottom border */
export function bottomBorder(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.bottomLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.bottomRight)
  );
}

/** Render form field content with focus styling */
export function renderFormFieldContent(
  theme: Theme,
  labelText: string,
  valueText: string,
  isFocused: boolean,
  innerWidth: number,
): string {
  const content = `${theme.fg("dim", labelText)} ${valueText}`;
  if (isFocused) {
    return theme.bg("selectedBg", ensureWidth(content, innerWidth));
  }
  return content;
}

/** Render form footer with help text and bottom border */
export function renderFormFooter(
  theme: Theme,
  innerWidth: number,
  ...helpParts: string[]
): string[] {
  const helpText = buildHelpText(...helpParts);
  return [
    borderedLine(theme, ` ${theme.fg("dim", helpText)}`, innerWidth),
    bottomBorder(theme, innerWidth),
  ];
}

/**
 * Common TUI interface for components
 */
export interface ComponentTui {
  terminal: { rows: number };
  requestRender: () => void;
}

/**
 * Base component parameters shared across overlay components
 */
export interface BaseComponentParams {
  pi: ExtensionAPI;
  tui: ComponentTui;
  theme: Theme;
  keybindings: KeybindingsManager;
  cwd: string;
}

/**
 * Generic cache interface for component state
 */
export interface ComponentCache<T = unknown> {
  files: T[];
  diffs: Map<string, string[]>;
}

/** Creates a standardized cache instance */
export function createComponentCache<T = unknown>(
  files: T[] = [],
): ComponentCache<T> {
  return {
    files,
    diffs: new Map(),
  };
}

/** Creates standardized selection state */
export function createSelectionState(): {
  selectedIndex: number;
  fileIndex: number;
  diffScroll: number;
  focus: "left" | "right";
} {
  return {
    selectedIndex: 0,
    fileIndex: 0,
    diffScroll: 0,
    focus: "left",
  };
}

/** Creates standardized loading state */
export function createLoadingState(): {
  loading: boolean;
  cachedLines: string[];
  cachedWidth: number;
} {
  return {
    loading: true,
    cachedLines: [],
    cachedWidth: 0,
  };
}

/** Generic navigation handler for list components */
export function createNavigationHandler<T>(
  items: T[],
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  onSelectionChange: (item: T | null) => void,
  invalidate: () => void,
  requestRender: () => void,
): (direction: "up" | "down") => void {
  return (direction: "up" | "down") => {
    const maxIndex = items.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, state.selectedIndex - 1)
        : Math.min(maxIndex, state.selectedIndex + 1);

    if (newIndex !== state.selectedIndex) {
      state.selectedIndex = newIndex;
      onSelectionChange(items[newIndex] || null);
      invalidate();
      requestRender();
    }
  };
}

/** Generic file navigation handler */
export function createFileNavigationHandler<T extends { path?: string }>(
  files: T[],
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  onFileChange: (file: T | null) => void,
  invalidate: () => void,
  requestRender: () => void,
): (direction: "up" | "down") => void {
  return (direction: "up" | "down") => {
    const maxIndex = files.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, state.fileIndex - 1)
        : Math.min(maxIndex, state.fileIndex + 1);

    if (newIndex !== state.fileIndex) {
      state.fileIndex = newIndex;
      onFileChange(files[newIndex] || null);
      invalidate();
      requestRender();
    }
  };
}

/** Generic diff scrolling handler */
export function createDiffScrollHandler(
  diffContent: string[],
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  terminalRows: number,
  _cachedWidth: number,
  invalidate: () => void,
  requestRender: () => void,
): (direction: "up" | "down") => void {
  return (direction: "up" | "down") => {
    const maxScroll = Math.max(0, diffContent.length - terminalRows + 5);
    const newScroll =
      direction === "up"
        ? Math.max(0, state.diffScroll - 1)
        : Math.min(maxScroll, state.diffScroll + 1);
    state.diffScroll = newScroll;
    invalidate();
    requestRender();
  };
}

/** Generic focus switching handler */
export function createFocusHandler(
  state: {
    selectedIndex: number;
    fileIndex: number;
    diffScroll: number;
    focus: "left" | "right";
  },
  invalidate: () => void,
  requestRender: () => void,
): () => void {
  return () => {
    state.focus = state.focus === "left" ? "right" : "left";
    invalidate();
    requestRender();
  };
}

/** Generic cache invalidation */
export function invalidateCache(state: {
  loading: boolean;
  cachedLines: string[];
  cachedWidth: number;
}): void {
  state.cachedLines = [];
  state.cachedWidth = 0;
}

/** Generic error message formatter */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/** Generic loading row renderer */
export function renderLoadingRow(
  width: number,
  message = "Loading...",
): string {
  return pad(` ${message}`, width);
}

/** Generic empty state renderer */
export function renderEmptyState(
  width: number,
  message: string,
  hint?: string,
): string[] {
  const rows = [pad(` ${message}`, width)];
  if (hint) {
    rows.push(pad(` ${hint}`, width));
  }
  return rows;
}

/** Wrap rows in a single-panel border frame */
export function renderFramedRows(
  theme: Theme,
  rows: string[],
  width: number,
  borderColor: "border" | "borderAccent" = "borderAccent",
): string[] {
  const innerWidth = Math.max(1, width - 2);

  const top =
    theme.fg(borderColor, "┌") +
    theme.fg(borderColor, "─".repeat(innerWidth)) +
    theme.fg(borderColor, "┐");

  const bottom =
    theme.fg(borderColor, "└") +
    theme.fg(borderColor, "─".repeat(innerWidth)) +
    theme.fg(borderColor, "┘");

  const content = rows.map(
    (row) =>
      theme.fg(borderColor, "│") +
      pad(row, innerWidth) +
      theme.fg(borderColor, "│"),
  );

  return [top, ...content, bottom];
}

/** Generic row renderer with selection styling */
export function renderSelectableRow(
  text: string,
  width: number,
  isSelected: boolean,
  theme: {
    fg: (color: string, text: string) => string;
    bold: (text: string) => string;
  },
): string {
  const truncated = truncateAnsi(text, width);
  const padded = ensureWidth(truncated, width);
  return isSelected ? theme.fg("accent", theme.bold(padded)) : padded;
}

/** Generic help text builder for navigation */
export function buildNavigationHelp(
  focus: "left" | "right",
  leftActions: string[] = [],
  rightActions: string[] = [],
): string {
  const baseHelp = ["tab ↑↓ nav"];

  if (focus === "left") {
    return buildHelpText(...baseHelp, ...leftActions);
  } else {
    return buildHelpText(...baseHelp, ...rightActions);
  }
}

/** Check if render cache is valid */
export function isRenderCacheValid(
  width: number,
  cachedWidth: number,
  cachedLines: string[],
): boolean {
  return cachedWidth === width && cachedLines.length > 0;
}

/** Base configuration for split panel dimensions calculation */
export function createBaseDimensionsConfig(
  leftFocus: boolean,
  rightFocus = false,
): {
  leftTitle: string;
  rightTitle: string;
  helpText: string;
  leftFocus: boolean;
  rightFocus: boolean;
} {
  return {
    leftTitle: "",
    rightTitle: "",
    helpText: "",
    leftFocus,
    rightFocus,
  };
}

/** Status message state for notifications within overlays */
export interface StatusMessageState {
  message: { text: string; type: "info" | "error" } | null;
  timeout: ReturnType<typeof setTimeout> | null;
}

/** Creates a status message handler for overlay components */
export function createStatusNotifier(
  state: StatusMessageState,
  onUpdate: () => void,
  duration = 3000,
): (message: string, type?: "info" | "error") => void {
  return (message: string, type: "info" | "error" = "info") => {
    if (state.timeout) clearTimeout(state.timeout);
    state.message = { text: message, type };
    onUpdate();
    state.timeout = setTimeout(() => {
      state.message = null;
      onUpdate();
    }, duration);
  };
}

/** Format help text with optional status message override */
export function formatHelpWithStatus(
  theme: Theme,
  statusMessage: { text: string; type: "info" | "error" } | null,
  helpText: string,
): string {
  if (statusMessage) {
    return theme.fg(
      statusMessage.type === "error" ? "error" : "accent",
      statusMessage.text,
    );
  }
  return helpText;
}
