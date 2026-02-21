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
