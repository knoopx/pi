export interface HNItem {
  id: number;
  type: "story" | "comment" | "job" | "poll" | "unknown";
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  text?: string;
  kids?: number[];
  dead?: boolean;
  deleted?: boolean;
}

export interface HNUser {
  id: string;
  about?: string;
  created?: number;
  karma?: number;
  submitted?: number[];
}

export type StoryKind = "top" | "new" | "best" | "ask" | "show" | "jobs";

export interface ParsedHNUrl {
  kind:
    | "stories"
    | "item"
    | "user"
    | "saved"
    | "upvoted"
    | "submitted"
    | "search"
    | "firebase";
  storyKind?: StoryKind;
  itemId?: number;
  username?: string;
  query?: string;
  firebasePath?: string;
  limit?: number;
}
