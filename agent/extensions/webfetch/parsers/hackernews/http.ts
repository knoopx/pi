import { createRetryFetch, createRetryFetchText } from "../../lib/parser-utils";
import type { HNItem, HNUser, StoryKind } from "./types";
import { FIREBASE, ALGOLIA } from "./constants";

const hnFetchOpts = { apiName: "HackerNews" };
const fetchJson = createRetryFetch(hnFetchOpts);
const fetchText = createRetryFetchText(hnFetchOpts);

export async function fetchItem(
  id: number,
  signal?: AbortSignal,
): Promise<HNItem | null> {
  return fetchJson<HNItem>(`${FIREBASE}/item/${id}.json`, signal);
}

export async function fetchUser(
  username: string,
  signal?: AbortSignal,
): Promise<HNUser> {
  return fetchJson<HNUser>(`${FIREBASE}/user/${username}.json`, signal);
}

export async function fetchStoryIds(
  kind: StoryKind,
  signal?: AbortSignal,
): Promise<number[]> {
  const endpoint =
    kind === "top" ? "topstories" : kind === "new" ? "newstories" : kind;
  return fetchJson<number[]>(`${FIREBASE}/${endpoint}.json`, signal);
}

export async function fetchAlgoliaSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const url = `${ALGOLIA}/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${limit}`;
  const data = await fetchJson<{ hits: unknown[] }>(url, signal);
  return data.hits;
}

export async function fetchRawJson(
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return fetchJson<unknown>(`${FIREBASE}/${path}`, signal);
}

export { fetchText };

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

export { fetchValidStories };
