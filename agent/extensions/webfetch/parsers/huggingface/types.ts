export interface HFRepo {
  kind: "model" | "dataset" | "space";
  owner: string;
  name: string;
}

export type HFPathType =
  | "repo"
  | "file"
  | "tree"
  | "discussions"
  | "discussion";

export interface HFPath extends HFRepo {
  type: HFPathType;
  revision?: string;
  path?: string;
  number?: number;
}

export interface HFTreeEntry {
  type: "file" | "directory";
  path: string;
  size?: number;
  lfs?: Record<string, unknown>;
}

export interface RepoBodyOptions {
  tags?: string[];
  downloads?: number;
  likes?: number;
  lastModified?: string;
  gated?: boolean | string;
  tagFilter?: (tag: string) => boolean;
  tagLimit?: number;
  extraDescription?: string;
}

export interface HFModelDetail extends Record<string, unknown> {
  id: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  cardData?: Record<string, unknown>;
  config?: { model_type?: string; architectures?: string[] };
  transformersInfo?: { auto_model?: string; processor?: string };
  "model-index"?: Array<{
    name?: string;
    results: Array<{
      dataset: { name: string };
      metrics: Array<{ type: string; name?: string; value: number }>;
    }>;
  }>;
  widgetData?: Array<{
    text?: string;
    messages?: Array<{ role: string; content: string }>;
  }>;
  usedStorage?: number;
  spaces?: string[];
  gated?: boolean | string;
  private?: boolean;
  disabled?: boolean;
  inference?: string;
  createdAt: string;
  lastModified?: string;
  sha: string;
}

export interface HFDiscussionEvent {
  id: string;
  type: string;
  author: {
    name: string;
    fullname?: string;
    type?: string;
    isPro?: boolean;
    isHf?: boolean;
  } | null;
  createdAt: string;
  data?: {
    edited?: boolean;
    hidden?: boolean;
    latest?: { raw?: string };
    status?: string;
    subject?: string;
    oid?: string;
    reactions?: Array<{ reaction: string; count: number }>;
  };
}

export interface HFDiscussionDetail {
  num: number;
  title: string;
  status: string;
  isPullRequest: boolean;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  author: {
    name: string;
    fullname?: string;
    type?: string;
    isPro?: boolean;
    isHf?: boolean;
  };
  org?: { name: string; fullname?: string; type: string; plan?: string };
  events: HFDiscussionEvent[];
}
