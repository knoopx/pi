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
    const parts = pathname.split("/");
    // /channel/ID → parts[2], /c/name → parts[2], /user/name → parts[2]
    // /@handle → parts[1] (only 2 segments)
    const channelIdOrHandle = parts[2] || parts[1];
    if (channelIdOrHandle) {
      return { kind: "channel", channelId: channelIdOrHandle };
    }
  }
  return null;
}

function tryParseSearch(urlObj: URL): YoutubePath | null {
  const q = urlObj.searchParams.get("search_query");
  if (q) return { kind: "search", query: q };
  return null;
}

function tryParsePathVideo(path: string, urlObj: URL): YoutubePath | null {
  if (path === "/watch") return tryParseVideoFromParams(urlObj);
  return tryParseEmbeddedVideo(path);
}

function tryParsePathBrowse(path: string, urlObj: URL): YoutubePath | null {
  if (path === "/playlist") return tryParsePlaylist(urlObj);
  if (path === "/results") return tryParseSearch(urlObj);
  const channel = tryParseChannel(path);
  if (channel) return channel;
  if (path === "/search") return tryParseSearch(urlObj);
  return null;
}

export function parseYoutubeUrl(url: string): YoutubePath | null {
  const urlObj = new URL(url);
  if (!isYoutubeHostname(urlObj.hostname)) return null;

  const path = urlObj.pathname;
  const videoResult = tryParsePathVideo(path, urlObj);
  if (videoResult) return videoResult;

  return tryParsePathBrowse(path, urlObj);
}
