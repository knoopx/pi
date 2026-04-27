import { defineParser } from "../lib/parser-utils.js";
import { BROWSER_HEADERS } from "../lib/constants";
import { FETCH_OPTIONS } from "../lib/constants";
import { retry } from "../lib/retry";
import { formatAge, formatNumber, stripHtml } from "../lib/formatters";

const FIREBASE = "https://hacker-news.firebaseio.com/v0";
const HN_BASE = "https://news.ycombinator.com";
const ALGOLIA = "https://hn.algolia.com/api/v1";

interface HNItem {
  id: number;
  type: "story" | "comment" | "job" | "poll" | "unknown";
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  text?: string;
  kids?: number[];
  dead?: boolean;
  deleted?: boolean;
}

interface HNUser {
  id: string;
  about?: string;
  created?: number;
  karma?: number;
  submitted?: number[];
}

type StoryKind = "top" | "new" | "best" | "ask" | "show" | "jobs";

interface ParsedHNUrl {
  kind:
    | "stories"
    | "item"
    | "user"
    | "saved"
    | "upvoted"
    | "submitted"
    | "search"
    | "firebase";
  storyKind?: StoryKind;
  itemId?: number;
  username?: string;
  query?: string;
  firebasePath?: string;
  limit?: number;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchWithAuth(
  url: string,
  signal?: AbortSignal,
): Promise<Response> {
  return retry(async () => {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res;
  }, FETCH_OPTIONS);
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return (await fetchWithAuth(url, signal)).json() as T;
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  return (await fetchWithAuth(url, signal)).text();
}

async function fetchItem(
  id: number,
  signal?: AbortSignal,
): Promise<HNItem | null> {
  return fetchJson<HNItem>(`${FIREBASE}/item/${id}.json`, signal);
}

async function fetchUser(
  username: string,
  signal?: AbortSignal,
): Promise<HNUser> {
  return fetchJson<HNUser>(`${FIREBASE}/user/${username}.json`, signal);
}

async function fetchStoryIds(
  kind: StoryKind,
  signal?: AbortSignal,
): Promise<number[]> {
  const endpoint =
    kind === "top" ? "topstories" : kind === "new" ? "newstories" : kind;
  return fetchJson<number[]>(`${FIREBASE}/${endpoint}.json`, signal);
}

async function fetchAlgoliaSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const url = `${ALGOLIA}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
  const data = await fetchJson<{ hits: unknown[] }>(url, signal);
  return data.hits;
}

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
function buildStoryItem(rank: number, item: HNItem): string[] {
  const titleLine = buildStoryTitle(rank, item);
  const metaLine = buildStoryMeta(item);
  const linkLine = `    [HN](${HN_BASE}/item?id=${item.id})`;
  return [titleLine, metaLine, linkLine];
}

function buildStoryTitle(rank: number, item: HNItem): string {
  const title = item.title || "(no title)";
  if (item.url) return `**${rank}. ${title}** [${item.url}](${item.url})`;
  return `**${rank}. ${title}**`;
}

function buildStoryMeta(item: HNItem): string {
  const meta: string[] = [];
  if (item.score !== undefined) meta.push(`score: ${formatNumber(item.score)}`);
  if (item.by) meta.push(`by: ${item.by}`);
  if (item.descendants !== undefined)
    meta.push(`comments: ${formatNumber(item.descendants)}`);
  if (item.time) meta.push(formatAge(item.time));
  return meta.join(" • ");
}

const STORY_LABELS: Record<StoryKind, string> = {
  top: "Top Stories",
  new: "New Stories",
  best: "Best Stories",
  ask: "Ask HN",
  show: "Show HN",
  jobs: "Jobs",
};

async function handleStories(
  kind: StoryKind,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  const ids = await fetchStoryIds(kind, signal);
  const validItems = await fetchValidStories(ids.slice(0, limit), signal);

  const parts: string[] = [`# Hacker News — ${STORY_LABELS[kind]}`, ``];

  for (let i = 0; i < validItems.length; i++) {
    if (i > 0) parts.push("");
    parts.push(...buildStoryItem(i + 1, validItems[i]));
  }

  return parts.join("\n");
}

async function handleItem(
  itemId: number,
  signal?: AbortSignal,
): Promise<string> {
  const item = await fetchItem(itemId, signal);
  if (!item) throw new Error(`Item ${itemId} not found`);

  if (item.deleted || item.dead) {
    return renderDeletedItem(itemId);
  }

  const parts: string[] = [];
  parts.push(...renderItemHeader(item));
  parts.push(buildItemMeta(item));
  parts.push(buildItemStats(item));
  parts.push(...renderItemText(item));
  parts.push("");
  parts.push(renderItemLink(item));

  return parts.join("\n");
}

function renderDeletedItem(id: number): string {
  return `# Item #${id}\n\nThis item has been deleted or marked as dead.`;
}

function renderItemHeader(item: HNItem): string[] {
  const parts: string[] = [];
  if (item.title) parts.push(`# ${item.title}`);
  if (item.url) parts.push(`[**${item.url}**](${item.url})`);
  return parts;
}

function renderItemText(item: HNItem): string[] {
  if (!item.text) return [];
  const clean = stripHtml(item.text);
  if (!clean) return [];
  return ["", clean];
}

function renderItemLink(item: HNItem): string {
  return `[View on Hacker News](${HN_BASE}/item?id=${item.id})`;
}

function buildItemMeta(item: HNItem): string {
  const meta: string[] = [`id: ${item.id}`, `type: ${item.type}`];
  if (item.by) meta.push(`by: [${item.by}](${HN_BASE}/user?id=${item.by})`);
  if (item.time) meta.push(formatTime(item.time));
  return meta.join(" \u2022 ");
}

function buildItemStats(item: HNItem): string {
  const stats: string[] = [];
  if (item.score !== undefined)
    stats.push(`score: ${formatNumber(item.score)}`);
  if (item.descendants !== undefined)
    stats.push(`comments: ${formatNumber(item.descendants)}`);
  return stats.join(" \u2022 ");
}
async function handleUser(
  username: string,
  signal?: AbortSignal,
): Promise<string> {
  const user = await fetchUser(username, signal);
  if (!user.id) throw new Error(`User ${username} not found`);

  const parts: string[] = [`# ${user.id}`, ""];
  parts.push(buildUserMeta(user));
  parts.push(...buildUserAbout(user));
  await appendRecentSubmissions(parts, user, signal);

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

async function appendRecentSubmissions(
  parts: string[],
  user: HNUser,
  signal?: AbortSignal,
): Promise<void> {
  const stories = await fetchRecentStories(user, signal);
  if (!stories.length) return;

  parts.push("", "## Recent Submissions");

  for (const item of stories) {
    parts.push(...renderSubmissionItem(item));
  }
}

async function fetchRecentStories(
  user: HNUser,
  signal?: AbortSignal,
): Promise<HNItem[]> {
  if (!user.submitted?.length) return [];

  const recentIds = user.submitted.slice(0, 10);
  return fetchValidStories(recentIds, signal);
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

async function fetchValidStories(
  ids: number[],
  signal?: AbortSignal,
): Promise<HNItem[]> {
  const items = await Promise.all(ids.map((id) => fetchItem(id, signal)));
  return items.filter(isValidStory);
}

function isValidStory(item: HNItem | null): item is HNItem {
  return !!(item && item.type === "story" && !item.deleted && !item.dead);
}

async function handleHtmlListPage(
  kind: "saved" | "upvoted" | "submitted",
  username: string,
  signal?: AbortSignal,
): Promise<string> {
  const stories = await fetchListStories(kind, username, signal);
  const label = LIST_PAGE_LABELS[kind];

  const parts: string[] = [`# ${username}\'s ${label}`, ""];

  for (let i = 0; i < stories.length; i++) {
    if (i > 0) parts.push("");
    parts.push(...buildStoryItem(i + 1, stories[i]));
  }

  if (!stories.length) {
    parts.push(`No stories found for ${username}.`);
  }

  return parts.join("\n");
}

const LIST_PAGE_LABELS: Record<string, string> = {
  saved: "Saved Stories",
  upvoted: "Upvoted Stories",
  submitted: "Submissions",
};

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
  const user = await fetchUser(username, signal);
  const recentIds = (user.submitted || []).slice(0, 20);
  return fetchValidStories(recentIds, signal);
}
async function handleSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  const hits = await fetchAlgoliaSearch(query, limit, signal);

  const parts: string[] = [`# Hacker News Search — "${query}"`, ""];

  for (let i = 0; i < hits.length; i++) {
    if (i > 0) parts.push("");
    parts.push(...renderSearchHit(i + 1, hits[i] as Record<string, unknown>));
  }

  return parts.join("\n");
}

function renderSearchHit(rank: number, hit: Record<string, unknown>): string[] {
  const id = Number(hit.objectID);
  const fields = extractSearchFields(hit);

  const lines: string[] = [`**${rank}. ${fields.title}**`];
  lines.push(buildSearchMeta(fields));
  lines.push(renderSearchLinks(id, fields.url));

  return lines;
}

function extractSearchFields(hit: Record<string, unknown>): {
  title: string;
  url: string | null;
  points: number;
  numComments: number;
  author: string;
  createdAt: string | null;
} {
  return {
    title: safeString(hit.title) || "(no title)",
    url: safeString(hit.url),
    points: Number(hit.points || 0),
    numComments: Number(hit.num_comments || 0),
    author: safeString(hit.author) || "",
    createdAt: safeString(hit.created_at),
  };
}

function safeString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function buildSearchMeta(fields: {
  points: number;
  numComments: number;
  author: string;
  createdAt: string | null;
}): string {
  const meta: string[] = [
    `score: ${formatNumber(fields.points)}`,
    `comments: ${formatNumber(fields.numComments)}`,
  ];
  if (fields.author) meta.push(`by: ${fields.author}`);
  if (fields.createdAt) {
    const d = new Date(fields.createdAt);
    meta.push(
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );
  }
  return meta.join(" \u2022 ");
}

function renderSearchLinks(id: number, url: string | null): string {
  const links: string[] = [`[HN](${HN_BASE}/item?id=${id})`];
  if (url) links.push(`[${url}](${url})`);
  return links.map((l) => `    ${l}`).join(" ");
}
async function handleFirebasePath(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const itemId = tryParseItemId(path);
  if (itemId !== null) return handleItem(itemId, signal);

  const username = tryParseUsername(path);
  if (username) return handleUser(username, signal);

  const kind = tryParseStoryKind(path);
  if (kind) return handleStories(kind, 20, signal);

  // Fallback: fetch raw JSON and display it
  const data = await fetchJson<unknown>(`${FIREBASE}/${path}`, signal);
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

function dispatchHN(
  parsed: ParsedHNUrl,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<ParsedHNUrl["kind"], () => Promise<string>> = {
    stories: () =>
      handleStories(parsed.storyKind || "top", parsed.limit || 20, signal),
    item: () => handleItem(parsed.itemId!, signal),
    user: () => handleUser(parsed.username!, signal),
    saved: () => handleHtmlListPage("saved", parsed.username!, signal),
    upvoted: () => handleHtmlListPage("upvoted", parsed.username!, signal),
    submitted: () => handleHtmlListPage("submitted", parsed.username!, signal),
    search: () => handleSearch(parsed.query!, parsed.limit || 20, signal),
    firebase: () => handleFirebasePath(parsed.firebasePath!, signal),
  };
  return handlers[parsed.kind]();
}

export const parser = defineParser(
  "Hacker News",
  (url) =>
    /^https?:\/\/(news\.ycombinator\.com|hacker-news\.firebaseio\.com)\//i.test(
      url,
    ),
  parseHnUrl,
  dispatchHN,
);
