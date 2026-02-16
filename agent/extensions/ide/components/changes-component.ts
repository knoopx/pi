import path from "node:path";
import { matchesKey } from "@mariozechner/pi-tui";
import { ensureWidth, formatChangeRow, truncateAnsi } from "./utils";
import {
  calculateDimensions,
  calculateDiffScroll,
  renderSplitPanel,
  renderDiffRows,
  renderFileChangeRows,
  formatErrorMessage,
} from "./split-panel";
import {
  createComponentCache,
  createSelectionState,
  createLoadingState,
  invalidateCache,
  renderLoadingRow,
  renderEmptyState,
  buildNavigationHelp,
  createStatusNotifier,
  formatHelpWithStatus,
  type ComponentCache,
  type BaseComponentParams,
  type StatusMessageState,
} from "./shared-utils";
import type { FileChange, MutableChange } from "../types";
import {
  loadMutableChanges,
  loadChangedFiles,
  getDiff,
  restoreFile,
  listBookmarksByChange,
} from "../jj";
import type { CmActionType } from "./cm-results-component";

type ChangeCache = ComponentCache<FileChange>;

/** File cm action callback */
export type OnFileCmAction = (
  filePath: string,
  action: CmActionType,
) => Promise<void>;

export function createChangesComponent(
  { pi, tui, theme, cwd }: BaseComponentParams,
  done: () => void,
  onInsert?: (text: string) => void,
  onBookmark?: (changeId: string) => Promise<string | null>,
  onFileCmAction?: OnFileCmAction,
) {
  let changes: MutableChange[] = [];
  let selectedChange: MutableChange | null = null;
  let files: FileChange[] = [];
  let diffContent: string[] = [];
  let bookmarksByChange = new Map<string, string[]>();
  const selectedChangeIds = new Set<string>();
  const changeCache = new Map<string, ChangeCache>();

  // Use shared state objects
  const selectionState = createSelectionState();
  const loadingState = createLoadingState();
  const statusState: StatusMessageState = { message: null, timeout: null };

  const notify = createStatusNotifier(statusState, () => {
    invalidateCache(loadingState);
    tui.requestRender();
  });

  // Navigation handlers - defined inline to access current array values
  function navigateChanges(direction: "up" | "down"): void {
    if (changes.length === 0) {
      return;
    }

    const maxIndex = changes.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, selectionState.selectedIndex - 1)
        : Math.min(maxIndex, selectionState.selectedIndex + 1);

    if (newIndex !== selectionState.selectedIndex) {
      selectionState.selectedIndex = newIndex;
      selectedChange = changes[newIndex];
      void loadFilesAndDiff(selectedChange);
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  function navigateFiles(direction: "up" | "down"): void {
    if (files.length === 0 || selectedChange === null) {
      return;
    }

    const maxIndex = files.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, selectionState.fileIndex - 1)
        : Math.min(maxIndex, selectionState.fileIndex + 1);

    if (newIndex !== selectionState.fileIndex) {
      selectionState.fileIndex = newIndex;
      const file = files[newIndex];
      void loadDiff(selectedChange, file.path);
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  function scrollDiff(direction: "up" | "down"): void {
    selectionState.diffScroll = calculateDiffScroll(
      direction,
      selectionState.diffScroll,
      diffContent.length,
      tui.terminal.rows,
      loadingState.cachedWidth,
    );
    invalidateCache(loadingState);
    tui.requestRender();
  }

  function switchFocus(): void {
    selectionState.focus = selectionState.focus === "left" ? "right" : "left";
    invalidateCache(loadingState);
    tui.requestRender();
  }

  function getDescribeTargets(): MutableChange[] {
    if (selectedChangeIds.size > 0) {
      return changes.filter((change) => selectedChangeIds.has(change.changeId));
    }
    return selectedChange ? [selectedChange] : [];
  }

  async function executeAction(action: string): Promise<void> {
    const change = selectedChange;

    try {
      switch (action) {
        case "describe": {
          const targets = getDescribeTargets();
          if (targets.length === 0) {
            return;
          }

          done();
          const ids = targets.map((target) => target.changeId);
          const workflowLines = ids
            .map(
              (id, index) =>
                `${String(index + 1)}. Check changed files: \`jj diff --name-only -r ${id}\`\n   If needed for context, inspect patch: \`jj diff --git --color never -r ${id}\`\n   Describe: \`jj desc -r ${id} -m "type(scope): <icon> short description"\``,
            )
            .join("\n");

          const task = `Describe jujutsu changes ${ids.join(", ")} using conventional commit format.

Use the **conventional-commits** skill for type/scope rules.

<format>
\`type(scope): <icon> short description\`

Types: feat, fix, docs, style, refactor, perf, test, chore
</format>

<workflow>
${workflowLines}
</workflow>`;
          pi.sendUserMessage(task);
          return;
        }

        case "edit": {
          if (!change) return;
          done();
          await pi.exec("jj", ["edit", change.changeId], { cwd });
          return;
        }

        case "split": {
          if (!change) return;
          done();
          const task = `Split jujutsu change ${change.changeId} into semantically logical commits.

<workflow>
1. Analyze: \`jj diff -r ${change.changeId} --name-only\`
2. Identify logical groupings by domain/purpose
3. Split iteratively: \`jj split -r ${change.changeId} "<file-pattern>" -m "type(scope): description"\`
4. Update remaining change description: \`jj desc -r ${change.changeId} -m "type(scope): description"\`
</workflow>

Use the **conventional-commits** skill for commit message format.`;
          pi.sendUserMessage(task);
          return;
        }

        case "squash": {
          if (!change) return;
          const prevIndex = selectionState.selectedIndex;
          await pi.exec("jj", ["squash", "-u", "-r", change.changeId], { cwd });
          changeCache.clear();
          selectionState.fileIndex = 0;
          selectionState.diffScroll = 0;
          await loadChanges();
          if (changes.length > 0) {
            selectionState.selectedIndex = Math.min(
              prevIndex,
              changes.length - 1,
            );
            selectedChange = changes[selectionState.selectedIndex];
            await loadFilesAndDiff(selectedChange);
          } else {
            selectionState.selectedIndex = 0;
            selectedChange = null;
            files = [];
            diffContent = [];
          }
          return;
        }

        case "drop": {
          if (!change) return;
          const prevIndex = selectionState.selectedIndex;
          await pi.exec("jj", ["abandon", change.changeId], { cwd });
          selectedChangeIds.delete(change.changeId);
          changeCache.clear();
          selectionState.fileIndex = 0;
          selectionState.diffScroll = 0;
          await loadChanges();
          if (changes.length > 0) {
            selectionState.selectedIndex = Math.min(
              prevIndex,
              Math.max(0, changes.length - 1),
            );
            selectedChange = changes[selectionState.selectedIndex];
            await loadFilesAndDiff(selectedChange);
          } else {
            selectionState.selectedIndex = 0;
            selectedChange = null;
            files = [];
            diffContent = [];
          }
          notify(`Dropped change ${change.changeId}`, "info");
          return;
        }
      }
    } catch (error) {
      const msg = formatErrorMessage(error);
      diffContent = [`Error: ${msg}`];
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  async function reloadBookmarks(): Promise<void> {
    const bookmarkEntries = await listBookmarksByChange(pi, cwd);
    const nextBookmarksByChange = new Map<string, string[]>();
    for (const change of changes) {
      const bookmarks = bookmarkEntries
        .filter(
          (entry) =>
            change.changeId.startsWith(entry.changeId) ||
            entry.changeId.startsWith(change.changeId),
        )
        .map((entry) => entry.bookmark);
      nextBookmarksByChange.set(change.changeId, bookmarks);
    }
    bookmarksByChange = nextBookmarksByChange;
  }

  async function loadChanges(): Promise<void> {
    try {
      changes = await loadMutableChanges(pi, cwd);
      await reloadBookmarks();

      const existingIds = new Set(changes.map((change) => change.changeId));
      for (const changeId of selectedChangeIds) {
        if (!existingIds.has(changeId)) {
          selectedChangeIds.delete(changeId);
        }
      }

      loadingState.loading = false;

      if (changes.length > 0) {
        selectedChange = changes[0];
        await loadFilesAndDiff(selectedChange);
      }

      invalidateCache(loadingState);
      tui.requestRender();
    } catch (error) {
      loadingState.loading = false;
      const msg = formatErrorMessage(error);
      diffContent = [`Error: ${msg}`];
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  async function loadFilesAndDiff(change: MutableChange): Promise<void> {
    try {
      let cache = changeCache.get(change.changeId);
      if (cache) {
        files = cache.files;
        selectionState.fileIndex = 0;
        const diffKey = files[0]?.path ?? "";
        const cachedDiff = cache.diffs.get(diffKey);
        if (cachedDiff) {
          diffContent = cachedDiff;
          selectionState.diffScroll = 0;
          invalidateCache(loadingState);
          tui.requestRender();
          return;
        }
      }

      if (!cache) {
        files = await loadChangedFiles(pi, cwd, change.changeId);
        cache = createComponentCache(files);
        changeCache.set(change.changeId, cache);
      }

      selectionState.fileIndex = 0;
      await loadDiff(change, files[0]?.path);
    } catch (error) {
      const msg = formatErrorMessage(error);
      files = [];
      diffContent = [`Error loading files: ${msg}`];
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  async function loadDiff(
    change: MutableChange,
    filePath?: string,
  ): Promise<void> {
    const diffKey = filePath ?? "";

    const cache = changeCache.get(change.changeId);
    if (cache) {
      const cachedDiff = cache.diffs.get(diffKey);
      if (cachedDiff) {
        diffContent = cachedDiff;
        selectionState.diffScroll = 0;
        invalidateCache(loadingState);
        tui.requestRender();
        return;
      }
    }

    try {
      diffContent = await getDiff(pi, cwd, change.changeId, filePath);
      selectionState.diffScroll = 0;

      if (cache) {
        cache.diffs.set(diffKey, diffContent);
      }

      invalidateCache(loadingState);
      tui.requestRender();
    } catch (error) {
      const msg = formatErrorMessage(error);
      diffContent = [`Error: ${msg}`];
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  function getChangeRows(width: number, height: number): string[] {
    if (loadingState.loading) {
      return [renderLoadingRow(width)];
    }

    if (changes.length === 0) {
      return renderEmptyState(
        width,
        "No changes on branch",
        "All changes are immutable",
      );
    }

    const rows: string[] = [];
    const visibleCount = height;
    let startIdx = 0;
    if (selectionState.selectedIndex >= visibleCount) {
      startIdx = selectionState.selectedIndex - visibleCount + 1;
    }

    for (let i = 0; i < visibleCount && startIdx + i < changes.length; i++) {
      const idx = startIdx + i;
      const change = changes[idx];
      const isCursor = idx === selectionState.selectedIndex;
      const isFocusedCursor = isCursor && selectionState.focus === "left";
      const isMarked = selectedChangeIds.has(change.changeId);
      const isWorkingCopy = idx === 0; // First change is @ (working copy)

      const bookmarks = bookmarksByChange.get(change.changeId) ?? [];
      const { leftText } = formatChangeRow(theme, {
        isWorkingCopy,
        isEmpty: change.empty,
        isSelected: isMarked,
        isFocused: isCursor,
        bookmarks,
        description: change.description,
      });

      const leftTruncated = truncateAnsi(leftText, width);
      const line = ensureWidth(leftTruncated, width);
      rows.push(line);
    }

    return rows;
  }

  function getFileRows(width: number, height: number): string[] {
    return renderFileChangeRows(
      files,
      width,
      height,
      selectionState.fileIndex,
      selectionState.focus === "right",
      theme,
    );
  }

  function render(width: number): string[] {
    if (
      loadingState.cachedWidth === width &&
      loadingState.cachedLines.length > 0
    ) {
      return loadingState.cachedLines;
    }

    const dims = calculateDimensions(tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: selectionState.focus === "left",
      rightFocus: selectionState.focus === "right",
      leftRatio: 0.28,
      rightSplit: true,
      rightTopRatio: 0.3,
    });

    const leftTitle = ` Changes (${String(changes.length)})`;
    const rightTopTitle = " Files";
    const rightBottomTitle = selectedChange
      ? ` Diff: ${files[selectionState.fileIndex]?.path ?? "all"} (${selectedChange.changeId.slice(0, 8)})`
      : " Diff";

    const changeRows = getChangeRows(dims.leftW, dims.contentH);
    const fileRows = getFileRows(dims.rightW, dims.rightTopH ?? 5);
    const diffRows = renderDiffRows(
      diffContent,
      dims.rightW,
      dims.rightBottomH ?? 10,
      selectionState.diffScroll,
      theme,
    );

    const describeTargetCount =
      selectedChangeIds.size || (selectedChange ? 1 : 0);
    const helpText = formatHelpWithStatus(
      theme,
      statusState.message,
      buildNavigationHelp(
        selectionState.focus,
        [
          "space select",
          selectedChange && "e edit",
          describeTargetCount > 0 &&
            `d describe(${String(describeTargetCount)})`,
          selectedChange && "s split",
          selectedChange &&
            changes.length > 1 &&
            selectionState.selectedIndex < changes.length - 1 &&
            "f fixup",
          selectedChange && onInsert && "i insert",
          selectedChange && onBookmark && "b bookmark",
          selectedChange && "ctrl+d drop",
        ].filter(Boolean) as string[],
        [
          files.length > 0 && "e edit",
          files.length > 0 && "d discard",
          files.length > 0 && onFileCmAction && "ctrl+i inspect",
          files.length > 0 && onFileCmAction && "ctrl+d deps",
          files.length > 0 && onFileCmAction && "ctrl+u used-by",
          "pgup/pgdn scroll",
        ].filter(Boolean) as string[],
      ),
    );

    loadingState.cachedLines = renderSplitPanel(
      theme,
      {
        leftTitle,
        rightTitle: rightTopTitle,
        rightTopTitle,
        rightBottomTitle,
        helpText,
        leftFocus: selectionState.focus === "left",
        rightFocus: selectionState.focus === "right",
        rightSplit: true,
      },
      dims,
      {
        left: changeRows,
        rightTop: fileRows,
        rightBottom: diffRows,
      },
    );

    loadingState.cachedWidth = width;
    return loadingState.cachedLines;
  }

  function handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q") {
      done();
      return;
    }

    if (matchesKey(data, "tab")) {
      switchFocus();
      return;
    }

    if (data === "e") {
      if (selectionState.focus === "right" && files[selectionState.fileIndex]) {
        const file = files[selectionState.fileIndex];
        void pi.exec("code", [path.join(cwd, file.path)]);
      } else if (selectionState.focus === "left" && selectedChange) {
        void executeAction("edit");
      }
      return;
    }

    if (data === "d" && selectionState.focus === "left") {
      if (selectedChange || selectedChangeIds.size > 0) {
        void executeAction("describe");
      }
      return;
    }

    if (data === "s" && selectionState.focus === "left") {
      if (selectedChange) {
        void executeAction("split");
      }
      return;
    }

    if (data === " " && selectionState.focus === "left") {
      if (selectedChange) {
        if (selectedChangeIds.has(selectedChange.changeId)) {
          selectedChangeIds.delete(selectedChange.changeId);
        } else {
          selectedChangeIds.add(selectedChange.changeId);
        }
        invalidateCache(loadingState);
        tui.requestRender();
      }
      return;
    }

    if (data === "f") {
      if (
        selectedChange &&
        changes.length > 1 &&
        selectionState.selectedIndex < changes.length - 1
      ) {
        void executeAction("squash");
      }
      return;
    }

    if (selectionState.focus === "left" && matchesKey(data, "ctrl+d")) {
      if (selectedChange) {
        void executeAction("drop");
      }
      return;
    }

    if (data === "i") {
      if (selectedChange && onInsert) {
        onInsert(selectedChange.changeId);
        done();
      }
      return;
    }

    if (data === "b" && selectionState.focus === "left") {
      if (selectedChange && onBookmark) {
        void (async () => {
          try {
            const bookmarkName = await onBookmark(selectedChange.changeId);
            if (!bookmarkName) {
              return;
            }
            await reloadBookmarks();
            invalidateCache(loadingState);
            tui.requestRender();
            notify(
              `Updated bookmark '${bookmarkName}' to ${selectedChange.changeId}`,
              "info",
            );
          } catch (error) {
            notify(
              `Failed to update bookmark: ${formatErrorMessage(error)}`,
              "error",
            );
          }
        })();
      }
      return;
    }

    if (selectionState.focus === "left") {
      if (matchesKey(data, "up")) {
        navigateChanges("up");
      } else if (matchesKey(data, "down")) {
        navigateChanges("down");
      }
    } else {
      if (data === "d" && selectedChange && files[selectionState.fileIndex]) {
        const file = files[selectionState.fileIndex];
        void (async () => {
          try {
            await restoreFile(pi, cwd, selectedChange.changeId, file.path);
            changeCache.delete(selectedChange.changeId);
            await loadFilesAndDiff(selectedChange);
          } catch (error) {
            notify(
              `Failed to discard file: ${formatErrorMessage(error)}`,
              "error",
            );
          }
        })();
        return;
      }

      // cm actions on files
      if (onFileCmAction && files[selectionState.fileIndex]) {
        const file = files[selectionState.fileIndex];
        if (matchesKey(data, "ctrl+i")) {
          void onFileCmAction(file.path, "inspect");
          return;
        }
        if (matchesKey(data, "ctrl+d")) {
          void onFileCmAction(file.path, "deps");
          return;
        }
        if (matchesKey(data, "ctrl+u")) {
          void onFileCmAction(file.path, "used-by");
          return;
        }
      }

      if (matchesKey(data, "up")) {
        navigateFiles("up");
      } else if (matchesKey(data, "down")) {
        navigateFiles("down");
      }
    }

    if (matchesKey(data, "pageDown") || matchesKey(data, "pageUp")) {
      const direction = matchesKey(data, "pageDown") ? "down" : "up";
      scrollDiff(direction);
    }
  }

  function dispose(): void {
    // Cleanup if needed
  }

  void loadChanges();

  return {
    render,
    handleInput,
    invalidate: () => {
      invalidateCache(loadingState);
    },
    dispose,
  };
}
