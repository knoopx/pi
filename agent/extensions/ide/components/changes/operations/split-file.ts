import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import type { FileChange, Change } from "../../../types";
import { getRepoRoot } from "../../../jj/files";
import { notifyMutation } from "../../../jj/core";
import { formatErrorMessage } from "../../../lib/ui/footer";

interface SplitFileContext {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  refreshAfterMutation: () => Promise<void>;
  notify: (msg: string, type?: "info" | "error") => void;
  loadChangedFiles: (changeId: string) => Promise<FileChange[]>;
}

export async function splitFile(ctx: SplitFileContext): Promise<void> {
  const file = getSelectedFile(ctx.state);
  if (!file || !ctx.state.selectedChange) return;
  try {
    const msg = buildSplitMessage(file, ctx.state.selectedChange);
    const repoRoot = await getRepoRoot(ctx.pi, ctx.cwd);
    const splitResult = await executeSplit(ctx, repoRoot, file, msg);
    await restoreSelectionAfterSplit(ctx, splitResult, msg);
  } catch (error) {
    ctx.notify(`Failed to split file: ${formatErrorMessage(error)}`, "error");
  }
}

function getSelectedFile(state: ChangesState): FileChange | undefined {
  if (!state.selectedChange) return undefined;
  return state.files[state.selectionState.fileIndex];
}

function buildSplitMessage(
  file: { path: string },
  selectedChange: Change,
): string {
  return `Moved ${file.path} from change ${selectedChange.changeId.slice(0, 8)} to a new change`;
}

async function executeSplit(
  ctx: SplitFileContext,
  repoRoot: string,
  file: { path: string },
  msg: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const changeId = ctx.state.selectedChange?.changeId;
  if (!changeId) throw new Error("No selected change");
  return ctx.pi.exec(
    "jj",
    ["split", "-m", msg, "-r", changeId, "--insert-after", changeId, file.path],
    { cwd: repoRoot },
  );
}

async function restoreSelectionAfterSplit(
  ctx: SplitFileContext,
  splitResult: { stderr: string; stdout: string },
  msg: string,
): Promise<void> {
  const previous = capturePreviousState(ctx.state);
  if (!previous) return;

  ctx.state.changeCache.clear();
  await ctx.refreshAfterMutation();
  const restoredIndex = stateFindRestoredChangeIndex(
    ctx.state,
    previous.changeId,
  );
  if (restoredIndex < 0) return;

  applyRestoredSelection(ctx.state, restoredIndex, previous.fileIndex);
  await finalizeRestoration(ctx, splitResult, msg);
}

function capturePreviousState(
  state: ChangesState,
): { changeId: string; fileIndex: number } | null {
  const selectedChange = state.selectedChange;
  if (!selectedChange) return null;
  return {
    changeId: selectedChange.changeId,
    fileIndex: state.selectionState.fileIndex,
  };
}

function stateFindRestoredChangeIndex(
  state: ChangesState,
  prevChangeId: string,
): number {
  return state.changes.findIndex((c) => c.changeId === prevChangeId);
}

function applyRestoredSelection(
  state: ChangesState,
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

async function finalizeRestoration(
  ctx: SplitFileContext,
  splitResult: { stderr: string; stdout: string },
  msg: string,
): Promise<void> {
  if (!ctx.state.selectedChange) return;
  const prevFileIndex = ctx.state.selectionState.fileIndex;
  ctx.state.files = await ctx.loadChangedFiles(
    ctx.state.selectedChange.changeId,
  );
  selectFileByAdjustedIndex(ctx.state, prevFileIndex);
  notifyMutation(ctx.pi, msg, splitResult.stderr || splitResult.stdout);
}

function selectFileByAdjustedIndex(
  state: ChangesState,
  prevIndex: number,
): void {
  const adjustedIndex = Math.max(
    0,
    Math.min(prevIndex, state.files.length - 1),
  );
  state.selectionState.fileIndex = adjustedIndex;
}
