import { formatAge } from "../../../../shared/format/time-formatting";
import {
  formatNumber,
  stripHtml,
} from "../../../../shared/format/text-formatting";
import type {
  RedditCommentData,
  RedditPostData,
  RedditThreadResponse,
} from "./types";
import { renderComment } from "./comment";

const BASE = "https://www.reddit.com";

function extractUrlLink(url: string | undefined, isSelf?: boolean): string[] {
  if (!url || isSelf) return [];
  const domain = extractDomain(url);
  return [`[${domain}](${url})`];
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function makePermalink(permalink: string): string {
  return permalink.startsWith("http") ? permalink : `${BASE}${permalink}`;
}

function renderThreadLink(post: RedditPostData): string[] {
  return extractUrlLink(post.url, post.is_self);
}

function renderThreadBody(post: RedditPostData): string[] {
  if (!post.selftext) return [];
  const clean = stripHtml(post.selftext);
  if (!clean) return [];
  return ["", clean];
}

function renderRedditLink(post: RedditPostData): string {
  return `[View on Reddit](${makePermalink(post.permalink)})`;
}

function buildThreadMeta(post: RedditPostData): string {
  const meta: string[] = [];
  if (post.author) meta.push(`by u/${post.author}`);
  if (post.score) meta.push(`${formatNumber(post.score)} points`);
  if (post.num_comments !== undefined)
    meta.push(`${formatNumber(post.num_comments)} comments`);
  if (post.created_utc) meta.push(formatAge(post.created_utc));
  return meta.join(" • ");
}

function appendThreadComments(
  parts: string[],
  comments: Array<{ data: RedditPostData | RedditCommentData }>,
): void {
  const filtered = comments.filter((c) => c.data.id);
  if (!filtered.length) return;

  parts.push("", "## Comments", "");

  for (const comment of filtered) {
    const wrapper = comment as { kind?: string; data: RedditCommentData };
    if (wrapper.kind === "more") continue;
    parts.push(...renderComment(wrapper.data, 0));
    parts.push("");
  }
}

export async function handleThread(
  parsed: { id?: string; limit?: number; sort?: string },
  fetchJson: <T>(
    path: string,
    params?: Record<string, string>,
    signal?: AbortSignal,
  ) => Promise<T>,
  signal?: AbortSignal,
): Promise<string> {
  if (!parsed.id) throw new Error("Missing thread id");
  const id = parsed.id;
  const limit = parsed.limit ?? 50;
  const sort = parsed.sort || "best";
  const data = await fetchJson<RedditThreadResponse>(
    `/comments/${id}.json`,
    { limit: String(limit), sort },
    signal,
  );
  const postData = data.data.children[0].data as RedditPostData;
  const parts: string[] = [];
  parts.push(`# ${postData.title}`);
  parts.push(buildThreadMeta(postData));
  parts.push(...renderThreadLink(postData));
  parts.push(...renderThreadBody(postData));
  appendThreadComments(parts, data.data.children.slice(1));
  parts.push(renderRedditLink(postData));

  return parts.join("\n");
}
