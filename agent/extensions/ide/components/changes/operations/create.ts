import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import type { FileChange, Change } from "../../../types";
import { splitFile } from "./split-file";
import { pushBookmarks, setBookmark, reloadBookmarks } from "./bookmark";
import { discardFile } from "./restore";
import { applyMoveMode, navigateMove } from "./move";

interface OperationsOptions {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  finish: () => void;
  refreshAfterMutation: () => Promise<void>;
  restoreSelection: (prevIndex: number) => Promise<void>;
  notify: (msg: string, type?: "info" | "error") => void;
  onBookmark?: (changeId: string) => Promise<string | null>;
  onFileCmAction?: (
    path: string,
    action: "inspect" | "deps" | "used-by",
  ) => void;
  requestRender: () => void;
  cancelMoveMode: () => void;
  navigateMove: (direction: "up" | "down") => void;
  onChangeSelected: (changeId: string) => void | Promise<void>;
  loadBookmarksForChanges: (
    changes: Change[],
  ) => Promise<Map<string, string[]>>;
  loadChangedFiles: (changeId: string) => Promise<FileChange[]>;
  getRawDiff: (changeId: string, filePath?: string) => Promise<string>;
  renderDiffWithShiki: (diff: string) => Promise<string[]>;
  loadChanges: (revision: string) => Promise<Change[]>;
}

export function createOperations(opts: OperationsOptions) {
  const { pi, cwd, state, refreshAfterMutation, notify } = opts;

  const splitCtx = {
    pi,
    cwd,
    state,
    refreshAfterMutation,
    notify,
    loadChangedFiles: opts.loadChangedFiles,
  };

  const bookmarkCtx = {
    pi,
    cwd,
    state,
    refreshAfterMutation,
    notify,
    onBookmark: opts.onBookmark,
    loadBookmarksForChanges: opts.loadBookmarksForChanges,
  };

  const restoreCtx = {
    pi,
    cwd,
    state,
    notify,
    loadChangedFiles: opts.loadChangedFiles,
    loadDiff: async (filePath: string) => {
      if (!state.selectedChange) return;
      try {
        const diff = await opts.getRawDiff(
          state.selectedChange.changeId,
          filePath,
        );
        state.diffContent = await opts.renderDiffWithShiki(diff);
        state.selectionState.diffScroll = 0;
        opts.requestRender();
      } catch (error) {
        const { formatErrorMessage } = await import("../../../lib/ui/footer");
        state.diffContent = [`Error: ${formatErrorMessage(error)}`];
        opts.requestRender();
      }
    },
  };

  const moveCtx = {
    pi,
    cwd,
    state,
    refreshAfterMutation,
    notify,
    requestRender: opts.requestRender,
    cancelMoveMode: opts.cancelMoveMode,
    navigateMove: opts.navigateMove,
    onChangeSelected: opts.onChangeSelected,
  };

  return {
    splitFile: () => splitFile(splitCtx),
    discardFile: () => discardFile(restoreCtx),
    pushBookmarks: () => pushBookmarks(bookmarkCtx),
    setBookmark: () => setBookmark(bookmarkCtx),
    applyMoveMode: () => applyMoveMode(moveCtx),
    navigateMove: () => navigateMove(moveCtx),
    reloadBookmarks: () => reloadBookmarks(bookmarkCtx),
  };
}
