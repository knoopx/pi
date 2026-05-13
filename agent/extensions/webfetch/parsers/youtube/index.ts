import { defineParser } from "../../lib/parser-utils";
import { parseYoutubeUrl, type YoutubePath } from "./url-parsing";
import { handleVideo } from "./video";
import { handlePlaylist } from "./playlist";
import { handleChannel } from "./channel";
import { handleSearch } from "./search";

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

export const youtubeParser = defineParser(
  "YouTube",
  (url) => /^https?:\/\/(?:www\.)?youtube\.com\//i.test(url),
  parseYoutubeUrl,
  dispatchYoutube,
);
