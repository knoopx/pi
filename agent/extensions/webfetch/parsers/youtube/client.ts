import { createRetryFetch } from "../../lib/parser-factory";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export function fetchYoutube<T>(
  endpoint: string,
  signal?: AbortSignal,
): Promise<T> {
  return createRetryFetch({ apiName: "YouTube" })(
    `${YOUTUBE_API_BASE}/${endpoint}`,
    signal,
  );
}
