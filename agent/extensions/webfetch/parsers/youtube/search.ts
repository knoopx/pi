import { formatShortDate } from "../../../../shared/format/time-formatting";
import type { YoutubeSearchResponse } from "./types";
import { fetchYoutube } from "./client";

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
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    const title = item.snippet.title || "(no title)";
    const channel = item.snippet.channelTitle;
    const published = formatShortDate(item.snippet.publishedAt);
    parts.push(
      "",
      `**${title}**`,
      `by ${channel} • ${published}`,
      `[Watch](https://www.youtube.com/watch?v=${videoId})`,
    );
  }

  return parts.join("\n");
}
