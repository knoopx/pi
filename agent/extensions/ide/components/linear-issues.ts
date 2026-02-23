import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { Key, Markdown } from "@mariozechner/pi-tui";
import {
  createListPicker,
  type ListPickerAction,
  type ListPickerComponent,
  type ListPickerItem,
} from "./list-picker";
import { truncateAnsi } from "./text-utils";
import { applyFocusedStyle } from "./style-utils";
import { createMarkdownTheme, formatRelativeTime } from "./formatting";
import { linearGraphQL } from "../api/linear";

export {
  createLinearIssueForm,
  type IssueFormResult,
} from "./linear-issue-form";

const AUTH_FILE_PATH = path.join(os.homedir(), ".pi", "agent", "auth.json");

function loadLinearApiKey(): string | undefined {
  try {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      const data = JSON.parse(
        fs.readFileSync(AUTH_FILE_PATH, "utf-8"),
      ) as Record<string, unknown>;
      const linear = data.linear as { apiKey?: string } | undefined;
      if (typeof linear?.apiKey === "string" && linear.apiKey.length > 0) {
        return linear.apiKey;
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

export function saveLinearApiKey(apiKey: string): void {
  const dir = path.dirname(AUTH_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let data: Record<string, unknown> = {};
  try {
    if (fs.existsSync(AUTH_FILE_PATH)) {
      data = JSON.parse(fs.readFileSync(AUTH_FILE_PATH, "utf-8")) as Record<
        string,
        unknown
      >;
    }
  } catch {
    // Start with empty object if file is invalid
  }

  data.linear = { apiKey };
  fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(data, null, 2));
}

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: {
    name: string;
    type: string;
  } | null;
  team: {
    key: string;
    name: string;
  } | null;
  creator: {
    id: string;
  } | null;
  assignee: {
    id: string;
    name: string;
    displayName: string | null;
  } | null;
  labels: {
    nodes: {
      name: string;
    }[];
  };
}

interface LinearQueryData {
  viewer: {
    id: string;
  };
  issues: {
    nodes: LinearIssueNode[];
  };
}

export interface LinearIssue extends ListPickerItem {
  identifier: string;
  title: string;
  stateName: string;
  stateType: string;
  teamKey: string;
  creatorId: string | null;
  assigneeName: string;
  assigneeId: string | null;
  priority: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  labelNames: string[];
}

type IssueFilter =
  | "mine-active"
  | "mine-all"
  | "created"
  | "urgent"
  | "recent"
  | "all";

const ISSUE_FILTERS: { key: IssueFilter; label: string }[] = [
  { key: "mine-active", label: "My Active" },
  { key: "mine-all", label: "My Issues" },
  { key: "created", label: "Created by Me" },
  { key: "urgent", label: "Urgent/High" },
  { key: "recent", label: "Recent" },
  { key: "all", label: "All" },
];

const PRIORITY_LABELS: Record<number, string> = {
  0: "none",
  1: "urgent",
  2: "high",
  3: "normal",
  4: "low",
};

const STATE_ICONS: Record<string, string> = {
  started: "󱞩",
  completed: "󰄬",
  canceled: "󰅖",
  unstarted: "󰄱",
  backlog: "󰛢",
  triage: "󱃔",
};

function isIssueActive(stateType: string): boolean {
  return stateType !== "completed" && stateType !== "canceled";
}

async function fetchLinearIssues(apiKey: string): Promise<{
  viewerId: string;
  issues: LinearIssue[];
}> {
  const query = `
    query IdeLinearOverlayIssues($first: Int!) {
      viewer {
        id
      }
      issues(first: $first, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          description
          priority
          url
          createdAt
          updatedAt
          state {
            name
            type
          }
          team {
            key
            name
          }
          creator {
            id
          }
          assignee {
            id
            name
            displayName
          }
          labels {
            nodes {
              name
            }
          }
        }
      }
    }
  `;

  const data = await linearGraphQL<LinearQueryData>(apiKey, {
    query,
    variables: { first: 100 },
  });

  const issues = data.issues.nodes.map(
    (issue): LinearIssue => ({
      id: issue.id,
      label: issue.title,
      identifier: issue.identifier,
      title: issue.title,
      stateName: issue.state?.name ?? "Unknown",
      stateType: issue.state?.type ?? "unknown",
      teamKey: issue.team?.key ?? "-",
      creatorId: issue.creator?.id ?? null,
      assigneeName:
        issue.assignee?.displayName ?? issue.assignee?.name ?? "unassigned",
      assigneeId: issue.assignee?.id ?? null,
      priority: issue.priority,
      url: issue.url,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      description: issue.description ?? "",
      labelNames: issue.labels.nodes.map((label) => label.name),
    }),
  );

  return { viewerId: data.viewer.id, issues };
}

async function openIssueUrl(
  pi: ExtensionAPI,
  url: string,
  cwd: string,
): Promise<void> {
  const linuxResult = await pi.exec("xdg-open", [url], { cwd });
  if (linuxResult.code === 0) {
    return;
  }

  await pi.exec("open", [url], { cwd });
}

export type LinearAction =
  | { type: "create" }
  | { type: "edit"; issue: LinearIssue };

export interface LinearIssuesResult {
  issue: LinearIssue | null;
  action?: LinearAction;
}

export function getLinearApiKey(): string | undefined {
  return loadLinearApiKey();
}

export function createLinearIssuesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: LinearIssuesResult) => void,
  cwd: string,
  onInsert?: (text: string) => void,
): ListPickerComponent {
  const apiKey = loadLinearApiKey();

  if (!apiKey) {
    return {
      render: (width) => [
        theme.fg(
          "warning",
          truncateAnsi(
            "Not logged in to Linear. Run /linear-login first.",
            width,
          ),
        ),
      ],
      handleInput: (data) => {
        if (data === "\u001b" || data === "\r") {
          done({ issue: null });
        }
      },
      dispose: () => {},
      setPreview: () => {},
      invalidate: () => {},
      reload: async () => {},
    };
  }

  let pickerRef: ListPickerComponent | null = null;
  let notify: (message: string, type?: "info" | "error") => void = () => {};
  let currentFilterIndex = 0;
  let viewerId: string | null = null;

  function getCurrentFilter(): IssueFilter {
    return ISSUE_FILTERS[currentFilterIndex].key;
  }

  function getCurrentFilterLabel(): string {
    return ISSUE_FILTERS[currentFilterIndex].label;
  }

  function filterIssue(issue: LinearIssue, filter: IssueFilter): boolean {
    switch (filter) {
      case "mine-active":
        return issue.assigneeId === viewerId && isIssueActive(issue.stateType);
      case "mine-all":
        return issue.assigneeId === viewerId;
      case "created":
        return issue.creatorId === viewerId;
      case "urgent":
        return issue.priority <= 2 && issue.priority > 0;
      case "recent": {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        return new Date(issue.updatedAt).getTime() > weekAgo;
      }
      case "all":
        return true;
    }
  }

  const actions: ListPickerAction<LinearIssue>[] = [
    {
      key: Key.ctrl("n"),
      label: "new",
      handler: () => {
        done({ issue: null, action: { type: "create" } });
      },
    },
    {
      key: Key.ctrl("e"),
      label: "edit",
      handler: (item) => {
        done({ issue: item, action: { type: "edit", issue: item } });
      },
    },
    {
      key: Key.ctrl("o"),
      label: "open",
      handler: async (item) => {
        await openIssueUrl(pi, item.url, cwd);
        notify(`Opened ${item.identifier} in browser`, "info");
      },
    },
    {
      key: Key.ctrl("/"),
      label: "filter",
      handler: async () => {
        currentFilterIndex = (currentFilterIndex + 1) % ISSUE_FILTERS.length;
        await pickerRef?.reload();
      },
    },
    {
      key: Key.ctrl("i"),
      label: "insert",
      handler: (item) => {
        if (onInsert) {
          onInsert(item.identifier);
          done({ issue: null });
        }
      },
    },
  ];

  const picker = createListPicker<LinearIssue>(
    pi,
    tui,
    theme,
    keybindings,
    (issue) => {
      // Enter inserts full issue summary into editor
      if (issue && onInsert) {
        const priorityLabel = PRIORITY_LABELS[issue.priority] ?? "none";
        const updated = new Date(issue.updatedAt).toLocaleString();
        const desc = issue.description?.trim() || "No description.";
        const summary = [
          `Issue: ${issue.identifier}`,
          `State: ${issue.stateName}`,
          `Team: ${issue.teamKey}`,
          `Assignee: ${issue.assigneeName}`,
          `Priority: ${priorityLabel}`,
          `Updated: ${updated}`,
          "",
          desc,
        ].join("\n");
        onInsert(summary);
      }
      done({ issue: null });
    },
    "",
    {
      title: () => `Linear: ${getCurrentFilterLabel()}`,
      previewTitle: (item) => item.identifier,
      actions,
      onKey: (data) => {
        if (data === "\x1b") {
          done({ issue: null });
          return true;
        }
        return false;
      },
      loadItems: async () => {
        const data = await fetchLinearIssues(apiKey);
        viewerId = data.viewerId;

        const filter = getCurrentFilter();
        return data.issues.filter((issue) => filterIssue(issue, filter));
      },
      filterItems: (items, query) =>
        items.filter((item) => {
          return (
            item.identifier.toLowerCase().includes(query) ||
            item.title.toLowerCase().includes(query) ||
            item.teamKey.toLowerCase().includes(query) ||
            item.stateName.toLowerCase().includes(query) ||
            item.assigneeName.toLowerCase().includes(query) ||
            item.labelNames.some((label) => label.toLowerCase().includes(query))
          );
        }),
      formatItem: (item, width, theme, isFocused) => {
        const stateIcon = STATE_ICONS[item.stateType] ?? "󰄱";
        const priorityLabel = PRIORITY_LABELS[item.priority] ?? "none";
        const stateColor =
          item.stateType === "completed"
            ? "success"
            : item.stateType === "canceled"
              ? "error"
              : "accent";

        const identifier = theme.fg(stateColor, item.identifier);
        const icon = theme.fg(stateColor, stateIcon);
        const team = theme.fg("dim", item.teamKey);
        const assignee = theme.fg("dim", `@${item.assigneeName}`);
        const state = theme.fg("dim", item.stateName);
        const priority =
          item.priority === 0
            ? theme.fg("dim", priorityLabel)
            : theme.fg("warning", priorityLabel);
        const time = theme.fg("dim", formatRelativeTime(item.updatedAt));

        const fixedParts = [
          `${stateIcon} `,
          `${item.identifier} `,
          ` ${item.teamKey}`,
          ` ${item.stateName}`,
          ` ${priorityLabel}`,
          ` @${item.assigneeName}`,
          ` ${formatRelativeTime(item.updatedAt)}`,
        ].join("");

        const titleWidth = Math.max(20, width - fixedParts.length - 3);
        const title =
          item.title.length > titleWidth
            ? `${item.title.slice(0, titleWidth - 1)}…`
            : item.title;

        const text = `${icon} ${identifier} ${title} ${team} ${state} ${priority} ${assignee} ${time}`;
        return applyFocusedStyle(theme, truncateAnsi(text, width), isFocused);
      },
      loadPreview: async (item) => {
        const priorityLabel = PRIORITY_LABELS[item.priority] ?? "none";
        const content = [
          `| Field | Value |`,
          `|-------|-------|`,
          `| Issue | ${item.identifier} |`,
          `| State | ${item.stateName} |`,
          `| Team | ${item.teamKey} |`,
          `| Assignee | ${item.assigneeName} |`,
          `| Priority | ${priorityLabel} |`,
          `| Created | ${formatRelativeTime(item.createdAt)} |`,
          `| Updated | ${formatRelativeTime(item.updatedAt)} |`,
          ``,
          `# ${item.title}`,
          ``,
          item.description || "*No description.*",
        ].join("\n");

        const mdTheme = createMarkdownTheme(theme);
        const markdown = new Markdown(content, 0, 0, mdTheme);
        return markdown.render(80);
      },
    },
  );

  notify = (message, type) => {
    picker.notify?.(message, type);
  };

  pickerRef = picker;
  return picker;
}
