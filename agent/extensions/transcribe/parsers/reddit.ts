import { defineParser } from "../lib/parser-utils.js";
import { BROWSER_HEADERS } from "../lib/constants";
import { FETCH_OPTIONS } from "../lib/constants";
import { retry } from "../lib/retry";
import { formatAge, formatNumber, stripHtml } from "../lib/formatters";

const BASE = "https://www.reddit.com";

// --- URL parsing ---

type RedditKind =
  | "subreddit"
  | "thread"
  | "search"
  | "user"
  | "frontpage"
  | "multi";

interface ParsedRedditUrl {
  kind: RedditKind;
  sub?: string;
  id?: string;
  user?: string;
  query?: string;
  sort?: string;
  time?: string;
  limit?: number;
  subs?: string[];
}

function parseRedditUrl(url: string): ParsedRedditUrl | null {
  const match = url.match(
    /^https?:\/\/(?:www\.|old\.)?reddit\.com(?:\/(.+))?$/,
  );
  if (!match) return null;

  const path = match[1]?.replace(/\/+$/, "") || "";
  if (!path) return { kind: "frontpage" };

  const parts = path.split("/").filter(Boolean);
  const first = parts[0].toLowerCase();

  return dispatchRedditPath(first, parts);
}

function dispatchRedditPath(
  first: string,
  parts: string[],
): ParsedRedditUrl | null {
  const handlers: Record<string, () => ParsedRedditUrl | null> = {
    r: () => parseSubredditPath(parts.slice(1)),
    comments: () => (parts[1] ? { kind: "thread", id: parts[1] } : null),
    user: () => (parts[1] ? { kind: "user", user: parts[1] } : null),
    u: () => (parts[1] ? { kind: "user", user: parts[1] } : null),
    m: () => (parts[1] ? { kind: "multi", subs: [] } : null),
  };
  const handler = handlers[first];
  return handler ? handler() : null;
}

function parseSubredditPath(parts: string[]): ParsedRedditUrl {
  if (parts.length === 0) return { kind: "frontpage" };

  const sub = parts[0];
  if (parts.length === 1) return { kind: "subreddit", sub, sort: "hot" };

  const second = parts[1].toLowerCase();
  const threadResult = tryParseThreadPath(second, parts);
  if (threadResult) return threadResult;
  if (second === "search")
    return { kind: "search", sub, query: "", sort: "relevance" };

  return { kind: "subreddit", sub, sort: tryParseSortKind(second) || "hot" };
}

function tryParseThreadPath(
  second: string,
  parts: string[],
): ParsedRedditUrl | null {
  if (second !== "comments" || !parts[2]) return null;
  return { kind: "thread", sub: "", id: parts[2] };
}

function tryParseSortKind(segment: string): string | null {
  const sortKinds = new Set(["hot", "new", "top", "rising", "controversial"]);
  if (sortKinds.has(segment)) return segment;
  if (segment === "submitted") return "top";
  return null;
}

// --- Data fetching ---

interface RedditPostData {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  subreddit: string;
  url: string;
  created_utc: number;
  upvote_ratio: number;
  permalink: string;
  selftext?: string;
  is_self: boolean;
  link_flair_text?: string;
  thumbnail?: string;
  media?: Record<string, unknown>;
  post_hint?: string;
}

interface RedditListing {
  data: {
    children: Array<{ data: RedditPostData }>;
    after?: string;
  };
}

interface RedditCommentData {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  subreddit?: string;
  replies?: {
    data: {
      children: Array<{
        kind: string;
        data: RedditCommentData;
      }>;
    };
  };
}

interface RedditThreadResponse {
  data: {
    children: Array<{ data: RedditPostData | RedditCommentData }>;
  };
}

async function fetchRedditJson<T>(
  path: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  return retry(async () => {
    const res = await fetch(url.toString(), {
      headers: BROWSER_HEADERS,
      signal,
    });
    if (!res.ok) throw new Error(`Reddit API ${res.status}: ${res.statusText}`);
    return res.json() as T;
  }, FETCH_OPTIONS);
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

// --- Listing renderer ---

function renderListing(header: string, listing: RedditListing): string {
  const parts: string[] = [header, ``];

  for (const { data: post } of listing.data.children) {
    if (parts.length > 1) parts.push("");
    parts.push(...renderPost(post));
  }

  return parts.join("\n");
}

// --- Handlers ---

async function handleSubreddit(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const sub = parsed.sub!;
  const sort = parsed.sort || "hot";
  const limit = parsed.limit ?? 25;
  const params: Record<string, string> = { limit: String(limit) };
  if (parsed.time && sort === "top") params.t = parsed.time;

  const data = await fetchRedditJson<RedditListing>(
    `/r/${sub}/${sort}.json`,
    params,
    signal,
  );

  const sortLabel = sort.charAt(0).toUpperCase() + sort.slice(1);
  return renderListing(`# r/${sub} — ${sortLabel}`, data);
}

async function handleFrontpage(signal?: AbortSignal): Promise<string> {
  const data = await fetchRedditJson<RedditListing>(
    "/hot.json",
    { limit: "25" },
    signal,
  );

  return renderListing(`# Reddit — Hot`, data);
}

async function handleThread(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const id = parsed.id!;
  const limit = parsed.limit ?? 50;
  const sort = parsed.sort || "best";

  const data = await fetchRedditJson<RedditThreadResponse>(
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

function renderThreadLink(post: RedditPostData): string[] {
  if (post.is_self || !post.url) return [];
  const domain = extractDomain(post.url);
  return [`[${domain}](${post.url})`];
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
  return meta.join(" \u2022 ");
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

async function handleSearch(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const sub = parsed.sub!;
  const query = parsed.query || "";
  const sort = parsed.sort || "relevance";
  const limit = parsed.limit ?? 25;

  const data = await fetchRedditJson<RedditListing>(
    `/r/${sub}/search.json`,
    {
      q: query,
      limit: String(limit),
      sort,
      restrict_sr: "on",
    },
    signal,
  );

  return renderListing(`# Search r/${sub} for "${query}"`, data);
}

async function handleUser(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const user = parsed.user!;

  const data = await fetchRedditJson<RedditListing>(
    `/user/${user}/submitted.json`,
    { limit: "25" },
    signal,
  );

  const parts: string[] = [`# u/${user}`, ``];

  if (!data.data.children.length) {
    parts.push(`No posts found for u/${user}.`);
    return parts.join("\n");
  }

  parts.push("**Recent Posts**", "");
  for (const { data: post } of data.data.children) {
    if (parts.length > 2) parts.push("");
    parts.push(...renderPost(post));
  }
  return parts.join("\n");
}

// --- Rendering ---

function renderPost(post: RedditPostData): string[] {
  const lines: string[] = [];

  let title = post.title;
  if (post.link_flair_text) title = `[${post.link_flair_text}] ${title}`;
  lines.push(`**${title}**`);

  lines.push(buildPostMeta(post));
  lines.push(...buildPostLink(post));
  lines.push(`[\u2197 reddit](${makePermalink(post.permalink)})`);

  return lines;
}

function buildPostMeta(post: RedditPostData): string {
  const meta: string[] = [
    `r/${post.subreddit}`,
    post.author ? `u/${post.author}` : "",
    `${formatNumber(post.score)} points`,
    `${formatNumber(post.num_comments)} comments`,
    formatAge(post.created_utc),
  ].filter(Boolean);
  return meta.join(" \u2022 ");
}

function buildPostLink(post: RedditPostData): string[] {
  if (!post.is_self && post.url) {
    const domain = extractDomain(post.url);
    return [`[${domain}](${post.url})`];
  }

  if (post.selftext) {
    const snippet = stripHtml(post.selftext).split("\n").filter(Boolean)[0];
    if (snippet) {
      const truncated =
        snippet.length > 200 ? snippet.slice(0, 197) + "..." : snippet;
      return [truncated];
    }
  }

  return [];
}

function renderComment(comment: RedditCommentData, depth: number): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  lines.push(buildCommentHeader(comment, indent));
  lines.push(...buildCommentBody(comment, indent));

  if (comment.replies?.data?.children && depth < 3) {
    for (const child of comment.replies.data.children) {
      if (child.kind === "more") continue;
      lines.push("");
      lines.push(...renderComment(child.data, depth + 1));
    }
  }

  return lines;
}

function buildCommentHeader(
  comment: RedditCommentData,
  indent: string,
): string {
  const author = comment.author || "[deleted]";
  const score = comment.score > 0 ? ` (${formatNumber(comment.score)})` : "";
  return `${indent}**${author}**${score}`;
}

function buildCommentBody(
  comment: RedditCommentData,
  indent: string,
): string[] {
  const body = stripHtml(comment.body);
  if (!body) return [`${indent}[deleted]`];
  return body.split("\n").map((line) => `${indent}${line}`);
}

// --- Parser export ---

function dispatchReddit(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<RedditKind, () => Promise<string>> = {
    subreddit: () => handleSubreddit(parsed, signal),
    frontpage: () => handleFrontpage(signal),
    thread: () => handleThread(parsed, signal),
    search: () => handleSearch(parsed, signal),
    user: () => handleUser(parsed, signal),
    multi: () => {
      throw new Error("Multireddits are not supported");
    },
  };
  return handlers[parsed.kind]();
}

export const parser = defineParser(
  "Reddit",
  (url) => /^https?:\/\/(?:www\.|old\.)?reddit\.com\//i.test(url),
  parseRedditUrl,
  dispatchReddit,
);
