import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Key, Markdown } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerComponent,
  type ListPickerAction,
} from "../../lib/list-picker";
import { truncateAnsi } from "../../lib/text-utils";
import { createMarkdownTheme } from "../../lib/markdown-theme";
import { formatRelativeTime } from "../../lib/formatters";
import type { PullRequest } from "./types";
import { fetchPullRequests } from "./data-fetching";
import { executeGhCommand, openPrInBrowser } from "./actions";
import {
  getPrIcon,
  getReviewIcon,
  resolvePrStateColor,
  buildPrStats,
  buildPrFixedParts,
  truncateTitle,
  formatReviewIcon,
} from "./helpers";

interface PullRequestsComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: PullRequest | null) => void;
  cwd: string;
  onInsert?: (text: string) => void;
}

const PR_STATES: ("open" | "closed" | "merged" | "all")[] = [
  "open",
  "closed",
  "merged",
  "all",
];

function formatPrForInsert(item: PullRequest): string {
  return [
    `#${item.number}: ${item.title}`,
    `State: ${item.state}${item.isDraft ? " (draft)" : ""}`,
    `Author: ${item.author}`,
    `Branch: ${item.headRefName} → ${item.baseRefName}`,
    `+${item.additions} -${item.deletions}`,
    item.body?.trim() || "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrActions(options: {
  pi: ExtensionAPI;
  cwd: string;
  done: (result: PullRequest | null) => void;
  onInsert?: (text: string) => void;
  notify: (msg: string, type?: "info" | "error") => void;
  currentStateRef: { value: "open" | "closed" | "merged" | "all" };
  pickerRef: { current: ListPickerComponent | null };
}): ListPickerAction<PullRequest>[] {
  const { pi, cwd, done, onInsert, notify, currentStateRef, pickerRef } =
    options;

  return [
    makeOpenPrAction(pi, cwd),
    makeCheckoutPrAction(pi, cwd, pickerRef),
    makeApprovePrAction(pi, cwd, pickerRef),
    makeMergePrAction(pi, cwd, pickerRef),
    makeCycleStateAction(notify, currentStateRef, pickerRef),
    makeInsertPrAction(onInsert, done),
  ];
}

function makeOpenPrAction(
  pi: ExtensionAPI,
  cwd: string,
): ListPickerAction<PullRequest> {
  return {
    key: Key.ctrl("o"),
    label: "open",
    async handler(item: PullRequest) {
      await openPrInBrowser(pi, item.number, cwd);
    },
  };
}

function makeCheckoutPrAction(
  pi: ExtensionAPI,
  cwd: string,
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<PullRequest> {
  return {
    key: Key.ctrl("c"),
    label: "checkout",
    async handler(item: PullRequest) {
      await executeGhCommand({
        pi,
        args: ["pr", "checkout", String(item.number)],
        cwd,
        successMsg: `Checked out PR #${item.number} to current workspace`,
        errorMsg: "Checkout failed",
        pickerRef: pickerRef.current,
      });
    },
  };
}

function makeApprovePrAction(
  pi: ExtensionAPI,
  cwd: string,
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<PullRequest> {
  return {
    key: Key.ctrl("a"),
    label: "approve",
    async handler(item: PullRequest) {
      await executeGhCommand({
        pi,
        args: ["pr", "review", String(item.number), "--approve"],
        cwd,
        successMsg: `Approved PR #${item.number} (review submitted)`,
        errorMsg: "Approve failed",
        pickerRef: pickerRef.current,
      });
    },
  };
}

function makeMergePrAction(
  pi: ExtensionAPI,
  cwd: string,
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<PullRequest> {
  return {
    key: Key.ctrl("m"),
    label: "merge",
    async handler(item: PullRequest) {
      await executeGhCommand({
        pi,
        args: [
          "pr",
          "merge",
          String(item.number),
          "--squash",
          "--delete-branch",
        ],
        cwd,
        successMsg: `Merged PR #${item.number} (squash + delete branch)`,
        errorMsg: "Merge failed",
        pickerRef: pickerRef.current,
      });
    },
  };
}

function makeCycleStateAction(
  notify: (msg: string, type?: "info" | "error") => void,
  currentStateRef: { value: "open" | "closed" | "merged" | "all" },
  pickerRef: { current: ListPickerComponent | null },
): ListPickerAction<PullRequest> {
  return {
    key: Key.ctrl("s"),
    label: "state",
    async handler() {
      const idx = PR_STATES.indexOf(currentStateRef.value);
      currentStateRef.value = PR_STATES[(idx + 1) % PR_STATES.length];
      notify(`Showing ${currentStateRef.value} PRs`, "info");
      await pickerRef.current?.reload();
    },
  };
}

function makeInsertPrAction(
  onInsert: ((text: string) => void) | undefined,
  done: (result: PullRequest | null) => void,
): ListPickerAction<PullRequest> {
  return {
    key: Key.ctrl("i"),
    label: "insert",
    handler(item: PullRequest) {
      if (onInsert) {
        onInsert(formatPrForInsert(item));
        done(null);
      }
    },
  };
}

function formatPrItem(item: PullRequest, width: number, theme: Theme): string {
  const stateColor = resolvePrStateColor(item.state, item.isDraft);
  const icon = getPrIcon(item.state, item.isDraft);
  const reviewIcon = getReviewIcon(item.reviewDecision);

  const fixedParts = buildPrFixedParts({
    icon,
    reviewIcon,
    number: item.number,
    headRefName: item.headRefName,
    author: item.author,
    additions: item.additions,
    deletions: item.deletions,
    updatedAt: item.updatedAt,
  });
  const titleWidth = Math.max(20, width - fixedParts.length - 4);
  const title = truncateTitle(item.title, titleWidth);

  return truncateAnsi(
    `${theme.fg(stateColor, icon)} ${theme.fg(stateColor, `#${item.number}`)} ${formatReviewIcon(reviewIcon, item.reviewDecision, theme)}${title} ${theme.fg("dim", item.headRefName)} ${theme.fg("dim", `@${item.author}`)} ${buildPrStats(theme, item.additions, item.deletions)} ${theme.fg("dim", formatRelativeTime(item.updatedAt))}`,
    width,
  );
}

function loadPrPreview(item: PullRequest, theme: Theme): string[] {
  const mdParts = [
    "| Field | Value |",
    "|-------|-------|",
    `| Author | @${item.author} |`,
    `| Branch | ${item.headRefName} → ${item.baseRefName} |`,
    `| State | ${item.state}${item.isDraft ? " (Draft)" : ""} |`,
    `| Review | ${item.reviewDecision ?? "Pending"} |`,
    `| Changes | +${item.additions} / -${item.deletions} |`,
    `| Updated | ${formatRelativeTime(item.updatedAt)} |`,
    "",
  ];
  if (item.body) mdParts.push(item.body);
  const md = new Markdown(mdParts.join("\n"), 0, 0, createMarkdownTheme(theme));
  return md.render(100);
}

function buildPrPickerOptions(options: {
  pi: ExtensionAPI;
  cwd: string;
  theme: Theme;
  currentStateRef: { value: "open" | "closed" | "merged" | "all" };
  actions: ListPickerAction<PullRequest>[];
}) {
  const { pi, cwd, theme, currentStateRef, actions } = options;
  return {
    title: "Pull Requests",
    previewTitle: (item: PullRequest) => `#${item.number}`,
    actions,
    loadItems: () => fetchPullRequests(pi, cwd, currentStateRef.value),
    filterItems: (items: PullRequest[], query: string): PullRequest[] =>
      items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.author.toLowerCase().includes(query) ||
          item.headRefName.toLowerCase().includes(query) ||
          String(item.number).includes(query),
      ),
    formatItem: (item: PullRequest, width: number, t: Theme): string =>
      formatPrItem(item, width, t),
    loadPreview: (item: PullRequest) =>
      Promise.resolve(loadPrPreview(item, theme)),
  };
}

export function createPullRequestsComponent(
  options: PullRequestsComponentOptions,
): ListPickerComponent {
  const { pi, tui, theme, keybindings, done, cwd, onInsert } = options;
  const pickerRef: { current: ListPickerComponent | null } = { current: null };
  let notify: (msg: string, type?: "info" | "error") => void = () => {};
  const currentStateRef = {
    value: "open" as "open" | "closed" | "merged" | "all",
  };

  const actions = buildPrActions({
    pi,
    cwd,
    done,
    onInsert,
    notify,
    currentStateRef,
    pickerRef,
  });
  const pickerOptions = buildPrPickerOptions({
    pi,
    cwd,
    theme,
    currentStateRef,
    actions,
  });

  const picker = createListPicker<PullRequest>({
    pi,
    tui,
    theme,
    keybindings,
    done,
    initialQuery: "",
    config: pickerOptions,
  });

  notify = (message, type) => {
    picker.notify?.(message, type);
  };
  pickerRef.current = picker;
  return picker;
}
