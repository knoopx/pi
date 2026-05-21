import { fmtAuthorBase } from "../../../lib/author";
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

function formatOrgName(org: { name: string; fullname?: string }): string {
  if (org.fullname && org.fullname !== org.name) {
    return `${org.name} (${org.fullname})`;
  }
  return org.name;
}

function fmtOrgName(detail: {
  org?: { name: string; fullname?: string };
}): string | undefined {
  if (!detail.org) return undefined;
  const orgName = formatOrgName(detail.org);
  return `**Org:** ${orgName}`;
}

function buildCommentFlags(event: HFDiscussionEvent): string[] {
  const flags: string[] = [];
  if (event.data?.edited) flags.push("edited");
  if (event.data?.hidden) flags.push("hidden");
  return flags;
}

function buildCommentBody(event: HFDiscussionEvent): string {
  return event.data?.latest?.raw?.trim() ?? "(empty)";
}

function renderEventComment(
  parts: string[],
  event: HFDiscussionEvent,
  author: string,
  date: string,
): void {
  const flags = buildCommentFlags(event);
  const body = buildCommentBody(event);
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

function resolveCommitRef(data: HFDiscussionEvent["data"]): string {
  return data?.subject ?? data?.oid?.slice(0, 8) ?? "unknown";
}

function formatOidSuffix(data: HFDiscussionEvent["data"]): string {
  return data?.oid ? ` (${data.oid.slice(0, 12)})` : "";
}

function renderEventCommit(
  parts: string[],
  event: HFDiscussionEvent,
  date: string,
): void {
  const data = event.data;
  parts.push(`commit • ${date}`);
  parts.push(`${resolveCommitRef(data)}${formatOidSuffix(data)}`);
}

function dispatchEventRender(
  parts: string[],
  event: HFDiscussionEvent,
  author: string,
  date: string,
): void {
  switch (event.type) {
    case "comment":
      renderEventComment(parts, event, author, date);
      return;
    case "status-change":
      renderEventStatusChange(parts, event, author, date);
      return;
    case "commit":
      renderEventCommit(parts, event, date);
      return;
  }
  parts.push(`${event.type} • ${date}`);
  parts.push(author);
}

function renderEvent(parts: string[], event: HFDiscussionEvent): void {
  const author = fmtAuthor(event.author);
  const date = new Date(event.createdAt).toISOString().split("T")[0];
  parts.push("");
  parts.push(`---`);
  dispatchEventRender(parts, event, author, date);
}

function buildDiscussionHeader(
  detail: HFDiscussionDetail,
  parsed: HFPath,
  url: string,
): string[] {
  const createdDate = new Date(detail.createdAt).toISOString().split("T")[0];
  const header: string[] = [
    `# Discussion #${detail.num}`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
    `**Title:** ${detail.title}`,
    `**Status:** ${discussStatus(detail.status)}`,
    `**Type:** ${discussType(detail.isPullRequest)}`,
    `**URL:** [${url}](${url})`,
    `**Opened by:** ${fmtAuthor(detail.author)} on ${createdDate}`,
  ];
  header.push(...buildOptionalHeaderFields(detail));
  return header;
}

function buildOptionalHeaderFields(detail: HFDiscussionDetail): string[] {
  const fields: string[] = [];
  if (detail.pinned) fields.push("**Pinned:** yes");
  if (detail.locked) fields.push("**Locked:** yes");
  const orgName = fmtOrgName(detail);
  if (orgName) fields.push(orgName);
  return fields;
}

function discussStatus(status: string): string {
  return status === "closed" ? "closed" : "open";
}

function discussType(isPullRequest: boolean): string {
  return isPullRequest ? "PR" : "Discussion";
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

function formatDiscussionItem(
  d: {
    num: number;
    title: string;
    status: string;
    isPullRequest: boolean;
    pinned: boolean;
  },
  url: string,
): string {
  const type = d.isPullRequest ? "PR" : "Disc";
  const status = d.status === "closed" ? "○ closed" : "● open";
  const pinned = d.pinned ? " ⓟ" : "";
  return `- [${d.num}](${url}/${d.num}) ${status} ${type}${pinned} — ${d.title}`;
}

function buildDiscussionsHeader(parsed: HFPath): string[] {
  const header: string[] = [
    `# Discussions`,
    `**Repo:** \`${parsed.owner}/${parsed.name}\``,
  ];
  if (parsed.kind !== "model") {
    header.push(`**Kind:** ${parsed.kind}`);
  }
  return header;
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
    ...buildDiscussionsHeader(parsed),
    "",
    `${discussions.length} discussion(s) found`,
  ];
  for (const d of discussions) {
    parts.push("");
    parts.push(formatDiscussionItem(d, url));
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
