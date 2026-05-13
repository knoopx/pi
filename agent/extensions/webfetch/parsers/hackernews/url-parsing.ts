import type { ParsedHNUrl, StoryKind } from "./types";

function parseHnUrl(url: string): ParsedHNUrl | null {
  const firebase = tryParseFirebaseUrl(url);
  if (firebase) return firebase;
  const match = url.match(
    /^https?:\/\/news\.ycombinator\.com(?:\/(.+))?(?:\?(.+))?$/,
  );
  if (!match) return null;
  const [, path, queryString] = match;
  const params = new URLSearchParams(queryString || "");
  const parsers: Array<() => ParsedHNUrl | null> = [
    () => tryParseItemPath(path, params),
    () => tryParseUserRelatedPath(path, params),
    () => tryParseStoriesPath(path, params),
    () => tryParseSearchParams(params),
  ];

  for (const parser of parsers) {
    const result = parser();
    if (result) return result;
  }

  return null;
}

function tryParseFirebaseUrl(url: string): ParsedHNUrl | null {
  if (!url.includes("hacker-news.firebaseio.com")) return null;
  const match = url.match(/\/v0\/(.+)/);
  if (match) return { kind: "firebase", firebasePath: match[1] };
  return null;
}

function tryParseItemPath(
  path: string | undefined,
  params: URLSearchParams,
): ParsedHNUrl | null {
  if (path !== "item" && path !== undefined) return null;
  const id = Number(params.get("id"));
  if (id > 0) return { kind: "item", itemId: id };
  return null;
}

function tryParseUserRelatedPath(
  path: string | undefined,
  params: URLSearchParams,
): ParsedHNUrl | null {
  const username = params.get("id");
  if (!username) return null;
  const kindMap: Record<string, ParsedHNUrl["kind"]> = {
    user: "user",
    favorites: "saved",
    upvoted: "upvoted",
    submitted: "submitted",
  };
  const kind = kindMap[path || ""];
  if (kind) return { kind, username };
  return null;
}

const STORY_PATHS: Record<string, StoryKind> = {
  "": "top",
  newest: "new",
  best: "best",
  ask: "ask",
  show: "show",
  jobs: "jobs",
};

function clampLimit(raw: number): number {
  return isNaN(raw) ? 20 : Math.min(raw, 200);
}

function tryParseStoriesPath(
  path: string | undefined,
  params: URLSearchParams,
): ParsedHNUrl | null {
  const storyKind = STORY_PATHS[(path || "").toLowerCase()];
  if (!storyKind) return null;
  return {
    kind: "stories",
    storyKind,
    limit: clampLimit(Number(params.get("limit"))),
  };
}

function tryParseSearchParams(params: URLSearchParams): ParsedHNUrl | null {
  const q = params.get("q") || params.get("query");
  if (!q) return null;
  return {
    kind: "search",
    query: q,
    limit: clampLimit(Number(params.get("limit"))),
  };
}

export { parseHnUrl };
