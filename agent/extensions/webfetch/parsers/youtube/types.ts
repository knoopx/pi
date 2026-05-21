export interface YoutubeVideoSnippet {
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

export interface YoutubeVideoContentDetails {
  duration: string;
  dimension?: string;
  definition?: string;
  caption?: string;
}

export interface YoutubeApiItem {
  id?: string;
  snippet?: YoutubeVideoSnippet;
  contentDetails?: YoutubeVideoContentDetails;
  statistics?: Record<string, string>;
}

export interface YoutubeApiResponse {
  items?: YoutubeApiItem[];
}

export interface YoutubeCommentsResponse {
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

export interface YoutubePlaylistItemsResponse {
  items?: Array<{
    snippet: {
      title: string;
      resourceId?: { videoId?: string };
    };
  }>;
}

export interface YoutubeSearchItem {
  id?: { videoId?: string };
  snippet: YoutubeVideoSnippet;
}

export interface YoutubeSearchResponse {
  items?: YoutubeSearchItem[];
}
