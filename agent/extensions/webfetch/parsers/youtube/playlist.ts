import type {
  YoutubeVideoSnippet,
  YoutubeApiResponse,
  YoutubePlaylistItemsResponse,
} from "./types";
import { fetchYoutube } from "./client";

function formatPlaylistHeader(snippet: YoutubeVideoSnippet): string[] {
  return [`# ${snippet.title}`, `by **${snippet.channelTitle}**`];
}

function formatPlaylistItems(
  items: Array<{
    snippet: { title: string; resourceId?: { videoId?: string } };
  }>,
): string[] {
  if (items.length === 0) return [];
  const lines: string[] = ["", `## Videos (${items.length})`, ""];
  for (const item of items) {
    const videoId = item.snippet.resourceId?.videoId;
    if (!videoId) continue;
    const title = item.snippet.title || "(no title)";
    lines.push(`- [${title}](https://www.youtube.com/watch?v=${videoId})`);
  }
  return lines;
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

  const playlist = playlistData.items?.[0];
  if (!playlist) throw new Error(`Playlist ${playlistId} not found`);
  if (!playlist.snippet)
    throw new Error(`Missing snippet for playlist ${playlistId}`);

  const parts: string[] = [
    ...formatPlaylistHeader(playlist.snippet),
    ...formatPlaylistItems(itemsData.items || []),
  ];

  parts.push(
    "",
    `[View playlist on YouTube](https://www.youtube.com/playlist?list=${playlistId})`,
  );

  return parts.join("\n");
}
