import { formatShortDate } from "../../../../shared/format/time-formatting";
import type { YoutubeSearchResponse, YoutubeSearchItem } from "./types";
import { fetchYoutube } from "./client";

function formatSearchItem(item: YoutubeSearchItem): string[] | null {
  const videoId = item.id?.videoId;
  if (!videoId) return null;
  const title = item.snippet.title || "(no title)";
  const channel = item.snippet.channelTitle;
  const published = formatShortDate(item.snippet.publishedAt);
  return [
    `**${title}**`,
    `by ${channel} • ${published}`,
    `[Watch](https://www.youtube.com/watch?v=${videoId})`,
  ];
}

export async function handleSearch(
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchYoutube<YoutubeSearchResponse>(
    `search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=100&order=relevance`,
    signal,
  );

  const items = data.items || [];
  const parts: string[] = [
    `# YouTube — Search "${query}"`,
    "",
    `${items.length} result(s)`,
  ];

  for (const item of items) {
    const formatted = formatSearchItem(item);
    if (formatted) {
      parts.push("");
      parts.push(...formatted);
    }
  }

  return parts.join("\n");
}
