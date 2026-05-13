import { formatDate } from "../../../../shared/format/time-formatting";
import type { YoutubeVideoSnippet, YoutubeApiResponse } from "./types";
import { fetchYoutube } from "./client";

function formatChannelStats(stats: Record<string, string>): string[] {
  const lines: string[] = [];
  if (stats.subscriberCount)
    lines.push(
      `subscribers: ${parseInt(stats.subscriberCount, 10).toLocaleString()}`,
    );
  if (stats.videoCount)
    lines.push(`videos: ${parseInt(stats.videoCount, 10).toLocaleString()}`);
  if (stats.viewCount)
    lines.push(`views: ${parseInt(stats.viewCount, 10).toLocaleString()}`);
  return lines;
}

function formatChannelDescription(description: string): string[] {
  if (!description) return [];
  return ["", description];
}

export async function handleChannel(
  channelId: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchYoutube<YoutubeApiResponse>(
    `channels?part=snippet,statistics&id=${channelId}`,
    signal,
  );

  const channel = data.items?.[0];
  if (!channel) throw new Error(`Channel ${channelId} not found`);
  if (!channel.snippet)
    throw new Error(`Missing snippet for channel ${channelId}`);

  const snippet: YoutubeVideoSnippet = channel.snippet;
  const stats = channel.statistics || {};

  const parts: string[] = [`# ${snippet.title}`];
  parts.push(`joined: ${formatDate(snippet.publishedAt)}`);
  parts.push(...formatChannelStats(stats));
  parts.push(...formatChannelDescription(snippet.description || ""));

  parts.push(
    "",
    `[View channel on YouTube](https://www.youtube.com/channel/${channelId})`,
  );

  return parts.join("\n");
}
