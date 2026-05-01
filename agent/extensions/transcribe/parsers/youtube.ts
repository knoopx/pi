import { createRetryFetch } from "../lib/parser-utils";
import { formatDate, formatShortDate } from "../lib/formatters";
import { defineParser } from "../lib/parser-utils";

interface YoutubePath {
  kind: "video" | "playlist" | "channel" | "search";
  videoId?: string;
  playlistId?: string;
  channelId?: string;
  query?: string;
}

function isYoutubeHostname(hostname: string): boolean {
  return hostname === "www.youtube.com" || hostname === "youtube.com";
}

function tryParseVideoFromParams(urlObj: URL): YoutubePath | null {
  const v = urlObj.searchParams.get("v");
  if (v) return { kind: "video", videoId: v };
  return null;
}

function tryParseEmbeddedVideo(pathname: string): YoutubePath | null {
  const embedMatch = pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
  if (embedMatch) return { kind: "video", videoId: embedMatch[1] };
  return null;
}

function tryParsePlaylist(urlObj: URL): YoutubePath | null {
  const list = urlObj.searchParams.get("list");
  if (list) return { kind: "playlist", playlistId: list };
  return null;
}

function tryParseChannel(pathname: string): YoutubePath | null {
  const channelMatch = pathname.match(/^\/(?:channel|c|user|@[^/]+)(?:\/|$)/);
  if (channelMatch) {
    const channelIdOrHandle = pathname.split("/")[2];
    if (channelIdOrHandle) {
      return { kind: "channel", channelId: channelIdOrHandle };
    }
  }
  return null;
}

function tryParseSearch(urlObj: URL): YoutubePath | null {
  const q = urlObj.searchParams.get("q");
  if (q) return { kind: "search", query: q };
  return null;
}

function parseYoutubeUrl(url: string): YoutubePath | null {
  const urlObj = new URL(url);
  if (!isYoutubeHostname(urlObj.hostname)) return null;

  const path = urlObj.pathname;

  if (path === "/watch") return tryParseVideoFromParams(urlObj);
  const embedded = tryParseEmbeddedVideo(path);
  if (embedded) return embedded;
  if (path === "/playlist") return tryParsePlaylist(urlObj);
  const channel = tryParseChannel(path);
  if (channel) return channel;
  if (path === "/search") return tryParseSearch(urlObj);

  return null;
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function fetchYoutube<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  return createRetryFetch({ apiName: "YouTube" })(
    `${YOUTUBE_API_BASE}/${endpoint}`,
    signal,
  );
}

interface YoutubeVideoSnippet {
  title: string;
  description: string;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  thumbnails?: {
    medium?: { url: string };
    high?: { url: string };
  };
}

interface YoutubeVideoContentDetails {
  duration: string;
  dimension?: string;
  definition?: string;
  caption?: string;
}

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
  for (const thread of comments.slice(0, 5)) {
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

async function handleVideo(
  videoId: string,
  signal?: AbortSignal,
): Promise<string> {
  const [videosData, commentsData] = await Promise.all([
    fetchYoutube<YoutubeApiResponse>(
      `videos?part=snippet,contentDetails,statistics&id=${videoId}`,
      signal,
    ),
    fetchYoutube<YoutubeCommentsResponse>(
      `commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=10&order=relevance`,
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
  for (const item of items.slice(0, 50)) {
    const videoId = item.snippet.resourceId?.videoId;
    if (!videoId) continue;
    const title = item.snippet.title || "(no title)";
    lines.push(`- [${title}](https://www.youtube.com/watch?v=${videoId})`);
  }
  return lines;
}

async function handlePlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<string> {
  const [playlistData, itemsData] = await Promise.all([
    fetchYoutube<YoutubeApiResponse>(
      `playlists?part=snippet&ids=${playlistId}`,
      signal,
    ),
    fetchYoutube<YoutubePlaylistItemsResponse>(
      `playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=50`,
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
  if (description.length > 1000) {
    return ["", description.slice(0, 997) + "..."];
  }
  return ["", description];
}

async function handleChannel(
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

async function handleSearch(
  query: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await fetchYoutube<YoutubeSearchResponse>(
    `search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=20&order=relevance`,
    signal,
  );

  const items = data.items || [];
  const parts: string[] = [
    `# YouTube — Search "${query}"`,
    "",
    `${items.length} result(s)`,
  ];

  for (const item of items.slice(0, 20)) {
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

function dispatchYoutube(
  parsed: YoutubePath,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<YoutubePath["kind"], () => Promise<string>> = {
    video: () => {
      if (!parsed.videoId) throw new Error("Missing video ID");
      return handleVideo(parsed.videoId, signal);
    },
    playlist: () => {
      if (!parsed.playlistId) throw new Error("Missing playlist ID");
      return handlePlaylist(parsed.playlistId, signal);
    },
    channel: () => {
      if (!parsed.channelId) throw new Error("Missing channel ID");
      return handleChannel(parsed.channelId, signal);
    },
    search: () => {
      if (!parsed.query) throw new Error("Missing search query");
      return handleSearch(parsed.query, signal);
    },
  };
  return handlers[parsed.kind]();
}

interface YoutubeApiResponse {
  items?: Array<{
    id?: string;
    snippet?: YoutubeVideoSnippet;
    contentDetails?: YoutubeVideoContentDetails;
    statistics?: Record<string, string>;
  }>;
}

interface YoutubeCommentsResponse {
  items?: Array<{
    snippet: {
      topLevelComment?: {
        snippet: {
          authorDisplayName: string;
          textDisplay: string;
          likeCount: number;
        };
      };
    };
  }>;
}

interface YoutubePlaylistItemsResponse {
  items?: Array<{
    snippet: {
      title: string;
      resourceId?: { videoId?: string };
    };
  }>;
}

interface YoutubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet: YoutubeVideoSnippet;
  }>;
}

export const youtubeParser = defineParser(
  "YouTube",
  (url) => /^https?:\/\/(?:www\.)?youtube\.com\//i.test(url),
  parseYoutubeUrl,
  dispatchYoutube,
);
