import type { ListPickerItem } from "../../lib/list-picker";


export interface PullRequest extends ListPickerItem {
  number: number;
  title: string;
  state: string;
  isDraft: boolean;
  author: string;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  reviewDecision: string | null;
  url: string;
  body: string;
}

export type PrStateColor = "success" | "error" | "accent" | "dim";
