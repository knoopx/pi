import type {
  YoutubeVideoSnippet,
  YoutubeApiResponse,
  YoutubePlaylistItemsResponse,
} from "./types";
import { fetchYoutube } from "./client";

function formatPlaylistHeader(snippet: YoutubeVideoSnippet): string[] {
  return [`# ${snippet.title}`, `by **${snippet.channelTitle}**`];
}

function formatPlaylistItem(item: {
  snippet: { title: string; resourceId?: { videoId?: string } };
}): string | null {
  const videoId = item.snippet.resourceId?.videoId;
  if (!videoId) return null;
  const title = item.snippet.title || "(no title)";
  return `- [${title}](https://www.youtube.com/watch?v=${videoId})`;
}

function formatPlaylistItems(
  items: Array<{
    snippet: { title: string; resourceId?: { videoId?: string } };
  }>,
): string[] {
  if (items.length === 0) return [];
  const lines: string[] = ["", `## Videos (${items.length})`, ""];
  for (const item of items) {
    const line = formatPlaylistItem(item);
    if (line) lines.push(line);
  }
  return lines;
}

function resolvePlaylist(
  playlistData: YoutubeApiResponse,
  playlistId: string,
): { snippet: YoutubeVideoSnippet } {
  const playlist = playlistData.items?.[0];
  if (!playlist) throw new Error(`Playlist ${playlistId} not found`);
  if (!playlist.snippet)
    throw new Error(`Missing snippet for playlist ${playlistId}`);
  return { snippet: playlist.snippet };
}

export async function handlePlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<string> {
  const [playlistData, itemsData] = await Promise.all([
    fetchYoutube<YoutubeApiResponse>(
      `playlists?part=snippet&ids=${playlistId}`,
      signal,
    ),
    fetchYoutube<YoutubePlaylistItemsResponse>(
      `playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=100`,
      signal,
    ).catch(() => ({ items: [] })),
  ]);

  const playlist = resolvePlaylist(playlistData, playlistId);
  const items = itemsData.items || [];

  const parts: string[] = [
    ...formatPlaylistHeader(playlist.snippet),
    ...formatPlaylistItems(items),
  ];

  parts.push(
    "",
    `[View playlist on YouTube](https://www.youtube.com/playlist?list=${playlistId})`,
  );

  return parts.join("\n");
}
