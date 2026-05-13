import type { ParsedRedditUrl } from "./types";

export function parseRedditUrl(url: string): ParsedRedditUrl | null {
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
