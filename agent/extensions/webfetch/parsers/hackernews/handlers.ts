import type { HNItem, ParsedHNUrl, StoryKind } from "./types";
import { HN_BASE } from "./constants";
import {
  fetchItem,
  fetchStoryIds,
  fetchValidStories,
  fetchRawJson,
  fetchText,
} from "./http";
import { buildStoryItem } from "./rendering/stories";
import { renderItem } from "./rendering/item";
import { handleUser } from "./rendering/user";
import { handleSearch } from "./rendering/search";

const LIST_PAGE_LABELS: Record<string, string> = {
  saved: "Saved Stories",
  upvoted: "Upvoted Stories",
  submitted: "Submissions",
};

async function handleStories(
  kind: StoryKind,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  const ids = await fetchStoryIds(kind, signal);
  const validItems = await fetchValidStories(ids.slice(0, limit), signal);
  const parts: string[] = [`# Hacker News — ${storyLabel(kind)}`, ``];

  for (let i = 0; i < validItems.length; i++) {
    if (i > 0) parts.push("");
    parts.push(...buildStoryItem(i + 1, validItems[i]));
  }

  return parts.join("\n");
}

function storyLabel(kind: StoryKind): string {
  const labels: Record<StoryKind, string> = {
    top: "Top Stories",
    new: "New Stories",
    best: "Best Stories",
    ask: "Ask HN",
    show: "Show HN",
    jobs: "Jobs",
  };
  return labels[kind];
}

async function handleHtmlListPage(
  kind: "saved" | "upvoted" | "submitted",
  username: string,
  signal?: AbortSignal,
): Promise<string> {
  const stories = await fetchListStories(kind, username, signal);
  const label = LIST_PAGE_LABELS[kind];
  const parts: string[] = [`# ${username}'s ${label}`, ""];

  for (let i = 0; i < stories.length; i++) {
    if (i > 0) parts.push("");
    parts.push(...buildStoryItem(i + 1, stories[i]));
  }

  if (!stories.length) {
    parts.push(`No stories found for ${username}.`);
  }

  return parts.join("\n");
}

async function fetchListStories(
  kind: "saved" | "upvoted" | "submitted",
  username: string,
  signal?: AbortSignal,
): Promise<HNItem[]> {
  if (kind === "submitted") return fetchSubmittedStories(username, signal);
  return parseHtmlStoryList(
    `${HN_BASE}/${kind}?id=${encodeURIComponent(username)}`,
    signal,
  );
}

async function fetchSubmittedStories(
  username: string,
  signal?: AbortSignal,
): Promise<HNItem[]> {
  const { fetchUser } = await import("./http");
  const user = await fetchUser(username, signal);
  return fetchValidStories(user.submitted || [], signal);
}

async function parseHtmlStoryList(
  htmlUrl: string,
  signal?: AbortSignal,
): Promise<HNItem[]> {
  const html = await fetchText(htmlUrl, signal);
  const ids = extractThingIds(html);
  return fetchValidStories(ids, signal);
}

function extractThingIds(html: string): number[] {
  const ids: number[] = [];
  const thingRegex = /id="([^"]+)"\s+class="athing"/g;
  let match;

  while ((match = thingRegex.exec(html)) !== null) {
    const id = parseInt(match[1].replace("item_", ""), 10);
    if (!isNaN(id)) ids.push(id);
  }
  return ids;
}

async function handleFirebasePath(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const itemId = tryParseItemId(path);
  if (itemId !== null) {
    const item = await fetchItem(itemId, signal);
    if (item) return renderItem(item);
  }
  const username = tryParseUsername(path);
  if (username) return handleUser(username, signal);
  const kind = tryParseStoryKind(path);
  if (kind) return handleStories(kind, 20, signal);

  const data = await fetchRawJson(path, signal);
  const jsonBlock = "\`\`\`json\n" + JSON.stringify(data, null, 2) + "\n\`\`\`";
  return `# Firebase API: /v0/${path}\n\n${jsonBlock}`;
}

function tryParseItemId(path: string): number | null {
  const match = path.match(/^(?:id|item)\/(\d+)\.json?$/);
  if (match) return parseInt(match[1], 10);
  return null;
}

function tryParseUsername(path: string): string | null {
  const match = path.match(/^user\/([^/]+)\.json?$/);
  if (match) return match[1];
  return null;
}

const FIREBASE_STORY_KINDS: Record<string, StoryKind> = {
  topstories: "top",
  newstories: "new",
  beststories: "best",
  askstories: "ask",
  showstories: "show",
  jobstories: "jobs",
};

function tryParseStoryKind(path: string): StoryKind | null {
  for (const [key, kind] of Object.entries(FIREBASE_STORY_KINDS)) {
    if (new RegExp(`^${key}\\.json?$`).test(path)) return kind;
  }
  return null;
}

export function dispatchHN(
  parsed: ParsedHNUrl,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<ParsedHNUrl["kind"], () => Promise<string>> = {
    stories: () =>
      handleStories(parsed.storyKind || "top", parsed.limit || 20, signal),
    item: () => {
      if (!parsed.itemId) throw new Error("Missing item id");
      return handleItem(parsed.itemId, signal);
    },
    user: () => {
      if (!parsed.username) throw new Error("Missing username");
      return handleUser(parsed.username, signal);
    },
    saved: () => {
      if (!parsed.username) throw new Error("Missing username for saved");
      return handleHtmlListPage("saved", parsed.username, signal);
    },
    upvoted: () => {
      if (!parsed.username) throw new Error("Missing username for upvoted");
      return handleHtmlListPage("upvoted", parsed.username, signal);
    },
    submitted: () => {
      if (!parsed.username) throw new Error("Missing username for submitted");
      return handleHtmlListPage("submitted", parsed.username, signal);
    },
    search: () => {
      if (!parsed.query) throw new Error("Missing search query");
      return handleSearch(parsed.query, parsed.limit || 20, signal);
    },
    firebase: () => {
      if (!parsed.firebasePath) throw new Error("Missing firebase path");
      return handleFirebasePath(parsed.firebasePath, signal);
    },
  };
  return handlers[parsed.kind]();
}

async function handleItem(
  itemId: number,
  signal?: AbortSignal,
): Promise<string> {
  const item = await fetchItem(itemId, signal);
  if (!item) throw new Error(`Item ${itemId} not found`);
  return renderItem(item);
}
