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
import { applyFocusedStyle } from "./style-utils";
import { createMarkdownTheme, formatRelativeTime } from "./formatting";

/** Pull request data from GitHub CLI */
export interface PullRequest extends ListPickerItem {
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

  if (result.code !== 0) {
    throw new Error(result.stderr || "Failed to fetch pull requests");
  }

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
      handler: async (item) => {
        await pi.exec("gh", ["pr", "view", String(item.number), "--web"], {
          cwd,
        });
        notify(`Opened PR #${item.number} in browser`, "info");
      },
    },
    {
      key: Key.ctrl("c"),
      label: "checkout",
      handler: async (item) => {
        const result = await pi.exec(
          "gh",
          ["pr", "checkout", String(item.number)],
          { cwd },
        );
        if (result.code === 0) {
          notify(`Checked out PR #${item.number}`, "info");
        } else {
          notify(result.stderr || "Checkout failed", "error");
        }
      },
    },
    {
      key: Key.ctrl("a"),
      label: "approve",
      handler: async (item) => {
        const result = await pi.exec(
          "gh",
          ["pr", "review", String(item.number), "--approve"],
          { cwd },
        );
        if (result.code === 0) {
          notify(`Approved PR #${item.number}`, "info");
          await pickerRef?.reload();
        } else {
          notify(result.stderr || "Approve failed", "error");
        }
      },
    },
    {
      key: Key.ctrl("m"),
      label: "merge",
      handler: async (item) => {
        const result = await pi.exec(
          "gh",
          ["pr", "merge", String(item.number), "--squash", "--delete-branch"],
          { cwd },
        );
        if (result.code === 0) {
          notify(`Merged PR #${item.number}`, "info");
          await pickerRef?.reload();
        } else {
          notify(result.stderr || "Merge failed", "error");
        }
      },
    },
    {
      key: Key.ctrl("s"),
      label: "state",
      handler: async () => {
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
      handler: (item) => {
        if (onInsert) {
          onInsert(`#${item.number}`);
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
      loadItems: async () => {
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
      formatItem: (item, width, theme, isFocused) => {
        const icon = getPrIcon(item.state, item.isDraft);
        const reviewIcon = getReviewIcon(item.reviewDecision);
        const stateColor =
          item.state === "MERGED"
            ? "accent"
            : item.state === "CLOSED"
              ? "error"
              : item.isDraft
                ? "dim"
                : "success";

        const prNum = theme.fg(stateColor, `#${item.number}`);
        const iconStyled = theme.fg(stateColor, icon);

        const additions = theme.fg("success", `+${item.additions}`);
        const deletions = theme.fg("error", `-${item.deletions}`);
        const stats = `${additions}/${deletions}`;

        const branch = theme.fg("dim", item.headRefName);
        const author = theme.fg("dim", `@${item.author}`);
        const time = theme.fg("dim", formatRelativeTime(item.updatedAt));

        // Calculate available width for title
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
            ? item.title.slice(0, titleWidth - 1) + "…"
            : item.title;

        const reviewPart = reviewIcon
          ? theme.fg(
              item.reviewDecision === "APPROVED" ? "success" : "warning",
              reviewIcon,
            ) + " "
          : "";

        const text = `${iconStyled} ${prNum} ${reviewPart}${title} ${branch} ${author} ${stats} ${time}`;

        return applyFocusedStyle(theme, truncateAnsi(text, width), isFocused);
      },
      loadPreview: async (item) => {
        const mdParts: string[] = [
          `| Field | Value |`,
          `|-------|-------|`,
          `| Author | @${item.author} |`,
          `| Branch | ${item.headRefName} → ${item.baseRefName} |`,
          `| State | ${item.state}${item.isDraft ? " (Draft)" : ""} |`,
          `| Review | ${item.reviewDecision || "Pending"} |`,
          `| Changes | +${item.additions} / -${item.deletions} |`,
          `| Updated | ${formatRelativeTime(item.updatedAt)} |`,
          ``,
        ];

        if (item.body) {
          mdParts.push(item.body);
        }

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
