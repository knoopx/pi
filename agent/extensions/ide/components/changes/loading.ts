import type { ChangesState } from "./state";
import type { Change, FileChange } from "../../types";
import { REVISION_FILTERS } from "./types";
import { formatErrorMessage } from "../../lib/ui/footer";
import { calculateGraphLayout } from "../../lib/graph";

function hasConflictingFiles(files: FileChange[]): boolean {
  return files.some((f) => f.conflicted);
}

interface DataLoadingCallbacks {
  loadChanges: (revision: string) => Promise<Change[]>;
  getCurrentChangeIdShort: () => Promise<string | null>;
  loadBookmarksForChanges: (
    changes: Change[],
  ) => Promise<Map<string, string[]>>;
  loadChangedFiles: (changeId: string) => Promise<FileChange[]>;
  getRawDiff: (changeId: string, filePath?: string) => Promise<string>;
  renderDiffWithShiki: (diff: string) => Promise<string[]>;
  requestRender: () => void;
}

export function createDataLoading(
  state: ChangesState,
  callbacks: DataLoadingCallbacks,
) {
  async function reloadChanges(): Promise<void> {
    const previousSelectedChangeId = state.selectedChange?.changeId ?? null;
    try {
      await reloadChangesImpl(previousSelectedChangeId);
    } catch (error) {
      state.loadingState.loading = false;
      const msg = formatErrorMessage(error);
      state.diffContent = [`Error: ${msg}`];
      callbacks.requestRender();
    }
  }

  async function reloadChangesImpl(
    previousSelectedChangeId: string | null,
  ): Promise<void> {
    const filter = REVISION_FILTERS[state.currentFilterIndex];
    state.changes = await callbacks.loadChanges(filter.revision);
    state.currentChangeId = await callbacks.getCurrentChangeIdShort();

    await loadBookmarks(state.changes);
    state.loadingState.loading = false;

    if (state.changes.length === 0) {
      clearSelection();
    } else if (state.selectedChange?.changeId) {
      await handleSelectedChange();
    } else {
      await handleNewSelection(previousSelectedChangeId);
    }

    reloadGraphLayout();
    callbacks.requestRender();
  }

  async function loadBookmarks(changes: Change[]): Promise<void> {
    const bookmarksByChange = await callbacks.loadBookmarksForChanges(changes);
    state.bookmarksByChange.clear();
    for (const [changeId, bookmarks] of bookmarksByChange) {
      state.bookmarksByChange.set(changeId, bookmarks);
    }
  }

  function clearSelection(): void {
    state.selectionState.selectedIndex = 0;
    state.selectedChange = null;
    state.files = [];
    state.diffContent = [];
    state.graphLayout = null;
  }

  function updateConflictState(files: FileChange[]): void {
    if (state.selectedChange) {
      state.selectedChange.hasConflicts = hasConflictingFiles(files);
    }
  }

  async function handleSelectedChange(): Promise<void> {
    const matchedIndex = state.changes.findIndex(
      (c) => c.changeId === state.selectedChange?.changeId,
    );
    if (matchedIndex < 0) {
      state.selectionState.selectedIndex = 0;
      state.selectedChange = state.changes[0];
      await loadFilesAndDiff(state.selectedChange);
      return;
    }
    state.selectionState.selectedIndex = matchedIndex;
    state.selectedChange = state.changes[matchedIndex];
    state.files = await callbacks.loadChangedFiles(
      state.selectedChange.changeId,
    );
    updateConflictState(state.files);
    state.selectionState.fileIndex = Math.min(
      state.selectionState.fileIndex,
      state.files.length - 1,
    );
    const file = state.files[state.selectionState.fileIndex];
    if (file) {
      await loadDiff(state.selectedChange, file.path, {
        preserveScroll: true,
      });
    }
  }

  async function handleNewSelection(
    previousSelectedChangeId: string | null,
  ): Promise<void> {
    const preferredChangeId = state.currentChangeId ?? previousSelectedChangeId;
    const matchedIndex = preferredChangeId
      ? state.changes.findIndex((c) => c.changeId === preferredChangeId)
      : -1;
    state.selectionState.selectedIndex = matchedIndex >= 0 ? matchedIndex : 0;
    state.selectedChange = state.changes[state.selectionState.selectedIndex];
    await loadFilesAndDiff(state.selectedChange);
  }

  async function loadFilesAndDiff(change: Change): Promise<void> {
    if (!state.selectedChange) return;
    try {
      state.files = await callbacks.loadChangedFiles(change.changeId);
      updateConflictState(state.files);
      state.selectionState.fileIndex = 0;
      await loadDiff(change, state.files[0]?.path);
    } catch (error) {
      const msg = formatErrorMessage(error);
      state.files = [];
      state.diffContent = [`Error loading files: ${msg}`];
      callbacks.requestRender();
    }
  }

  async function loadDiff(
    change: Change,
    filePath?: string,
    options?: { preserveScroll?: boolean },
  ): Promise<void> {
    try {
      const diff = await callbacks.getRawDiff(change.changeId, filePath);
      state.diffContent = await callbacks.renderDiffWithShiki(diff);
      if (!options?.preserveScroll) state.selectionState.diffScroll = 0;
      callbacks.requestRender();
    } catch (error) {
      const msg = formatErrorMessage(error);
      state.diffContent = [`Error: ${msg}`];
      callbacks.requestRender();
    }
  }

  function getCachedFileCache(changeId: string): {
    hit: boolean;
    files?: FileChange[];
    cachedDiff?: string[] | undefined;
  } {
    const cache = state.changeCache.get(changeId);
    if (!cache) return { hit: false };
    const files = cache.files;
    const diffKey = files[0]?.path ?? "";
    return { hit: true, files, cachedDiff: cache.diffs.get(diffKey) };
  }

  async function refreshAfterMutation(): Promise<void> {
    await reloadChanges();
  }

  async function restoreSelectionAndDiff(prevIndex: number): Promise<void> {
    if (state.changes.length > 0) {
      state.selectionState.selectedIndex = Math.min(
        prevIndex,
        state.changes.length - 1,
      );
      state.selectedChange = state.changes[state.selectionState.selectedIndex];
      await loadFilesAndDiff(state.selectedChange);
    } else {
      state.selectionState.selectedIndex = 0;
      state.selectedChange = null;
      state.files = [];
      state.diffContent = [];
    }
  }

  function buildGraphInput(): {
    id: string;
    parentIds: string[];
    isWorkingCopy: boolean;
  }[] {
    const changeIdSet = new Set(state.changes.map((c) => c.changeId));
    return state.changes.map((c) => ({
      id: c.changeId,
      parentIds: (c.parentIds ?? []).filter((pid) => changeIdSet.has(pid)),
      isWorkingCopy:
        state.currentChangeId !== null && c.changeId === state.currentChangeId,
    }));
  }

  function reloadGraphLayout(): void {
    const input = buildGraphInput();
    state.graphLayout = calculateGraphLayout(input);
  }

  return {
    reloadChanges,
    refreshAfterMutation,
    restoreSelectionAndDiff,
    getCachedFileCache,
    loadFilesAndDiff,
    loadDiff,
  };
}
