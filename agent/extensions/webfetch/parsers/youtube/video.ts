import { formatDate } from "../../../../shared/format/time-formatting";
import type {
  YoutubeVideoSnippet,
  YoutubeVideoContentDetails,
  YoutubeApiResponse,
  YoutubeCommentsResponse,
} from "./types";
import { fetchYoutube } from "./client";

function toHumanDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return iso;

  const [, h, m, s] = match;
  const parts: string[] = [];
  if (h) parts.push(`${parseInt(h, 10)}h`);
  if (m) parts.push(`${parseInt(m, 10)}m`);
  if (s) parts.push(`${parseInt(s, 10)}s`);
  return parts.join(" ") || "0s";
}

function formatVideoSnippet(snippet: YoutubeVideoSnippet): string[] {
  return [
    `# ${snippet.title}`,
    `by **${String(snippet.channelTitle)}** (${snippet.channelId})`,
    `published: ${formatDate(snippet.publishedAt)}`,
  ];
}

function formatVideoDetailsMeta(
  details: YoutubeVideoContentDetails | undefined,
): string[] {
  const parts: string[] = [];
  const duration = toHumanDuration(details?.duration || "");
  if (duration) parts.push(`duration: ${duration}`);
  if (details?.definition) parts.push(`${details.definition} video`);
  if (details?.caption) parts.push("closed captions available");
  return parts;
}

function formatVideoStatsMeta(stats: Record<string, string>): string[] {
  const parts: string[] = [];
  if (stats.viewCount)
    parts.push(`${parseInt(stats.viewCount, 10).toLocaleString()} views`);
  if (stats.likeCount)
    parts.push(`${parseInt(stats.likeCount, 10).toLocaleString()} likes`);
  return parts;
}

function formatVideoMeta(
  details: YoutubeVideoContentDetails | undefined,
  stats: Record<string, string>,
): string[] {
  const metaParts: string[] = [
    ...formatVideoDetailsMeta(details),
    ...formatVideoStatsMeta(stats),
  ];
  return metaParts.length ? [metaParts.join(" • ")] : [];
}

function formatVideoComments(commentsData: YoutubeCommentsResponse): string[] {
  const comments = commentsData.items || [];
  if (comments.length === 0) return [];

  const lines: string[] = ["", "## Top Comments", ""];
  for (const thread of comments) {
    const comment = thread.snippet.topLevelComment?.snippet;
    if (!comment) continue;
    lines.push(
      `**${comment.authorDisplayName}** (${comment.likeCount ?? 0} likes)`,
    );
    lines.push(comment.textDisplay || "");
    lines.push("");
  }
  return lines;
}

export async function handleVideo(
  videoId: string,
  signal?: AbortSignal,
): Promise<string> {
  const [videosData, commentsData] = await Promise.all([
    fetchYoutube<YoutubeApiResponse>(
      `videos?part=snippet,contentDetails,statistics&id=${videoId}`,
      signal,
    ),
    fetchYoutube<YoutubeCommentsResponse>(
      `commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=100&order=relevance`,
      signal,
    ).catch(() => ({ items: [] })),
  ]);

  const video = videosData.items?.[0];
  if (!video) throw new Error(`Video ${videoId} not found`);
  if (!video.snippet) throw new Error(`Missing snippet for video ${videoId}`);

  const snippet: YoutubeVideoSnippet = video.snippet;
  const stats: Record<string, string> = video.statistics || {};
  const details: YoutubeVideoContentDetails | undefined = video.contentDetails;

  const parts: string[] = [
    ...formatVideoSnippet(snippet),
    ...formatVideoMeta(details, stats),
  ];

  const desc = snippet.description || "";
  if (desc) parts.push("", desc);

  parts.push(...formatVideoComments(commentsData));

  parts.push(
    "",
    `[Watch on YouTube](https://www.youtube.com/watch?v=${videoId})`,
  );

  return parts.join("\n");
}
