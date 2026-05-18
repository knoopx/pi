import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ChangesState } from "../state";
import type { FileChange, Change } from "../../../types";
import { restoreFile } from "../../../jj/files";

import { formatErrorMessage } from "../../../lib/ui/footer";

interface RestoreFileContext {
  pi: ExtensionAPI;
  cwd: string;
  state: ChangesState;
  notify: (msg: string, type?: "info" | "error") => void;
  loadChangedFiles: (changeId: string) => Promise<FileChange[]>;
  loadDiff: (filePath: string) => Promise<void>;
}

export async function discardFile(ctx: RestoreFileContext): Promise<void> {
  const file = getSelectedFile(ctx.state);
  if (!file || !ctx.state.selectedChange) return;

  const prevFileIndex = ctx.state.selectionState.fileIndex;
  const restoreOutput = await tryRestoreFile(
    ctx,
    file,
    ctx.state.selectedChange,
  );
  if (restoreOutput === undefined) return;

  await refreshFilesAndSelection(ctx, prevFileIndex, ctx.state.selectedChange);
  ctx.notify(buildRestoreMessage(file, ctx.state.selectedChange));
}

function getSelectedFile(state: ChangesState): FileChange | undefined {
  if (!state.selectedChange) return undefined;
  return state.files[state.selectionState.fileIndex];
}

function buildRestoreMessage(
  file: { path: string },
  selectedChange: Change,
): string {
  const id = selectedChange.changeId.slice(0, 8);
  return `Restored file ${file.path} in change ${id}`;
}

async function tryRestoreFile(
  ctx: RestoreFileContext,
  file: FileChange,
  selectedChange: Change,
): Promise<string | undefined> {
  try {
    return await restoreAndClearCache(ctx, file, selectedChange);
  } catch (error) {
    ctx.notify(`Failed to discard file: ${formatErrorMessage(error)}`, "error");
    return undefined;
  }
}

async function restoreAndClearCache(
  ctx: RestoreFileContext,
  file: FileChange,
  selectedChange: Change,
): Promise<string | undefined> {
  const { changeId } = selectedChange;
  const restoreOutput = await restoreFile(ctx.pi, ctx.cwd, changeId, file.path);
  ctx.state.changeCache.delete(changeId);
  return restoreOutput;
}

async function refreshFilesAndSelection(
  ctx: RestoreFileContext,
  prevIndex: number,
  selectedChange: Change,
): Promise<void> {
  const { changeId } = selectedChange;
  ctx.state.files = await ctx.loadChangedFiles(changeId);
  selectFileByAdjustedIndex(ctx, prevIndex);
}

function selectFileByAdjustedIndex(
  ctx: RestoreFileContext,
  prevIndex: number,
): void {
  const adjustedIndex = Math.max(
    0,
    Math.min(prevIndex, ctx.state.files.length - 1),
  );
  ctx.state.selectionState.fileIndex = adjustedIndex;
  const selectedFile = ctx.state.files[adjustedIndex];
  if (selectedFile) {
    void ctx.loadDiff(selectedFile.path);
  } else {
    ctx.state.diffContent = [];
  }
}
