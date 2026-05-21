import { formatDate } from "../../../../shared/format/time-formatting";
import type {
  YoutubeApiItem,
  YoutubeVideoSnippet,
  YoutubeVideoContentDetails,
  YoutubeApiResponse,
  YoutubeCommentsResponse,
} from "./types";
import { fetchYoutube } from "./client";

function parseNum(value: string | undefined): number | undefined {
  return value ? parseInt(value, 10) : undefined;
}

function parseDurationComponents(iso: string): {
  h?: number;
  m?: number;
  s?: number;
} {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return {};
  const [, h, m, s] = match;
  return { h: parseNum(h), m: parseNum(m), s: parseNum(s) };
}

function toHumanDuration(iso: string): string {
  const { h, m, s } = parseDurationComponents(iso);
  const parts = [
    h !== undefined ? `${h}h` : null,
    m !== undefined ? `${m}m` : null,
    s !== undefined ? `${s}s` : null,
  ].filter((p): p is string => p != null);
  return parts.length === 0 ? "0s" : parts.join(" ");
}

function formatVideoSnippet(snippet: YoutubeVideoSnippet): string[] {
  return [
    `# ${snippet.title}`,
    `by **${String(snippet.channelTitle)}** (${snippet.channelId})`,
    `published: ${formatDate(snippet.publishedAt)}`,
  ];
}

function formatVideoDetailsExtra(
  details: YoutubeVideoContentDetails,
): string[] {
  const parts: string[] = [];
  if (details.definition) parts.push(`${details.definition} video`);
  if (details.caption) parts.push("closed captions available");
  return parts;
}

function formatVideoDetailsMeta(
  details: YoutubeVideoContentDetails | undefined,
): string[] {
  const parts: string[] = [];
  if (details?.duration) {
    parts.push(`duration: ${toHumanDuration(details.duration)}`);
  }
  if (details) parts.push(...formatVideoDetailsExtra(details));
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

function formatCommentEntry(thread: {
  snippet: { topLevelComment?: { snippet?: unknown } };
}): string[] | null {
  const comment = thread.snippet.topLevelComment?.snippet as
    | { authorDisplayName: string; likeCount?: number; textDisplay?: string }
    | undefined;
  if (!comment) return null;
  return [
    `**${comment.authorDisplayName}** (${comment.likeCount ?? 0} likes)`,
    comment.textDisplay ?? "",
    "",
  ];
}

function formatVideoComments(commentsData: YoutubeCommentsResponse): string[] {
  const comments = commentsData.items ?? [];
  if (comments.length === 0) return [];
  const lines = ["", "## Top Comments", "", ...flattenCommentEntries(comments)];
  return lines;
}

function flattenCommentEntries(
  comments: Array<{ snippet: { topLevelComment?: { snippet?: unknown } } }>,
): string[] {
  const entries: string[] = [];
  for (const thread of comments) {
    const entry = formatCommentEntry(thread);
    if (entry) entries.push(...entry);
  }
  return entries;
}

function validateVideo(
  video: YoutubeApiItem | undefined,
  videoId: string,
): YoutubeVideoSnippet {
  if (!video) throw new Error(`Video ${videoId} not found`);
  if (!video.snippet) throw new Error(`Missing snippet for video ${videoId}`);
  return video.snippet;
}

function buildVideoParts(
  snippet: YoutubeVideoSnippet,
  stats: Record<string, string>,
  details: YoutubeVideoContentDetails | undefined,
): string[] {
  const parts: string[] = [
    ...formatVideoSnippet(snippet),
    ...formatVideoMeta(details, stats),
  ];
  const desc = snippet.description || "";
  if (desc) parts.push("", desc);
  return parts;
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
  const snippet = validateVideo(video, videoId);
  const stats: Record<string, string> = video?.statistics || {};
  const details: YoutubeVideoContentDetails | undefined = video?.contentDetails;

  const parts = buildVideoParts(snippet, stats, details);
  parts.push(...formatVideoComments(commentsData));
  parts.push(
    "",
    `[Watch on YouTube](https://www.youtube.com/watch?v=${videoId})`,
  );

  return parts.join("\n");
}
