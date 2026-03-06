/**
 * Reddit extension - browse and search subreddit posts.
 *
 * Tools:
 *   reddit        - fetch feed posts (hot/new/top/rising)
 *   reddit-search - search posts by query within a subreddit or site-wide
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { dotJoin, countLabel, table } from "../renderers";
import { throttledFetch } from "../../shared/throttle";
import type { Column } from "../renderers";

interface RedditApiChild {
  data: {
    id: string;
    title: string;
    author: string;
    permalink: string;
    created_utc: number | string;
    selftext: string;
    score: number | string;
    num_comments: number | string;
    subreddit: string;
    url: string;
  };
}

interface RedditApiResponse {
  kind: string;
  data: { children: RedditApiChild[] };
  error?: number;
  reason?: string;
  message?: string;
}

export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

export function visibleWidth(text: string): number {
  return Array.from(text).length;
}

export function truncateToWidth(text: string, width: number): string {
  if (width <= 0) return "";
  if (visibleWidth(text) <= width) return text;
  if (width <= 3) return ".".repeat(width);

  const headWidth = width - 3;
  const head = Array.from(text).slice(0, headWidth).join("");
  return `${head}...`;
}

export function extractScore(content: string): number {
  const words = content.toLowerCase().split(" ");

  for (let index = 0; index < words.length; index += 1) {
    const token = words[index];
    if (token === "points" && index > 0) {
      const raw = words[index - 1];
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

export function formatRelativeTime(value: string | number): string {
  const epochMs = typeof value === "string" ? Date.parse(value) : value;
  if (!Number.isFinite(epochMs)) return "just now";

  const diffSecs = Math.floor((Date.now() - epochMs) / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 30) return `${Math.floor(diffDays / 30)}mo ago`;
  if (diffDays >= 7) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return "just now";
}

export function parsePosts(json: RedditApiResponse) {
  if (json.error || json.reason) {
    throw new Error(
      `Reddit error: ${json.message || json.reason || `HTTP ${json.error}`}`,
    );
  }

  if (json.kind !== "Listing" || !json.data?.children?.length) {
    throw new Error("No posts found");
  }

  return json.data.children.map((child) => {
    const d = child.data;
    const createdSeconds = Number(d.created_utc);
    const createdMs = Number.isFinite(createdSeconds)
      ? createdSeconds * 1000
      : Date.now();

    return {
      title: d.title,
      author: d.author,
      score: Number(d.score) || 0,
      comments: Number(d.num_comments) || 0,
      age: formatRelativeTime(createdMs),
      link: `https://www.reddit.com${d.permalink ?? ""}`,
      url: d.url,
    };
  });
}

export function parseRedditJson(jsonText: string, feedType: string) {
  const parsed = JSON.parse(jsonText) as RedditApiResponse;
  return {
    feedType,
    posts: parsePosts(parsed),
  };
}

const REDDIT_UA = { "User-Agent": "pi-reddit-tool/1.0" };

async function redditFetch(url: string, signal?: AbortSignal) {
  const response = await throttledFetch(url, { signal, headers: REDDIT_UA });
  if (!response.ok) {
    throw new Error(`Reddit returned HTTP ${response.status}`);
  }
  return (await response.json()) as RedditApiResponse;
}

const postCols: Column[] = [
  { key: "󰁝", align: "right", minWidth: 5 },
  { key: "󰍻", align: "right", minWidth: 4 },
  { key: "age", align: "right", minWidth: 5 },
  {
    key: "title",
    format: (_v, row) => {
      const r = row as { title: string; author: string; link: string };
      return `${r.title}\nby ${r.author}\n${r.link}`;
    },
  },
];

export function formatPostTable(posts: ReturnType<typeof parsePosts>): string {
  const rows = posts.map((p) => ({
    "󰁝": String(p.score),
    "󰍻": String(p.comments),
    age: p.age,
    title: p.title,
    author: p.author,
    link: p.link,
  }));
  return table(postCols, rows);
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "reddit",
    label: "Reddit",
    description:
      "Fetch posts from a subreddit. Returns title, author, score, comments, age, and links.",
    parameters: Type.Object({
      subreddit: Type.String({ description: "Subreddit name (without r/)" }),
      feedType: Type.Optional(
        StringEnum(["hot", "new", "top", "rising"] as const),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Number of posts (1-25, default 10)",
          minimum: 1,
          maximum: 25,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const subreddit = params.subreddit.replace(/^r\//, "");
      const feedType = params.feedType ?? "hot";
      const limit = params.limit ?? 10;

      const url = `https://www.reddit.com/r/${subreddit}/${feedType}.json?limit=${limit}`;
      const posts = parsePosts(await redditFetch(url, signal));

      const text = [
        dotJoin(`${posts.length} posts`),
        "",
        formatPostTable(posts),
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        details: { subreddit, feedType, posts },
      };
    },
  });

  pi.registerTool({
    name: "reddit-search",
    label: "Reddit Search",
    description:
      "Search Reddit posts by query. Optionally restrict to a subreddit. Returns title, author, score, comments, age, and links.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      subreddit: Type.Optional(
        Type.String({
          description: "Restrict search to this subreddit (without r/)",
        }),
      ),
      sort: Type.Optional(
        StringEnum(["relevance", "hot", "top", "new", "comments"] as const),
      ),
      time: Type.Optional(
        StringEnum(["hour", "day", "week", "month", "year", "all"] as const),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Number of results (1-25, default 10)",
          minimum: 1,
          maximum: 25,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      const q = encodeURIComponent(params.query);
      const sort = params.sort ?? "relevance";
      const time = params.time ?? "all";
      const limit = params.limit ?? 10;
      const subreddit = params.subreddit?.replace(/^r\//, "");

      const base = subreddit
        ? `https://www.reddit.com/r/${subreddit}/search.json`
        : `https://www.reddit.com/search.json`;
      const restrict = subreddit ? "&restrict_sr=on" : "";
      const url = `${base}?q=${q}&sort=${sort}&t=${time}&limit=${limit}${restrict}`;

      const posts = parsePosts(await redditFetch(url, signal));

      const text = [
        dotJoin(countLabel(posts.length, "result")),
        "",
        formatPostTable(posts),
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        details: { query: params.query, subreddit, sort, posts },
      };
    },
  });
}
