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
  type ComponentCache,
  type BaseComponentParams,
} from "./shared-utils";
import type { FileChange, MutableChange } from "../types";
import {
  loadMutableChanges,
  loadChangedFiles,
  getDiff,
  restoreFile,
  listBookmarksByChange,
} from "../jj";

type ChangeCache = ComponentCache<FileChange>;

export function createChangesComponent(
  { pi, tui, theme, cwd }: BaseComponentParams,
  done: (result: void) => void,
  onInsert?: (text: string) => void,
  onBookmark?: (changeId: string) => Promise<string | null>,
  onNotify?: (message: string, type?: "info" | "error") => void,
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

  // Navigation handlers - defined inline to access current array values
  function navigateChanges(direction: "up" | "down"): void {
    const maxIndex = changes.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, selectionState.selectedIndex - 1)
        : Math.min(maxIndex, selectionState.selectedIndex + 1);

    if (newIndex !== selectionState.selectedIndex) {
      selectionState.selectedIndex = newIndex;
      selectedChange = changes[newIndex] || null;
      if (selectedChange) {
        void loadFilesAndDiff(selectedChange);
      }
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  function navigateFiles(direction: "up" | "down"): void {
    const maxIndex = files.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, selectionState.fileIndex - 1)
        : Math.min(maxIndex, selectionState.fileIndex + 1);

    if (newIndex !== selectionState.fileIndex) {
      selectionState.fileIndex = newIndex;
      const file = files[newIndex] || null;
      if (selectedChange && file) {
        void loadDiff(selectedChange, file.path);
      }
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
                `${index + 1}. Check changed files: \`jj diff --name-only -r ${id}\`\n   If needed for context, inspect patch: \`jj diff --git --color never -r ${id}\`\n   Describe: \`jj desc -r ${id} -m "type(scope): icon description"\``,
            )
            .join("\n");

          const task = `Describe jujutsu changes ${ids.join(", ")} using conventional commit format.

Use the **conventional-commits** skill for type/scope rules.

<format>
\`type(scope): <icon> short description\`

Types: feat, fix, docs, style, refactor, perf, test, chore
Icons: ✨ feat | 🐛 fix | 📚 docs | 💄 style | ♻️ refactor | ⚡ perf | 🧪 test | 🔧 chore
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

        case "squash": {
          if (!change) return;
          const prevIndex = selectionState.selectedIndex;
          await pi.exec("jj", ["squash", "-u", "-r", change.changeId], { cwd });
          changeCache.clear();
          selectionState.fileIndex = 0;
          selectionState.diffScroll = 0;
          await loadChanges();
          selectionState.selectedIndex = Math.min(
            prevIndex,
            changes.length - 1,
          );
          selectedChange = changes[selectionState.selectedIndex] || null;
          if (selectedChange) {
            await loadFilesAndDiff(selectedChange);
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
          selectionState.selectedIndex = Math.min(
            prevIndex,
            Math.max(0, changes.length - 1),
          );
          selectedChange = changes[selectionState.selectedIndex] || null;
          if (selectedChange) {
            await loadFilesAndDiff(selectedChange);
          }
          onNotify?.(`Dropped change ${change.changeId}`, "info");
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

  async function loadChanges(): Promise<void> {
    try {
      changes = await loadMutableChanges(pi, cwd);

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

      const existingIds = new Set(changes.map((change) => change.changeId));
      for (const changeId of selectedChangeIds) {
        if (!existingIds.has(changeId)) {
          selectedChangeIds.delete(changeId);
        }
      }

      loadingState.loading = false;

      if (changes.length > 0) {
        selectedChange = changes[0]!;
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
        const diffKey = files[0]?.path || "";
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
    const diffKey = filePath || "";

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
      const change = changes[idx]!;
      const isCursor = idx === selectionState.selectedIndex;
      const isFocusedCursor = isCursor && selectionState.focus === "left";
      const isMarked = selectedChangeIds.has(change.changeId);
      const isWorkingCopy = idx === 0; // First change is @ (working copy)

      const bookmarks = bookmarksByChange.get(change.changeId) || [];
      const { leftText, rightText } = formatChangeRow(theme, {
        isWorkingCopy,
        isEmpty: change.empty,
        isSelected: isMarked,
        bookmarks,
        description: change.description,
        changeId: change.changeId,
      });

      const idLabel = change.changeId.slice(0, 8);
      const availableLeftWidth = Math.max(1, width - idLabel.length - 1);
      const leftTruncated = truncateAnsi(leftText, availableLeftWidth);
      const leftPadded = ensureWidth(leftTruncated, availableLeftWidth);

      const line = ensureWidth(leftPadded + rightText, width);
      if (isFocusedCursor) {
        rows.push(theme.fg("accent", theme.bold(line)));
      } else if (isCursor) {
        rows.push(theme.bold(line));
      } else {
        rows.push(line);
      }
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

    const leftTitle = ` Changes (${changes.length})`;
    const rightTopTitle = " Files";
    const rightBottomTitle = selectedChange
      ? ` Diff: ${files[selectionState.fileIndex]?.path || "all"} (${selectedChange.changeId.slice(0, 8)})`
      : " Diff";

    const changeRows = getChangeRows(dims.leftW, dims.contentH);
    const fileRows = getFileRows(dims.rightW, dims.rightTopH || 5);
    const diffRows = renderDiffRows(
      diffContent,
      dims.rightW,
      dims.rightBottomH || 10,
      selectionState.diffScroll,
      theme,
    );

    const describeTargetCount =
      selectedChangeIds.size || (selectedChange ? 1 : 0);
    const helpText = buildNavigationHelp(
      selectionState.focus,
      [
        "space select",
        selectedChange && "e edit",
        describeTargetCount > 0 && `d describe(${describeTargetCount})`,
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
        files.length > 0 && "pgup/pgdn scroll",
      ].filter(Boolean) as string[],
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
        const file = files[selectionState.fileIndex]!;
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
            onNotify?.(
              `Updated bookmark '${bookmarkName}' to ${selectedChange.changeId}`,
              "info",
            );
          } catch (error) {
            onNotify?.(
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
    } else if (selectionState.focus === "right") {
      if (data === "d" && selectedChange && files[selectionState.fileIndex]) {
        const file = files[selectionState.fileIndex]!;
        void (async () => {
          await restoreFile(pi, cwd, selectedChange!.changeId, file.path);
          changeCache.delete(selectedChange!.changeId);
          await loadFilesAndDiff(selectedChange!);
        })();
        return;
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
    invalidate: () => invalidateCache(loadingState),
    dispose,
  };
}
