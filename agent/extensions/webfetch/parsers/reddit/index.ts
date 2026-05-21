import { createRetryFetch, defineParser } from "../../lib/parser-factory";
import type { ParsedRedditUrl, RedditListing } from "./types";
import { parseRedditUrl } from "./url-parsing";
import { handleThread } from "./thread";
import { renderListing } from "./listing";

const BASE = "https://www.reddit.com";
const redditFetch = createRetryFetch({ apiName: "Reddit" });

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
  return redditFetch(url.toString(), signal);
}

function resolveLimit(parsed: ParsedRedditUrl): number {
  return parsed.limit ?? 25;
}

function isTopSort(parsed: ParsedRedditUrl): boolean {
  return (parsed.sort || "hot") === "top";
}

function buildSubredditParams(parsed: ParsedRedditUrl): Record<string, string> {
  const params: Record<string, string> = {
    limit: String(resolveLimit(parsed)),
  };
  if (isTopSort(parsed) && parsed.time) {
    params.t = parsed.time;
  }
  return params;
}

async function handleSubreddit(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const sub = parsed.sub;
  if (!sub) throw new Error("Missing subreddit");

  const sort = parsed.sort || "hot";
  const params = buildSubredditParams(parsed);

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

function resolveSearchParams(parsed: ParsedRedditUrl): {
  query: string;
  sort: string;
  limit: number;
} {
  return {
    query: parsed.query || "",
    sort: parsed.sort || "relevance",
    limit: parsed.limit ?? 25,
  };
}

async function handleSearch(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  if (!parsed.sub) throw new Error("Missing subreddit for search");
  const sub = parsed.sub;
  const { query, sort, limit } = resolveSearchParams(parsed);
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
  if (!parsed.user) throw new Error("Missing username");
  const user = parsed.user;
  const data = await fetchRedditJson<RedditListing>(
    `/user/${user}/submitted.json`,
    { limit: "25" },
    signal,
  );
  return renderListing(`# u/${user}`, data, {
    preamble: ["**Recent Posts**"],
    emptyMessage: `No posts found for u/${user}.`,
  });
}

function dispatchReddit(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<ParsedRedditUrl["kind"], () => Promise<string>> = {
    subreddit: () => handleSubreddit(parsed, signal),
    frontpage: () => handleFrontpage(signal),
    thread: () => handleThread(parsed, fetchRedditJson, signal),
    search: () => handleSearch(parsed, signal),
    user: () => handleUser(parsed, signal),
    multi: () => {
      throw new Error("Multireddits are not supported");
    },
  };
  return handlers[parsed.kind]();
}

export const redditParser = defineParser(
  "Reddit",
  (url) => /^https?:\/\/(?:www\.|old\.)?reddit\.com\//i.test(url),
  parseRedditUrl,
  dispatchReddit,
);
