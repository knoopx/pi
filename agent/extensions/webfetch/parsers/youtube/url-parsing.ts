export interface YoutubePath {
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

export function parseYoutubeUrl(url: string): YoutubePath | null {
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
