import path from "node:path";
import {
  ACTION_KEYS,
  createKeyboardHandler,
  buildHelpFromBindings,
  type KeyBinding,
} from "../keyboard";
import { ensureWidth, truncateAnsi } from "./text-utils";
import { formatChangeRow } from "./change-utils";
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
  type ComponentCache,
  type BaseComponentParams,
} from "./state/factories";

import { renderLoadingRow, renderEmptyState } from "./ui/render";
import {
  createStatusNotifier,
  formatHelpWithStatus,
  type StatusMessageState,
} from "./ui/status";
import type { FileChange, Change } from "../types";
import {
  loadChanges,
  loadChangedFiles,
  getDiff,
  restoreFile,
  listBookmarksByChange,
  getCurrentChangeIdShort,
} from "../jj";
import type { CmActionType } from "./cm-results";
import {
  calculateGraphLayout,
  renderGraphRow,
  type GraphLayout,
} from "./graph";

type ChangeCache = ComponentCache<FileChange>;

/** File cm action callback */
export type OnFileCmAction = (
  filePath: string,
  action: CmActionType,
) => Promise<void>;

/** Predefined revision filters */
interface RevisionFilter {
  name: string;
  revision: string;
}

const REVISION_FILTERS: RevisionFilter[] = [
  { name: "Stack", revision: "ancestors(@, 50) ~ root()" },
  { name: "Mine", revision: "mine()" },
  { name: "Tracked", revision: "bookmarks()" },
  { name: "Recent", revision: "committer_date(after:'30 days ago')" },
];

export function createChangesComponent(
  { pi, tui, theme, cwd }: BaseComponentParams,
  done: () => void,
  onInsert?: (text: string) => void,
  onBookmark?: (changeId: string) => Promise<string | null>,
  onFileCmAction?: OnFileCmAction,
) {
  let changes: Change[] = [];
  let selectedChange: Change | null = null;
  let currentChangeId: string | null = null;
  let files: FileChange[] = [];
  let diffContent: string[] = [];
  let bookmarksByChange = new Map<string, string[]>();
  const selectedChangeIds = new Set<string>();
  const changeCache = new Map<string, ChangeCache>();
  let graphLayout: GraphLayout | null = null;

  // Filter state
  let currentFilterIndex = 0;

  // Use shared state objects
  const selectionState = createSelectionState();
  const loadingState = createLoadingState();
  const statusState: StatusMessageState = { message: null, timeout: null };

  // Move mode state
  let mode: "normal" | "move" = "normal";
  let moveOriginalIndex = -1;
  let moveOriginalChanges: Change[] = [];

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

  function enterMoveMode(): void {
    if (!selectedChange || changes.length < 2) return;
    mode = "move";
    moveOriginalIndex = selectionState.selectedIndex;
    moveOriginalChanges = [...changes];
    invalidateCache(loadingState);
    tui.requestRender();
  }

  function cancelMoveMode(): void {
    changes = moveOriginalChanges;
    selectionState.selectedIndex = moveOriginalIndex;
    selectedChange = changes[moveOriginalIndex];
    mode = "normal";
    moveOriginalIndex = -1;
    moveOriginalChanges = [];
    invalidateCache(loadingState);
    tui.requestRender();
  }

  function moveChange(direction: "up" | "down"): void {
    const currentIndex = selectionState.selectedIndex;
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= changes.length) {
      return;
    }

    const changeToMove = changes[currentIndex];
    const isWorkingCopy =
      currentChangeId !== null && changeToMove?.changeId === currentChangeId;
    if (isWorkingCopy) {
      return;
    }

    [changes[currentIndex], changes[targetIndex]] = [
      changes[targetIndex],
      changes[currentIndex],
    ];
    selectionState.selectedIndex = targetIndex;
    invalidateCache(loadingState);
    tui.requestRender();
  }

  async function applyMoveMode(): Promise<void> {
    if (!selectedChange) {
      mode = "normal";
      return;
    }

    const currentIndex = selectionState.selectedIndex;
    if (currentIndex === moveOriginalIndex) {
      // No change, just exit move mode
      mode = "normal";
      moveOriginalIndex = -1;
      moveOriginalChanges = [];
      invalidateCache(loadingState);
      tui.requestRender();
      return;
    }

    try {
      // Determine target for rebase
      // List shows newest-first (children before parents)
      // Moving UP in list = becoming a child = use --after the change below
      // Moving DOWN in list = becoming a parent = use --before the change above
      const changeToMove = selectedChange;

      if (currentIndex < moveOriginalIndex) {
        // Moved up - become a child of what's now below us
        const targetChange = changes[currentIndex + 1];
        await pi.exec(
          "jj",
          [
            "rebase",
            "-r",
            changeToMove.changeId,
            "--after",
            targetChange.changeId,
          ],
          { cwd },
        );
      } else {
        // Moved down - become a parent of what's now above us
        const targetChange = changes[currentIndex - 1];
        await pi.exec(
          "jj",
          [
            "rebase",
            "-r",
            changeToMove.changeId,
            "--before",
            targetChange.changeId,
          ],
          { cwd },
        );
      }

      mode = "normal";
      moveOriginalIndex = -1;
      moveOriginalChanges = [];

      // Reload to get actual state
      changeCache.clear();
      await reloadChanges();
      notify(`Moved change ${changeToMove.changeId.slice(0, 8)}`, "info");
    } catch (error) {
      notify(`Failed to move: ${formatErrorMessage(error)}`, "error");
      // Restore original order on failure
      cancelMoveMode();
    }
  }

  function switchFocus(): void {
    selectionState.focus = selectionState.focus === "left" ? "right" : "left";
    invalidateCache(loadingState);
    tui.requestRender();
  }

  function getDescribeTargets(): Change[] {
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
          await pi.exec("jj", ["edit", change.changeId], { cwd });
          changeCache.clear();
          selectionState.fileIndex = 0;
          selectionState.diffScroll = 0;
          await reloadChanges();
          notify(`Editing change ${change.changeId.slice(0, 8)}`, "info");
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
          await reloadChanges();
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
          await reloadChanges();
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

        case "new": {
          if (!change) return;
          await pi.exec("jj", ["new", change.changeId], { cwd });
          changeCache.clear();
          selectionState.fileIndex = 0;
          selectionState.diffScroll = 0;
          await reloadChanges();
          notify(
            `Created new change after ${change.changeId.slice(0, 8)}`,
            "info",
          );
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

  async function reloadChanges(): Promise<void> {
    try {
      const previousSelectedChangeId = selectedChange?.changeId ?? null;
      const filter = REVISION_FILTERS[currentFilterIndex];
      changes = await loadChanges(pi, cwd, filter.revision);
      currentChangeId = await getCurrentChangeIdShort(pi, cwd);
      await reloadBookmarks();

      // Calculate graph layout
      // Filter parentIds to only include changes in the current set
      const changeIdSet = new Set(changes.map((c) => c.changeId));
      graphLayout = calculateGraphLayout(
        changes.map((c) => ({
          id: c.changeId,
          parentIds: (c.parentIds ?? []).filter((pid) => changeIdSet.has(pid)),
          isWorkingCopy:
            currentChangeId !== null && c.changeId === currentChangeId,
        })),
      );

      const existingIds = new Set(changes.map((change) => change.changeId));
      for (const changeId of selectedChangeIds) {
        if (!existingIds.has(changeId)) {
          selectedChangeIds.delete(changeId);
        }
      }

      loadingState.loading = false;

      if (changes.length > 0) {
        const preferredChangeId = currentChangeId ?? previousSelectedChangeId;
        const matchedIndex = preferredChangeId
          ? changes.findIndex((change) => change.changeId === preferredChangeId)
          : -1;
        selectionState.selectedIndex = matchedIndex >= 0 ? matchedIndex : 0;
        selectedChange = changes[selectionState.selectedIndex];
        await loadFilesAndDiff(selectedChange);
      } else {
        selectionState.selectedIndex = 0;
        selectedChange = null;
        files = [];
        diffContent = [];
        graphLayout = null;
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

  async function loadFilesAndDiff(change: Change): Promise<void> {
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

  async function loadDiff(change: Change, filePath?: string): Promise<void> {
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
      const isMarked = selectedChangeIds.has(change.changeId);
      const isWorkingCopy =
        currentChangeId !== null && change.changeId === currentChangeId;
      const isFocused = isCursor && selectionState.focus === "left";

      // Render graph prefix (dynamic width per row)
      let graphPrefix = "";
      if (graphLayout) {
        const pos = graphLayout.positions.get(change.changeId);
        const edges = graphLayout.edges[idx] ?? [];
        if (pos) {
          graphPrefix = renderGraphRow(
            edges,
            pos.x,
            isWorkingCopy,
            change.immutable,
            graphLayout.maxX,
          );
        }
      }

      // Add single space separator after graph, use actual length
      const graphWidth = graphPrefix.length > 0 ? graphPrefix.length + 1 : 0;
      if (graphPrefix.length > 0) {
        graphPrefix += " ";
      }

      const bookmarks = bookmarksByChange.get(change.changeId) ?? [];
      const isMoving = mode === "move" && isCursor;
      const { leftText, rightText } = formatChangeRow(theme, {
        isImmutable: change.immutable,
        isSelected: isMarked,
        isFocused,
        isMoving,
        bookmarks,
        description: change.description,
        author: change.author,
      });

      // eslint-disable-next-line no-control-regex
      const rightLen = rightText.replace(/\x1b\[[0-9;]*m/g, "").length;
      const availableLeftWidth = Math.max(1, width - rightLen - graphWidth);
      const leftTruncated = truncateAnsi(leftText, availableLeftWidth);
      const leftPadded = ensureWidth(leftTruncated, availableLeftWidth);
      const styledGraph = isFocused
        ? theme.fg("accent", graphPrefix)
        : change.immutable
          ? theme.fg("dim", graphPrefix)
          : graphPrefix;
      const line = styledGraph + leftPadded + rightText;
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

    const filter = REVISION_FILTERS[currentFilterIndex];
    const leftTitle = ` ${filter.name} (${String(changes.length)})`;
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

    const helpText = formatHelpWithStatus(
      theme,
      statusState.message,
      getHelpText(),
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

  // Helper conditions for bindings
  const isLeftFocus = () => selectionState.focus === "left";
  const hasSelectedChange = () => selectedChange !== null;
  const hasSelectedFile = () => files[selectionState.fileIndex] !== undefined;
  const canSquash = () =>
    hasSelectedChange() &&
    changes.length > 1 &&
    selectionState.selectedIndex < changes.length - 1;
  const canMove = () =>
    hasSelectedChange() &&
    changes.length > 1 &&
    currentChangeId !== selectedChange?.changeId;
  const hasBookmarks = () =>
    selectedChange !== null &&
    (bookmarksByChange.get(selectedChange.changeId)?.length ?? 0) > 0;

  // Cycle filter helper
  const cycleFilter = (direction: 1 | -1) => {
    currentFilterIndex =
      (currentFilterIndex + direction + REVISION_FILTERS.length) %
      REVISION_FILTERS.length;
    selectionState.selectedIndex = 0;
    selectionState.fileIndex = 0;
    selectionState.diffScroll = 0;
    changeCache.clear();
    void reloadChanges();
  };

  // Discard file helper
  const discardFile = async () => {
    if (!selectedChange || !files[selectionState.fileIndex]) return;
    const file = files[selectionState.fileIndex];
    try {
      await restoreFile(pi, cwd, selectedChange.changeId, file.path);
      changeCache.delete(selectedChange.changeId);
      await loadFilesAndDiff(selectedChange);
    } catch (error) {
      notify(`Failed to discard file: ${formatErrorMessage(error)}`, "error");
    }
  };

  // Split file into new change helper
  const splitFile = async () => {
    if (!selectedChange || !files[selectionState.fileIndex]) return;
    const file = files[selectionState.fileIndex];
    try {
      await pi.exec("jj", ["split", "-r", selectedChange.changeId, file.path], {
        cwd,
      });
      changeCache.clear();
      await reloadChanges();
      notify(`Split ${file.path} into new change`, "info");
    } catch (error) {
      notify(`Failed to split file: ${formatErrorMessage(error)}`, "error");
    }
  };

  // Push bookmarks helper
  const pushBookmarks = async () => {
    if (!selectedChange) return;
    const bookmarks = bookmarksByChange.get(selectedChange.changeId) ?? [];
    if (bookmarks.length === 0) return;
    try {
      for (const bookmark of bookmarks) {
        await pi.exec("jj", ["git", "push", "-b", bookmark], { cwd });
      }
      await reloadChanges();
      invalidateCache(loadingState);
      tui.requestRender();
      notify(
        `Pushed bookmark${bookmarks.length > 1 ? "s" : ""}: ${bookmarks.join(", ")}`,
        "info",
      );
    } catch (error) {
      notify(`Failed to push: ${formatErrorMessage(error)}`, "error");
    }
  };

  // Set bookmark helper
  const setBookmark = async () => {
    if (!selectedChange || !onBookmark) return;
    try {
      const bookmarkName = await onBookmark(selectedChange.changeId);
      if (!bookmarkName) return;
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
  };

  // Move mode bindings
  const moveModeBindings: KeyBinding[] = [
    {
      key: "up",
      label: "move",
      handler: () => {
        moveChange("up");
      },
    },
    {
      key: "down",
      handler: () => {
        moveChange("down");
      },
    },
    {
      key: "enter",
      label: "apply",
      handler: () => {
        void applyMoveMode();
      },
    },
    {
      key: "escape",
      label: "cancel",
      handler: () => {
        cancelMoveMode();
      },
    },
  ];

  // Left pane bindings
  const leftPaneBindings: KeyBinding[] = [
    {
      key: "up",
      label: "nav",
      handler: () => {
        navigateChanges("up");
      },
    },
    {
      key: "down",
      handler: () => {
        navigateChanges("down");
      },
    },
    {
      key: "ctrl+/",
      label: "filter",
      handler: () => {
        cycleFilter(1);
      },
    },
    {
      key: "space",
      label: "select",
      when: hasSelectedChange,
      handler: () => {
        if (selectedChange) {
          if (selectedChangeIds.has(selectedChange.changeId)) {
            selectedChangeIds.delete(selectedChange.changeId);
          } else {
            selectedChangeIds.add(selectedChange.changeId);
          }
          invalidateCache(loadingState);
          tui.requestRender();
        }
      },
    },
    {
      key: "n",
      label: "new",
      when: hasSelectedChange,
      handler: () => {
        void executeAction("new");
      },
    },
    {
      key: "e",
      label: "edit",
      when: hasSelectedChange,
      handler: () => {
        void executeAction("edit");
      },
    },
    {
      key: "d",
      label: "describe",
      when: () => hasSelectedChange() || selectedChangeIds.size > 0,
      handler: () => {
        void executeAction("describe");
      },
    },
    {
      key: "s",
      label: "split",
      when: hasSelectedChange,
      handler: () => {
        void executeAction("split");
      },
    },
    {
      key: "f",
      label: "fixup",
      when: canSquash,
      handler: () => {
        void executeAction("squash");
      },
    },
    {
      key: "ctrl+m",
      label: "move",
      when: canMove,
      handler: () => {
        enterMoveMode();
      },
    },
    {
      key: "ctrl-i",
      label: "insert",
      when: () => hasSelectedChange() && onInsert !== undefined,
      handler: () => {
        onInsert!(selectedChange!.changeId);
        done();
      },
    },
    {
      key: "b",
      label: "bookmark",
      when: () => hasSelectedChange() && onBookmark !== undefined,
      handler: () => {
        void setBookmark();
      },
    },
    {
      key: "ctrl+p",
      label: "push",
      when: hasBookmarks,
      handler: () => {
        void pushBookmarks();
      },
    },
    {
      key: ACTION_KEYS.delete,
      label: "drop",
      when: hasSelectedChange,
      handler: () => {
        void executeAction("drop");
      },
    },
  ];

  // Right pane bindings
  const rightPaneBindings: KeyBinding[] = [
    {
      key: "up",
      label: "nav",
      handler: () => {
        navigateFiles("up");
      },
    },
    {
      key: "down",
      handler: () => {
        navigateFiles("down");
      },
    },
    {
      key: "e",
      label: "edit",
      when: hasSelectedFile,
      handler: () => {
        const file = files[selectionState.fileIndex];
        void pi.exec("code", [path.join(cwd, file.path)]);
      },
    },
    {
      key: "ctrl+s",
      label: "split",
      when: () => hasSelectedChange() && hasSelectedFile(),
      handler: () => {
        void splitFile();
      },
    },
    {
      key: "d",
      label: "discard",
      when: () => hasSelectedChange() && hasSelectedFile(),
      handler: () => {
        void discardFile();
      },
    },
    {
      key: "ctrl+i",
      label: "inspect",
      when: () => onFileCmAction !== undefined && hasSelectedFile(),
      handler: () => {
        void onFileCmAction!(files[selectionState.fileIndex].path, "inspect");
      },
    },
    {
      key: "ctrl+d",
      label: "deps",
      when: () => onFileCmAction !== undefined && hasSelectedFile(),
      handler: () => {
        void onFileCmAction!(files[selectionState.fileIndex].path, "deps");
      },
    },
    {
      key: "ctrl+u",
      label: "used-by",
      when: () => onFileCmAction !== undefined && hasSelectedFile(),
      handler: () => {
        void onFileCmAction!(files[selectionState.fileIndex].path, "used-by");
      },
    },
    {
      key: "pageUp",
      label: "scroll",
      handler: () => {
        scrollDiff("up");
      },
    },
    {
      key: "pageDown",
      handler: () => {
        scrollDiff("down");
      },
    },
  ];

  // Global bindings (work in both panes)
  const globalBindings: KeyBinding[] = [
    {
      key: "tab",
      label: "pane",
      handler: () => {
        switchFocus();
      },
    },
    {
      key: "escape",
      handler: () => {
        done();
      },
    },
    {
      key: "q",
      handler: () => {
        done();
      },
    },
  ];

  // Generate help text from active bindings
  function getHelpText(): string {
    const bindings =
      mode === "move"
        ? moveModeBindings
        : selectionState.focus === "left"
          ? [...globalBindings, ...leftPaneBindings]
          : [...globalBindings, ...rightPaneBindings];

    const activeBindings = bindings.filter((b) => {
      if (!b.label) return false;
      if (b.when && !b.when(undefined as never)) return false;
      return true;
    });
    return buildHelpFromBindings(activeBindings);
  }

  // Create keyboard handlers for each mode/pane
  const moveModeHandler = createKeyboardHandler({ bindings: moveModeBindings });
  const leftPaneHandler = createKeyboardHandler({
    bindings: [...globalBindings, ...leftPaneBindings],
  });
  const rightPaneHandler = createKeyboardHandler({
    bindings: [...globalBindings, ...rightPaneBindings],
  });

  function handleInput(data: string): void {
    if (mode === "move") {
      moveModeHandler(data);
      return;
    }

    if (isLeftFocus()) {
      leftPaneHandler(data);
    } else {
      rightPaneHandler(data);
    }
  }

  function dispose(): void {
    // Cleanup if needed
  }

  void reloadChanges();

  return {
    render,
    handleInput,
    invalidate: () => {
      invalidateCache(loadingState);
    },
    dispose,
  };
}
