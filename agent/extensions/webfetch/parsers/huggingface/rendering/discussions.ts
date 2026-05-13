import { fmtAuthorBase } from "../../../../../shared/rendering/author";
import { BASE } from "../http";
import type { HFPath, HFDiscussionEvent, HFDiscussionDetail } from "../types";

function fmtAuthor(
  a: {
    name: string;
    fullname?: string;
    type?: string;
    isPro?: boolean;
    isHf?: boolean;
  } | null,
): string {
  if (!a) return "system";
  const parts = fmtAuthorBase(a);
  return parts.join(" ");
}

function fmtReactions(
  reactions: Array<{ reaction: string; count: number }>,
): string {
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  return total > 0 ? `+${total}` : "";
}

function fmtOrgName(detail: {
  org?: { name: string; fullname?: string };
}): string | undefined {
  if (!detail.org) return undefined;
  const orgName =
    detail.org.fullname && detail.org.fullname !== detail.org.name
      ? `${detail.org.name} (${detail.org.fullname})`
      : detail.org.name;
  return `**Org:** ${orgName}`;
}

function renderEventComment(
  parts: string[],
  event: HFDiscussionEvent,
  author: string,
  date: string,
): void {
  const flags: string[] = [];
  if (event.data?.edited) flags.push("edited");
  if (event.data?.hidden) flags.push("hidden");
  const body = event.data?.latest?.raw?.trim() ?? "(empty)";
  const reactions = fmtReactions(event.data?.reactions ?? []);
  const footer = [flags.join(" "), reactions].filter(Boolean).join("  ");
  const content = footer ? `${body}\n\n${footer}` : body;
  parts.push(`${author} • ${date}`);
  parts.push(content);
}

function renderEventStatusChange(
  parts: string[],
  event: HFDiscussionEvent,
  author: string,
  date: string,
): void {
  const status = event.data?.status ?? "unknown";
  parts.push(`${author} • ${date}`);
  parts.push(`status → ${status}`);
}

function renderEventCommit(
  parts: string[],
  event: HFDiscussionEvent,
  date: string,
): void {
  const ref = event.data?.subject ?? event.data?.oid?.slice(0, 8) ?? "unknown";
  const oid = event.data?.oid ? ` (${event.data.oid.slice(0, 12)})` : "";
  parts.push(`commit • ${date}`);
  parts.push(`${ref}${oid}`);
}

function renderEvent(parts: string[], event: HFDiscussionEvent): void {
  const author = fmtAuthor(event.author);
  const date = new Date(event.createdAt).toISOString().split("T")[0];
  parts.push("");
  parts.push(`---`);

  switch (event.type) {
    case "comment":
      renderEventComment(parts, event, author, date);
      break;
    case "status-change":
      renderEventStatusChange(parts, event, author, date);
      break;
    case "commit":
      renderEventCommit(parts, event, date);
      break;
    default:
      parts.push(`${event.type} • ${date}`);
      parts.push(author);
      break;
  }
}

function buildDiscussionHeader(
  detail: HFDiscussionDetail,
  parsed: HFPath,
  url: string,
): string[] {
  const header: string[] = [
    `# Discussion #${detail.num}`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
    `**Title:** ${detail.title}`,
    `**Status:** ${detail.status === "closed" ? "closed" : "open"}`,
    `**Type:** ${detail.isPullRequest ? "PR" : "Discussion"}`,
    `**URL:** [${url}](${url})`,
    `**Opened by:** ${fmtAuthor(detail.author)} on ${new Date(detail.createdAt).toISOString().split("T")[0]}`,
  ];
  if (detail.pinned) header.push("**Pinned:** yes");
  if (detail.locked) header.push("**Locked:** yes");
  const orgName = fmtOrgName(detail);
  if (orgName) header.push(orgName);
  return header;
}

export function renderDiscussionDetail(
  parsed: HFPath,
  detail: HFDiscussionDetail,
): string {
  const url = `${BASE}/${parsed.owner}/${parsed.name}/discussions/${parsed.number}`;
  const parts = buildDiscussionHeader(detail, parsed, url);
  for (const event of detail.events) {
    renderEvent(parts, event);
  }
  return parts.join("\n");
}

export function renderDiscussionsList(
  parsed: HFPath,
  discussions: Array<{
    num: number;
    title: string;
    status: string;
    isPullRequest: boolean;
    pinned: boolean;
  }>,
): string {
  const url = `${BASE}/${parsed.owner}/${parsed.name}/discussions`;
  const parts: string[] = [
    `# Discussions`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
    "",
    `${discussions.length} discussion(s) found`,
  ];
  if (parsed.kind !== "model") {
    parts.push(`**Kind:** ${parsed.kind}`);
  }
  for (const d of discussions) {
    const type = d.isPullRequest ? "PR" : "Disc";
    const status = d.status === "closed" ? "○ closed" : "● open";
    const pinned = d.pinned ? " ⓟ" : "";
    parts.push("");
    parts.push(
      `- [${d.num}](${url}/${d.num}) ${status} ${type}${pinned} — ${d.title}`,
    );
  }
  return parts.join("\n");
}

export function buildDiscussionFallback(parsed: HFPath, url: string): string {
  const fallbackParts: string[] = [
    parsed.number ? `# Discussion #${parsed.number}` : `# Discussions`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
  ];
  if (parsed.kind !== "model") fallbackParts.push(`**Kind:** ${parsed.kind}`);
  fallbackParts.push("");
  fallbackParts.push(
    parsed.number
      ? `[View on HuggingFace](${url})`
      : `[View all discussions](${url})`,
  );
  return fallbackParts.join("\n");
}
