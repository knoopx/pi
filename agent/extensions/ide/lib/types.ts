
export type WorkspaceStatus = "running" | "completed" | "failed" | "idle";


export interface AgentWorkspace {
  
  name: string;
  
  path: string;
  
  description: string;
  
  status: WorkspaceStatus;
  
  changeId: string;
  
  parentChangeId: string;
  
  createdAt: number;
  
  fileStats?: {
    added: number;
    modified: number;
    deleted: number;
  };
}


export interface WorkspaceListEntry {
  name: string;
  changeId: string;
  description: string;
}


export interface DiffStats {
  files: {
    path: string;
    status: "added" | "modified" | "deleted";
    insertions: number;
    deletions: number;
  }[];
  totalInsertions: number;
  totalDeletions: number;
}


export interface FileChange {
  status: string;
  path: string;
  insertions?: number;
  deletions?: number;
}


export interface Change {
  changeId: string;
  commitId: string;
  description: string;
  author?: string;
  timestamp?: string;
  empty: boolean;
  immutable: boolean;
  parentIds?: string[];
}


export type BookmarkFilterMode =
  | "all"
  | "bookmarks"
  | "descriptions"
  | "authors";

export type KeyPattern = string | (string & {});
