import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ChangesState } from "./state";
import type { FileChange, Change } from "../../lib/types";
import { formatErrorMessage } from "../../lib/footer";
import { restoreFile } from "../../jj/files";
import { getRepoRoot } from "../../jj/files";
import { notifyMutation } from "../../jj/core";

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

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function createOperations(opts: OperationsOptions) {
  const { pi, cwd, state, refreshAfterMutation, notify } = opts;

  function getSelectedFile(): FileChange | undefined {
    if (!state.selectedChange) return undefined;
    return state.files[state.selectionState.fileIndex];
  }

  function buildSplitMessage(
    file: { path: string },
    selectedChange: Change,
  ): string {
    return `Moved ${file.path} from change ${selectedChange.changeId.slice(0, 8)} to a new change`;
  }

  async function splitFile(): Promise<void> {
    const file = getSelectedFile();
    if (!file || !state.selectedChange) return;
    try {
      const msg = buildSplitMessage(file, state.selectedChange);
      const repoRoot = await getRepoRoot(pi, cwd);
      const splitResult = await executeSplit(repoRoot, file, msg);
      await restoreSelectionAfterSplit(splitResult, msg);
    } catch (error) {
      notify(`Failed to split file: ${formatErrorMessage(error)}`, "error");
    }
  }

  function executeSplit(
    repoRoot: string,
    file: { path: string },
    msg: string,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const changeId = state.selectedChange?.changeId;
    if (!changeId) throw new Error("No selected change");
    return pi.exec(
      "jj",
      [
        "split",
        "-m",
        msg,
        "-r",
        changeId,
        "--insert-after",
        changeId,
        file.path,
      ],
      { cwd: repoRoot },
    );
  }

  function capturePreviousState(): {
    changeId: string;
    fileIndex: number;
  } | null {
    const selectedChange = state.selectedChange;
    if (!selectedChange) return null;
    return {
      changeId: selectedChange.changeId,
      fileIndex: state.selectionState.fileIndex,
    };
  }

  async function finalizeRestoration(
    splitResult: { stderr: string; stdout: string },
    msg: string,
  ): Promise<void> {
    if (!state.selectedChange) return;
    const prevFileIndex = state.selectionState.fileIndex;
    state.files = await loadChangedFiles(state.selectedChange.changeId);
    selectFileByAdjustedIndex(prevFileIndex);
    notifyMutation(pi, msg, splitResult.stderr || splitResult.stdout);
  }

  async function restoreSelectionAfterSplit(
    splitResult: { stderr: string; stdout: string },
    msg: string,
  ): Promise<void> {
    const previous = capturePreviousState();
    if (!previous) return;

    state.changeCache.clear();
    await refreshAfterMutation();
    const restoredIndex = findRestoredChangeIndex(previous.changeId);
    if (restoredIndex < 0) return;

    applyRestoredSelection(restoredIndex, previous.fileIndex);
    await finalizeRestoration(splitResult, msg);
  }

  function findRestoredChangeIndex(prevChangeId: string): number {
    return state.changes.findIndex((c) => c.changeId === prevChangeId);
  }

  function applyRestoredSelection(
    restoredIndex: number,
    prevFileIndex: number,
  ): void {
    state.selectionState.selectedIndex = restoredIndex;
    state.selectedChange = state.changes[restoredIndex];
    state.selectionState.fileIndex = Math.min(
      prevFileIndex,
      state.files.length - 1,
    );
    state.selectionState.diffScroll = 0;
  }

  async function pushBookmarks(): Promise<void> {
    if (!state.selectedChange) return;
    const bookmarks = getBookmarksForSelectedChange();
    if (bookmarks.length === 0) return;

    try {
      const outputs = await pushBookmarksToRemote(bookmarks);
      await refreshAfterMutation();
      const msg = `Pushed bookmark${pluralize(bookmarks.length, "", "s")}: ${bookmarks.join(", ")}`;
      notifyMutation(pi, msg, outputs.join("\n"));
    } catch (error) {
      notify(`Failed to push: ${formatErrorMessage(error)}`, "error");
    }
  }

  function getBookmarksForSelectedChange(): string[] {
    if (!state.selectedChange) return [];
    return state.bookmarksByChange.get(state.selectedChange.changeId) ?? [];
  }

  async function pushBookmarksToRemote(bookmarks: string[]): Promise<string[]> {
    const outputs: string[] = [];
    for (const bookmark of bookmarks) {
      const r = await pi.exec("jj", ["git", "push", "-b", bookmark], {
        cwd,
      });
      outputs.push(r.stderr || r.stdout);
    }
    return outputs;
  }

  async function setBookmark(): Promise<void> {
    if (!canSetBookmark()) return;
    try {
      const result = await promptAndApplyBookmark();
      if (!result) return;
      await reloadBookmarks();
      notifyBookmarkSet(result.bookmarkName, result.changeId);
    } catch (error) {
      notify(
        `Failed to update bookmark: ${formatErrorMessage(error)}`,
        "error",
      );
    }
  }

  function canSetBookmark(): boolean {
    return !!(state.selectedChange && opts.onBookmark);
  }

  async function promptAndApplyBookmark(): Promise<{
    bookmarkName: string;
    changeId: string;
  } | null> {
    const change = state.selectedChange;
    if (!change || !opts.onBookmark) return null;
    const bookmarkName = await opts.onBookmark(change.changeId);
    if (!bookmarkName) return null;
    return { bookmarkName, changeId: change.changeId };
  }

  function notifyBookmarkSet(bookmarkName: string, changeId: string): void {
    const msg = `Updated bookmark '${bookmarkName}' to ${changeId}`;
    notifyMutation(
      pi,
      msg,
      `Set bookmark '${bookmarkName}' to ${changeId.slice(0, 8)}`,
    );
  }

  async function tryRestoreFile(
    file: FileChange,
    selectedChange: Change,
  ): Promise<string | undefined> {
    try {
      return await restoreAndClearCache(file, selectedChange);
    } catch (error) {
      notify(`Failed to discard file: ${formatErrorMessage(error)}`, "error");
      return undefined;
    }
  }

  async function discardFile(): Promise<void> {
    const file = getSelectedFile();
    if (!file || !state.selectedChange) return;

    const prevFileIndex = state.selectionState.fileIndex;
    const restoreOutput = await tryRestoreFile(file, state.selectedChange!);
    if (restoreOutput === undefined) return;

    await refreshFilesAndSelection(prevFileIndex, state.selectedChange!);
    notifyMutation(
      pi,
      buildRestoreMessage(file, state.selectedChange!),
      restoreOutput,
    );
  }

  function buildRestoreMessage(
    file: { path: string },
    selectedChange: Change,
  ): string {
    const id = selectedChange.changeId.slice(0, 8);
    return `Restored file ${file.path} in change ${id}`;
  }

  async function restoreAndClearCache(
    file: FileChange,
    selectedChange: Change,
  ): Promise<string | undefined> {
    const { changeId } = selectedChange;
    const restoreOutput = await restoreFile(pi, cwd, changeId, file.path);
    state.changeCache.delete(changeId);
    return restoreOutput;
  }

  function selectFileByAdjustedIndex(prevIndex: number): void {
    const adjustedIndex = Math.max(
      0,
      Math.min(prevIndex, state.files.length - 1),
    );
    state.selectionState.fileIndex = adjustedIndex;
    const selectedFile = state.files[adjustedIndex];
    if (selectedFile) {
      void loadDiff(selectedFile.path);
    } else {
      state.diffContent = [];
    }
  }

  async function refreshFilesAndSelection(
    prevIndex: number,
    selectedChange: Change,
  ): Promise<void> {
    const { changeId } = selectedChange;
    state.files = await loadChangedFiles(changeId);
    selectFileByAdjustedIndex(prevIndex);
  }

  async function applyMoveMode(): Promise<void> {
    if (state.mode !== "move") {
      return;
    }
    const currentIndex = state.selectionState.selectedIndex;
    if (currentIndex === state.moveOriginalIndex) {
      state.mode = "normal";
      opts.requestRender();
      return;
    }

    try {
      await performRebase();
      state.mode = "normal";
      state.changeCache.clear();
      await refreshAfterMutation();
    } catch (error) {
      notify(`Failed to move: ${formatErrorMessage(error)}`, "error");
      opts.cancelMoveMode();
    }
  }

  async function performRebase(): Promise<void> {
    if (!state.selectedChange) return;
    const plan = resolveRebasePlan();
    if (!plan) return;
    const change = state.selectedChange;
    const result = await pi.exec(
      "jj",
      ["rebase", "-r", change.changeId, plan.flag, plan.targetChangeId],
      { cwd },
    );

    notifyMutation(
      pi,
      `Moved change ${change.changeId.slice(0, 8)} after ${plan.targetChangeId}`,
      pickOutput(result.stderr, result.stdout),
    );
  }

  function resolveRebasePlan(): {
    targetChangeId: string;
    flag: string;
  } | null {
    const { currentIndex, originalIndex } = getRebaseOffsets();
    const { targetChange, flag } = resolveRebaseTarget(
      currentIndex,
      originalIndex,
    );
    if (!targetChange) return null;
    return { targetChangeId: targetChange.changeId.slice(0, 8), flag };
  }

  function getRebaseOffsets(): {
    currentIndex: number;
    originalIndex: number;
  } {
    return {
      currentIndex: state.selectionState.selectedIndex,
      originalIndex: state.moveOriginalIndex,
    };
  }

  function resolveRebaseTarget(
    currentIndex: number,
    originalIndex: number,
  ): { targetChange: Change | null; flag: string } {
    const goingUp = currentIndex < originalIndex;
    const target = state.changes[goingUp ? currentIndex + 1 : currentIndex - 1];
    return {
      targetChange: target ?? null,
      flag: goingUp ? "--after" : "--before",
    };
  }

  function navigateMove(direction: "up" | "down"): void {
    try {
      opts.navigateMove(direction);
      const change = state.changes[state.selectionState.selectedIndex];
      if (change) {
        state.selectedChange = change;
        const result = opts.onChangeSelected(change.changeId);
        if (result instanceof Promise) {
          void result.catch((error) => {
            notify(
              `onChangeSelected failed: ${formatErrorMessage(error)}`,
              "error",
            );
          });
        }
      }
    } catch (error) {
      notify(
        `Changes component update failed: ${formatErrorMessage(error)}`,
        "error",
      );
    }
    opts.requestRender();
  }

  async function reloadBookmarks(): Promise<void> {
    const bookmarksByChange = await opts.loadBookmarksForChanges(state.changes);
    state.bookmarksByChange.clear();
    for (const [changeId, bookmarks] of bookmarksByChange) {
      state.bookmarksByChange.set(changeId, bookmarks);
    }
  }

  async function loadChangedFiles(changeId: string): Promise<FileChange[]> {
    return opts.loadChangedFiles(changeId);
  }

  async function loadDiff(filePath: string): Promise<void> {
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
      const msg = formatErrorMessage(error);
      state.diffContent = [`Error: ${msg}`];
      opts.requestRender();
    }
  }

  return {
    splitFile,
    discardFile,
    pushBookmarks,
    setBookmark,
    applyMoveMode,
    navigateMove,
  };
}

function pickOutput(stderr: string, stdout: string): string {
  if (stderr) return stderr;
  return stdout || "";
}
