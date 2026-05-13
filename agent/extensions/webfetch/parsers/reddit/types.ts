export type RedditKind =
  | "subreddit"
  | "thread"
  | "search"
  | "user"
  | "frontpage"
  | "multi";

export interface ParsedRedditUrl {
  kind: RedditKind;
  sub?: string;
  id?: string;
  user?: string;
  query?: string;
  sort?: string;
  time?: string;
  limit?: number;
  subs?: string[];
}

export interface RedditPostData {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  subreddit: string;
  url: string;
  created_utc: number;
  upvote_ratio: number;
  permalink: string;
  selftext?: string;
  is_self: boolean;
  link_flair_text?: string;
  thumbnail?: string;
  media?: Record<string, unknown>;
  post_hint?: string;
}

export interface RedditListing {
  data: {
    children: Array<{ data: RedditPostData }>;
    after?: string;
  };
}

export interface RedditCommentData {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  subreddit?: string;
  replies?: {
    data: {
      children: Array<{
        kind: string;
        data: RedditCommentData;
      }>;
    };
  };
}

export interface RedditThreadResponse {
  data: {
    children: Array<{ data: RedditPostData | RedditCommentData }>;
  };
}
