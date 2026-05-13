import { formatAge } from "../../../../../shared/format/time-formatting";
import {
  formatNumber,
  stripHtml,
} from "../../../../../shared/format/text-formatting";
import type { HNItem, HNUser } from "../types";
import { HN_BASE } from "../constants";
import { fetchUser, fetchValidStories } from "../http";

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderUser(user: HNUser, stories: HNItem[]): string {
  const parts: string[] = [`# ${user.id}`, ""];
  parts.push(buildUserMeta(user));
  parts.push(...buildUserAbout(user));

  if (stories.length) {
    parts.push("", "## Recent Submissions");
    for (const item of stories) {
      parts.push(...renderSubmissionItem(item));
    }
  }

  return parts.join("\n");
}

function buildUserMeta(user: HNUser): string {
  const meta: string[] = [];
  if (user.karma !== undefined) meta.push(`karma: ${formatNumber(user.karma)}`);
  if (user.created) meta.push(`member since: ${formatTime(user.created)}`);
  return meta.join(" \u2022 ");
}

function buildUserAbout(user: HNUser): string[] {
  if (!user.about?.trim()) return [];
  return ["", "**About:**", stripHtml(user.about)];
}

function renderSubmissionItem(item: HNItem): string[] {
  const title = item.title || "(no title)";
  const url = item.url ? ` [${item.url}](${item.url})` : "";
  const meta = buildSubmissionMeta(item);

  return [
    `- **${title}**${url}`,
    `  ${meta} [HN](${HN_BASE}/item?id=${item.id})`,
  ];
}

function buildSubmissionMeta(item: HNItem): string {
  const parts: string[] = [];
  if (item.score !== undefined) parts.push(`${item.score} pts`);
  if (item.descendants !== undefined)
    parts.push(`${item.descendants} comments`);
  if (item.time) parts.push(formatAge(item.time));
  return parts.join(" \u2022 ");
}

async function handleUser(
  username: string,
  signal?: AbortSignal,
): Promise<string> {
  const user = await fetchUser(username, signal);
  if (!user.id) throw new Error(`User ${username} not found`);
  const stories = await fetchRecentStories(user, signal);
  return renderUser(user, stories);
}

async function fetchRecentStories(
  user: HNUser,
  signal?: AbortSignal,
): Promise<HNItem[]> {
  if (!user.submitted?.length) return [];
  return fetchValidStories(user.submitted, signal);
}

export { handleUser };
