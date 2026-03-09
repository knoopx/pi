/**
 * Semantic changes component.
 *
 * LEFT: jj changes list (same as changes.ts)
 * RIGHT TOP: changed files for selected change
 * RIGHT BOTTOM: semantic entities for the selected file
 */

import type { ThemeColor } from "@mariozechner/pi-coding-agent";
import {
  createKeyboardHandler,
  buildHelpFromBindings,
  type KeyBinding,
} from "../keyboard";
import { Key } from "@mariozechner/pi-tui";
import { ensureWidth, truncateAnsi } from "./text-utils";
import { formatChangeRow } from "./change-utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderFileChangeRows,
  formatErrorMessage,
} from "./split-panel";
import {
  createSelectionState,
  createLoadingState,
  invalidateCache,
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
  listBookmarksByChange,
  getCurrentChangeIdShort,
} from "../jj";
import { getSemanticDiff, type SemChange, type SemChangeType } from "../sem";
import {
  calculateGraphLayout,
  renderGraphRow,
  type GraphLayout,
} from "./graph";

const CHANGE_ICONS: Record<SemChangeType, string> = {
  added: "󰐕",
  modified: "󰏫",
  deleted: "󰍴",
  renamed: "󰑕",
  moved: "󰑕",
};

const CHANGE_COLORS: Record<SemChangeType, ThemeColor> = {
  added: "success",
  modified: "warning",
  deleted: "error",
  renamed: "accent",
  moved: "accent",
};

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

export function createSemanticChangesComponent(
  { pi, tui, theme, cwd }: BaseComponentParams,
  done: () => void,
  onInsert?: (text: string) => void,
) {
  let changes: Change[] = [];
  let selectedChange: Change | null = null;
  let currentChangeId: string | null = null;
  let files: FileChange[] = [];
  let allSemChanges: SemChange[] = [];
  let fileSemChanges: SemChange[] = [];
  let bookmarksByChange = new Map<string, string[]>();
  let graphLayout: GraphLayout | null = null;

  let currentFilterIndex = 0;

  // entityIndex tracks selection in bottom-right entity list
  let entityIndex = 0;

  // Caches
  const semCache = new Map<string, SemChange[]>();
  const fileCache = new Map<string, FileChange[]>();

  const selectionState = createSelectionState();
  const loadingState = createLoadingState();
  const statusState: StatusMessageState = { message: null, timeout: null };

  const notify = createStatusNotifier(statusState, () => {
    invalidateCache(loadingState);
    tui.requestRender();
  });

  // --- Helpers ---

  function updateFileSemChanges(): void {
    const file = files[selectionState.fileIndex];
    if (!file) {
      fileSemChanges = [];
      entityIndex = 0;
      return;
    }
    fileSemChanges = allSemChanges.filter((c) => c.filePath === file.path);
    entityIndex = 0;
  }

  // --- Navigation ---

  function navigateChanges(direction: "up" | "down"): void {
    if (changes.length === 0) return;
    const maxIndex = changes.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, selectionState.selectedIndex - 1)
        : Math.min(maxIndex, selectionState.selectedIndex + 1);
    if (newIndex !== selectionState.selectedIndex) {
      selectionState.selectedIndex = newIndex;
      selectedChange = changes[newIndex];
      void loadFilesAndSemDiff(selectedChange);
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  function navigateFiles(direction: "up" | "down"): void {
    if (files.length === 0 || selectedChange === null) return;
    const maxIndex = files.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, selectionState.fileIndex - 1)
        : Math.min(maxIndex, selectionState.fileIndex + 1);
    if (newIndex !== selectionState.fileIndex) {
      selectionState.fileIndex = newIndex;
      updateFileSemChanges();
      invalidateCache(loadingState);
      tui.requestRender();
    }
  }

  function switchFocus(): void {
    selectionState.focus = selectionState.focus === "left" ? "right" : "left";
    invalidateCache(loadingState);
    tui.requestRender();
  }

  const cycleFilter = (direction: 1 | -1) => {
    currentFilterIndex =
      (currentFilterIndex + direction + REVISION_FILTERS.length) %
      REVISION_FILTERS.length;
    selectionState.selectedIndex = 0;
    selectionState.fileIndex = 0;
    entityIndex = 0;
    semCache.clear();
    fileCache.clear();
    void reloadChanges();
  };

  // --- Data loading ---

  async function reloadBookmarks(): Promise<void> {
    const bookmarkEntries = await listBookmarksByChange(pi, cwd);
    const next = new Map<string, string[]>();
    for (const change of changes) {
      const bookmarks = bookmarkEntries
        .filter(
          (entry) =>
            change.changeId.startsWith(entry.changeId) ||
            entry.changeId.startsWith(change.changeId),
        )
        .map((entry) => entry.bookmark);
      next.set(change.changeId, bookmarks);
    }
    bookmarksByChange = next;
  }

  async function reloadChanges(): Promise<void> {
    try {
      const previousSelectedChangeId = selectedChange?.changeId ?? null;
      const filter = REVISION_FILTERS[currentFilterIndex];
      changes = await loadChanges(pi, cwd, filter.revision);
      currentChangeId = await getCurrentChangeIdShort(pi, cwd);
      await reloadBookmarks();

      const changeIdSet = new Set(changes.map((c) => c.changeId));
      graphLayout = calculateGraphLayout(
        changes.map((c) => ({
          id: c.changeId,
          parentIds: (c.parentIds ?? []).filter((pid) => changeIdSet.has(pid)),
          isWorkingCopy:
            currentChangeId !== null && c.changeId === currentChangeId,
        })),
      );

      loadingState.loading = false;

      if (changes.length > 0) {
        const preferredChangeId = currentChangeId ?? previousSelectedChangeId;
        const matchedIndex = preferredChangeId
          ? changes.findIndex((c) => c.changeId === preferredChangeId)
          : -1;
        selectionState.selectedIndex = matchedIndex >= 0 ? matchedIndex : 0;
        selectedChange = changes[selectionState.selectedIndex];
        await loadFilesAndSemDiff(selectedChange);
      } else {
        selectionState.selectedIndex = 0;
        selectedChange = null;
        files = [];
        allSemChanges = [];
        fileSemChanges = [];
        graphLayout = null;
      }

      invalidateCache(loadingState);
      tui.requestRender();
    } catch (error) {
      loadingState.loading = false;
      files = [];
      allSemChanges = [];
      fileSemChanges = [];
      notify(`Error: ${formatErrorMessage(error)}`, "error");
    }
  }

  async function loadFilesAndSemDiff(change: Change): Promise<void> {
    try {
      // Load files
      let cachedFiles = fileCache.get(change.changeId);
      if (!cachedFiles) {
        cachedFiles = await loadChangedFiles(pi, cwd, change.changeId);
        fileCache.set(change.changeId, cachedFiles);
      }
      files = cachedFiles;
      selectionState.fileIndex = 0;

      // Load semantic diff
      let cachedSem = semCache.get(change.changeId);
      if (!cachedSem) {
        try {
          const result = await getSemanticDiff(pi, cwd, change.changeId);
          cachedSem = result.changes;
        } catch (error) {
          cachedSem = [];
          notify(`sem diff failed: ${formatErrorMessage(error)}`, "error");
        }
        semCache.set(change.changeId, cachedSem);
      }
      allSemChanges = cachedSem;
      updateFileSemChanges();

      invalidateCache(loadingState);
      tui.requestRender();
    } catch (error) {
      files = [];
      allSemChanges = [];
      fileSemChanges = [];
      notify(`Error loading: ${formatErrorMessage(error)}`, "error");
    }
  }

  // --- Rendering ---

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
      const isWorkingCopy =
        currentChangeId !== null && change.changeId === currentChangeId;
      const isFocused = isCursor && selectionState.focus === "left";

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

      const graphWidth = graphPrefix.length > 0 ? graphPrefix.length + 1 : 0;
      if (graphPrefix.length > 0) {
        graphPrefix += " ";
      }

      const bookmarks = bookmarksByChange.get(change.changeId) ?? [];
      const { leftText, rightText } = formatChangeRow(theme, {
        isImmutable: change.immutable,
        isSelected: false,
        isFocused,
        isMoving: false,
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
      rows.push(styledGraph + leftPadded + rightText);
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

  function getEntityRows(width: number, height: number): string[] {
    if (fileSemChanges.length === 0) {
      return [ensureWidth(theme.fg("dim", " No semantic changes"), width)];
    }

    const rows: string[] = [];
    const visibleCount = height;
    let startIdx = 0;
    if (entityIndex >= visibleCount) {
      startIdx = entityIndex - visibleCount + 1;
    }

    for (
      let i = 0;
      i < visibleCount && startIdx + i < fileSemChanges.length;
      i++
    ) {
      const idx = startIdx + i;
      const entity = fileSemChanges[idx];
      const isFocused = idx === entityIndex && selectionState.focus === "right";

      const icon = CHANGE_ICONS[entity.changeType] ?? "?";
      const color = CHANGE_COLORS[entity.changeType] ?? "dim";
      const tag = theme.fg(color, `${icon} ${entity.changeType}`);
      const type = theme.fg("dim", entity.entityType);
      const name = isFocused
        ? theme.fg("accent", theme.bold(entity.entityName))
        : entity.entityName;

      const text = ` ${tag} ${type} ${name}`;
      const truncated = truncateAnsi(text, width);
      rows.push(ensureWidth(truncated, width));
    }

    return rows;
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

    const selectedFile = files[selectionState.fileIndex];
    const rightTopTitle = selectedChange
      ? ` ${selectedChange.description || "(no description)"}`
      : " Files";
    const rightBottomTitle = selectedFile
      ? ` 󰊕 ${selectedFile.path} (${String(fileSemChanges.length)})`
      : " Semantic Diff";

    const changeRows = getChangeRows(dims.leftW, dims.contentH);
    const fileRows = getFileRows(dims.rightW, dims.rightTopH ?? 5);
    const entityRows = getEntityRows(dims.rightW, dims.rightBottomH ?? 10);

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
        rightBottom: entityRows,
      },
    );

    loadingState.cachedWidth = width;
    return loadingState.cachedLines;
  }

  // --- Key bindings ---

  const isLeftFocus = () => selectionState.focus === "left";
  const hasSelectedChange = () => selectedChange !== null;
  const hasSelectedEntity = () => fileSemChanges[entityIndex] !== undefined;

  const leftPaneBindings: KeyBinding[] = [
    {
      key: "up",
      label: "nav",
      handler: () => { navigateChanges("up"); },
    },
    {
      key: "down",
      handler: () => { navigateChanges("down"); },
    },
    {
      key: Key.ctrl("/"),
      label: "filter",
      handler: () => { cycleFilter(1); },
    },
    {
      key: Key.ctrl("i"),
      label: "insert",
      when: () => hasSelectedChange() && onInsert !== undefined,
      handler: () => {
        onInsert!(selectedChange!.changeId);
        done();
      },
    },
  ];

  const rightPaneBindings: KeyBinding[] = [
    {
      key: "up",
      label: "nav",
      handler: () => { navigateFiles("up"); },
    },
    {
      key: "down",
      handler: () => { navigateFiles("down"); },
    },
    {
      key: "enter",
      label: "insert",
      when: () => hasSelectedEntity() && onInsert !== undefined,
      handler: () => {
        const entity = fileSemChanges[entityIndex];
        onInsert!(`${entity.filePath}::${entity.entityName}`);
        done();
      },
    },
  ];

  const globalBindings: KeyBinding[] = [
    {
      key: "tab",
      label: "pane",
      handler: () => { switchFocus(); },
    },
    {
      key: "escape",
      handler: () => { done(); },
    },
    {
      key: "q",
      handler: () => { done(); },
    },
  ];

  function getHelpText(): string {
    const bindings =
      selectionState.focus === "left"
        ? [...globalBindings, ...leftPaneBindings]
        : [...globalBindings, ...rightPaneBindings];
    const active = bindings.filter((b) => {
      if (!b.label) return false;
      if (b.when && !b.when(undefined as never)) return false;
      return true;
    });
    return buildHelpFromBindings(active);
  }

  const leftPaneHandler = createKeyboardHandler({
    bindings: [...globalBindings, ...leftPaneBindings],
  });
  const rightPaneHandler = createKeyboardHandler({
    bindings: [...globalBindings, ...rightPaneBindings],
  });

  function handleInput(data: string): void {
    if (isLeftFocus()) {
      leftPaneHandler(data);
    } else {
      rightPaneHandler(data);
    }
  }

  function dispose(): void {
    semCache.clear();
    fileCache.clear();
  }

  void reloadChanges();

  return {
    render,
    handleInput,
    invalidate: () => { invalidateCache(loadingState); },
    dispose,
  };
}
