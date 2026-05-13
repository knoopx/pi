import { createRetryFetch, defineParser } from "../../lib/parser-utils";
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

async function handleSubreddit(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  if (!parsed.sub) throw new Error("Missing subreddit");
  const sub = parsed.sub;
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

async function handleSearch(
  parsed: ParsedRedditUrl,
  signal?: AbortSignal,
): Promise<string> {
  if (!parsed.sub) throw new Error("Missing subreddit for search");
  const sub = parsed.sub;
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
