import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Key, Markdown } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerItem,
  type ListPickerComponent,
  type ListPickerAction,
} from "./list-picker";
import { truncateAnsi } from "./text-utils";
import { createMarkdownTheme } from "./formatting";
import { formatRelativeTime } from "./formatting-utils";
import { notifyMutation } from "../jj";
/**
 * Execute a gh CLI command and handle the result.
 * On success: notifies with success message and reloads picker.
 * On failure: notifies error message.
 */
async function executeGhCommand(
  pi: ExtensionAPI,
  args: string[],
  cwd: string,
  successMsg: string,
  errorMsg: string,
  pickerRef?: ListPickerComponent | null,
): Promise<boolean> {
  const result = await pi.exec("gh", args, { cwd });
  if (result.code === 0) {
    notifyMutation(pi, successMsg, result.stderr || result.stdout);
    await pickerRef?.reload();
    return true;
  }
  notifyMutation(pi, "error", result.stderr || errorMsg);
  return false;
}
async function openPrInBrowser(
  pi: ExtensionAPI,
  prNumber: number,
  cwd: string,
): Promise<void> {
  await pi.exec("gh", ["pr", "view", String(prNumber), "--web"], { cwd });
  notifyMutation(pi, "info", `Opened PR #${prNumber} in browser`);
}
/** Pull request data from GitHub CLI */
interface PullRequest extends ListPickerItem {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  author: string;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
  url: string;
  body: string;
}
/** PR state icons (Nerd Font) */
const PR_STATE_ICONS: Record<string, string> = {
  OPEN: "󰐊",
  CLOSED: "󰅖",
  MERGED: "󰘬",
};
/** Review decision icons */
const REVIEW_ICONS: Record<string, string> = {
  APPROVED: "󰄬",
  CHANGES_REQUESTED: "󰌑",
  REVIEW_REQUIRED: "󰈈",
};
function getPrIcon(state: string, isDraft: boolean): string {
  if (isDraft) return "󰽾";
  return PR_STATE_ICONS[state] || "󰐊";
}
function getReviewIcon(decision: string | null): string {
  if (!decision) return "";
  return REVIEW_ICONS[decision] || "";
}
async function fetchPullRequests(
  pi: ExtensionAPI,
  cwd: string,
  state: "open" | "closed" | "merged" | "all" = "open",
): Promise<PullRequest[]> {
  const stateArg = state === "all" ? "" : `--state=${state}`;
  const args = [
    "pr",
    "list",
    "--json",
    "number,title,state,isDraft,author,headRefName,baseRefName,createdAt,updatedAt,additions,deletions,reviewDecision,url,body",
    "--limit",
    "100",
  ];
  if (stateArg) args.push(stateArg);
  const result = await pi.exec("gh", args, { cwd });
  if (result.code !== 0)
    throw new Error(result.stderr || "Failed to fetch pull requests");
  try {
    const data = JSON.parse(result.stdout) as {
      number: number;
      title: string;
      state: string;
      isDraft: boolean;
      author: { login: string };
      headRefName: string;
      baseRefName: string;
      createdAt: string;
      updatedAt: string;
      additions: number;
      deletions: number;
      reviewDecision: string | null;
      url: string;
      body: string;
    }[];
    return data.map((pr) => ({
      id: String(pr.number),
      label: pr.title,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      isDraft: pr.isDraft,
      author: pr.author.login,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      additions: pr.additions,
      deletions: pr.deletions,
      reviewDecision: pr.reviewDecision,
      url: pr.url,
      body: pr.body,
    }));
  } catch {
    throw new Error("Failed to parse pull request data");
  }
}
export function createPullRequestsComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: PullRequest | null) => void,
  cwd: string,
  onInsert?: (text: string) => void,
): ListPickerComponent {
  let pickerRef: ListPickerComponent | null = null;
  let notify: (message: string, type?: "info" | "error") => void = () => {};
  let currentState: "open" | "closed" | "merged" | "all" = "open";
  const actions: ListPickerAction<PullRequest>[] = [
    {
      key: Key.ctrl("o"),
      label: "open",
      async handler(item) {
        await openPrInBrowser(pi, item.number, cwd);
      },
    },
    {
      key: Key.ctrl("c"),
      label: "checkout",
      async handler(item) {
        await executeGhCommand(
          pi,
          ["pr", "checkout", String(item.number)],
          cwd,
          `Checked out PR #${item.number} to current workspace`,
          "Checkout failed",
          pickerRef,
        );
      },
    },
    {
      key: Key.ctrl("a"),
      label: "approve",
      async handler(item) {
        await executeGhCommand(
          pi,
          ["pr", "review", String(item.number), "--approve"],
          cwd,
          `Approved PR #${item.number} (review submitted)`,
          "Approve failed",
          pickerRef,
        );
      },
    },
    {
      key: Key.ctrl("m"),
      label: "merge",
      async handler(item) {
        await executeGhCommand(
          pi,
          ["pr", "merge", String(item.number), "--squash", "--delete-branch"],
          cwd,
          `Merged PR #${item.number} (squash + delete branch)`,
          "Merge failed",
          pickerRef,
        );
      },
    },
    {
      key: Key.ctrl("s"),
      label: "state",
      async handler() {
        const states: ("open" | "closed" | "merged" | "all")[] = [
          "open",
          "closed",
          "merged",
          "all",
        ];
        const currentIndex = states.indexOf(currentState);
        currentState = states[(currentIndex + 1) % states.length];
        notify(`Showing ${currentState} PRs`, "info");
        await pickerRef?.reload();
      },
    },
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler(item) {
        if (onInsert) {
          const parts = [
            `#${item.number}: ${item.title}`,
            `State: ${item.state}${item.isDraft ? " (draft)" : ""}`,
            `Author: ${item.author}`,
            `Branch: ${item.headRefName} → ${item.baseRefName}`,
            `+${item.additions} -${item.deletions}`,
            item.body?.trim() || "",
          ].filter(Boolean);
          onInsert(parts.join("\n"));
          done(null);
        }
      },
    },
  ];
  const picker = createListPicker<PullRequest>(
    pi,
    tui,
    theme,
    keybindings,
    done,
    "",
    {
      title: "Pull Requests",
      previewTitle: (item) => `#${item.number}`,
      actions,
      async loadItems() {
        return fetchPullRequests(pi, cwd, currentState);
      },
      filterItems: (items, query) =>
        items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.author.toLowerCase().includes(query) ||
            item.headRefName.toLowerCase().includes(query) ||
            String(item.number).includes(query),
        ),
      formatItem(item, width, theme) {
        const icon = getPrIcon(item.state, item.isDraft);
        const reviewIcon = getReviewIcon(item.reviewDecision);
        let stateColor: "success" | "error" | "accent" | "dim";
        if (item.state === "MERGED") {
          stateColor = "accent";
        } else if (item.state === "CLOSED") {
          stateColor = "error";
        } else if (item.isDraft) {
          stateColor = "dim";
        } else {
          stateColor = "success";
        }
        const prNum = theme.fg(stateColor, `#${item.number}`);
        const iconStyled = theme.fg(stateColor, icon);
        const additions = theme.fg("success", `+${item.additions}`);
        const deletions = theme.fg("error", `-${item.deletions}`);
        const stats = `${additions}/${deletions}`;
        const branch = theme.fg("dim", item.headRefName);
        const author = theme.fg("dim", `@${item.author}`);
        const time = theme.fg("dim", formatRelativeTime(item.updatedAt));
        const fixedParts = [
          `${icon} `,
          `#${item.number} `,
          reviewIcon ? `${reviewIcon} ` : "",
          ` ${item.headRefName}`,
          ` @${item.author}`,
          ` +${item.additions}/-${item.deletions}`,
          ` ${formatRelativeTime(item.updatedAt)}`,
        ].join("");
        const titleWidth = Math.max(20, width - fixedParts.length - 4);
        const title =
          item.title.length > titleWidth
            ? `${item.title.slice(0, titleWidth - 1)}…`
            : item.title;
        const reviewPart = reviewIcon
          ? `${theme.fg(
              item.reviewDecision === "APPROVED" ? "success" : "warning",
              reviewIcon,
            )} `
          : "";
        const text = `${iconStyled} ${prNum} ${reviewPart}${title} ${branch} ${author} ${stats} ${time}`;
        return truncateAnsi(text, width);
      },
      async loadPreview(item) {
        const mdParts: string[] = [
          `| Field | Value |`,
          `|-------|-------|`,
          `| Author | @${item.author} |`,
          `| Branch | ${item.headRefName} → ${item.baseRefName} |`,
          `| State | ${item.state}${item.isDraft ? " (Draft)" : ""} |`,
          `| Review | ${item.reviewDecision ?? "Pending"} |`,
          `| Changes | +${item.additions} / -${item.deletions} |`,
          `| Updated | ${formatRelativeTime(item.updatedAt)} |`,
          ``,
        ];
        if (item.body) mdParts.push(item.body);
        const mdTheme = createMarkdownTheme(theme);
        const md = new Markdown(mdParts.join("\n"), 0, 0, mdTheme);
        return md.render(100);
      },
    },
  );
  notify = (message, type) => {
    picker.notify?.(message, type);
  };
  pickerRef = picker;
  return picker;
}
