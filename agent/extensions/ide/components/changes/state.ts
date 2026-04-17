/**
 * Shared mutable state for the changes component.
 * All modules in this directory operate on this single instance.
 */

import type { Change, FileChange } from "../../types";
import type { GraphLayout } from "../graph";

interface SelectionState {
  selectedIndex: number;
  fileIndex: number;
  diffScroll: number;
  focus: "left" | "right";
}

interface LoadingState {
  loading: boolean;
  cachedLines: string[];
  cachedWidth: number;
}

interface ChangeCacheEntry {
  files: FileChange[];
  diffs: Map<string, string[]>;
}

/** Single mutable state instance — all mutations go through here. */
export class ChangesState {
  selectionState: SelectionState = {
    selectedIndex: 0,
    fileIndex: 0,
    diffScroll: 0,
    focus: "left" as const,
  };

  loadingState: LoadingState = {
    loading: false,
    cachedLines: [],
    cachedWidth: 0,
  };

  changes: Change[] = [];
  selectedChange: Change | null = null;
  currentChangeId: string | null = null;
  files: FileChange[] = [];
  diffContent: string[] = [];
  bookmarksByChange = new Map<string, string[]>();
  selectedChangeIds = new Set<string>();
  changeCache = new Map<string, ChangeCacheEntry>();
  graphLayout: GraphLayout | null = null;
  currentFilterIndex = 0;
  leftListHeight = 0;
  rightListHeight = 0;
  mode: "normal" | "move" = "normal";
  moveOriginalIndex = -1;
  moveOriginalChanges: Change[] = [];
}
