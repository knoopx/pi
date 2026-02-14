import path from "node:path";
import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import {
  pad,
  buildHelpText,
  ensureWidth,
  formatBookmarkReference,
  truncateAnsi,
} from "./utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderDiffRows,
  renderFileChangeRows,
  calculateDiffScroll,
  formatErrorMessage,
} from "./split-panel";
import type { FileChange, MutableChange } from "../types";
import {
  loadMutableChanges,
  loadChangedFiles,
  getDiff,
  restoreFile,
  listBookmarksByChange,
} from "../jj";

interface ChangeCache {
  files: FileChange[];
  diffs: Map<string, string[]>;
}

export function createChangesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: void) => void,
  cwd: string,
  onInsert?: (text: string) => void,
  onBookmark?: (changeId: string) => Promise<string | null>,
  onNotify?: (message: string, type?: "info" | "error") => void,
) {
  let changes: MutableChange[] = [];
  let selectedIndex = 0;
  let selectedChange: MutableChange | null = null;
  let files: FileChange[] = [];
  let fileIndex = 0;
  let diffContent: string[] = [];
  let diffScroll = 0;
  let focus: "changes" | "files" = "changes";
  let loading = true;
  let cachedLines: string[] = [];
  let cachedWidth = 0;
  let bookmarksByChange = new Map<string, string[]>();
  const selectedChangeIds = new Set<string>();
  const changeCache = new Map<string, ChangeCache>();

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
          const prevIndex = selectedIndex;
          await pi.exec("jj", ["squash", "-u", "-r", change.changeId], { cwd });
          changeCache.clear();
          fileIndex = 0;
          diffScroll = 0;
          await loadChanges();
          selectedIndex = Math.min(prevIndex, changes.length - 1);
          selectedChange = changes[selectedIndex] || null;
          if (selectedChange) {
            await loadFilesAndDiff(selectedChange);
          }
          return;
        }

        case "drop": {
          if (!change) return;
          const prevIndex = selectedIndex;
          await pi.exec("jj", ["abandon", change.changeId], { cwd });
          selectedChangeIds.delete(change.changeId);
          changeCache.clear();
          fileIndex = 0;
          diffScroll = 0;
          await loadChanges();
          selectedIndex = Math.min(prevIndex, Math.max(0, changes.length - 1));
          selectedChange = changes[selectedIndex] || null;
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
      invalidate();
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

      loading = false;

      if (changes.length > 0) {
        selectedChange = changes[0]!;
        await loadFilesAndDiff(selectedChange);
      }

      invalidate();
      tui.requestRender();
    } catch (error) {
      loading = false;
      const msg = formatErrorMessage(error);
      diffContent = [`Error: ${msg}`];
      invalidate();
      tui.requestRender();
    }
  }

  async function loadFilesAndDiff(change: MutableChange): Promise<void> {
    try {
      let cache = changeCache.get(change.changeId);
      if (cache) {
        files = cache.files;
        fileIndex = 0;
        const diffKey = files[0]?.path || "";
        const cachedDiff = cache.diffs.get(diffKey);
        if (cachedDiff) {
          diffContent = cachedDiff;
          diffScroll = 0;
          invalidate();
          tui.requestRender();
          return;
        }
      }

      if (!cache) {
        files = await loadChangedFiles(pi, cwd, change.changeId);
        cache = { files, diffs: new Map() };
        changeCache.set(change.changeId, cache);
      }

      fileIndex = 0;
      await loadDiff(change, files[0]?.path);
    } catch (error) {
      const msg = formatErrorMessage(error);
      files = [];
      diffContent = [`Error loading files: ${msg}`];
      invalidate();
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
        diffScroll = 0;
        invalidate();
        tui.requestRender();
        return;
      }
    }

    try {
      diffContent = await getDiff(pi, cwd, change.changeId, filePath);
      diffScroll = 0;

      if (cache) {
        cache.diffs.set(diffKey, diffContent);
      }

      invalidate();
      tui.requestRender();
    } catch (error) {
      const msg = formatErrorMessage(error);
      diffContent = [`Error: ${msg}`];
      invalidate();
      tui.requestRender();
    }
  }

  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }

  function getChangeRows(width: number, height: number): string[] {
    if (loading) {
      return [pad(" Loading...", width)];
    }

    if (changes.length === 0) {
      return [
        pad(" No changes on branch", width),
        theme.fg("dim", pad(" All changes are immutable", width)),
      ];
    }

    const rows: string[] = [];
    const visibleCount = height;
    let startIdx = 0;
    if (selectedIndex >= visibleCount) {
      startIdx = selectedIndex - visibleCount + 1;
    }

    for (let i = 0; i < visibleCount && startIdx + i < changes.length; i++) {
      const idx = startIdx + i;
      const change = changes[idx]!;
      const isCursor = idx === selectedIndex;
      const isFocusedCursor = isCursor && focus === "changes";
      const isMarked = selectedChangeIds.has(change.changeId);

      const bookmarks = bookmarksByChange.get(change.changeId) || [];
      const bookmarkLabel =
        bookmarks.length > 0
          ? `${formatBookmarkReference(theme, bookmarks.join(","))} `
          : "";
      const idLabel = change.changeId.slice(0, 8);

      const marker = isMarked ? "●" : "○";
      const leftText = ` ${marker} ${bookmarkLabel}${change.description}`;
      const rightText = theme.fg("dim", ` ${idLabel}`);

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
      fileIndex,
      focus === "files",
      theme,
    );
  }

  function render(width: number): string[] {
    if (cachedWidth === width && cachedLines.length > 0) {
      return cachedLines;
    }

    const dims = calculateDimensions(tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: focus === "changes",
      rightFocus: focus === "files",
      rightSplit: true,
      rightTopRatio: 0.3,
    });

    const leftTitle = ` Changes (${changes.length})`;
    const rightTopTitle = " Files";
    const rightBottomTitle = selectedChange
      ? ` Diff: ${files[fileIndex]?.path || "all"} (${selectedChange.changeId.slice(0, 8)})`
      : " Diff";

    const changeRows = getChangeRows(dims.leftW, dims.contentH);
    const fileRows = getFileRows(dims.rightW, dims.rightTopH || 5);
    const diffRows = renderDiffRows(
      diffContent,
      dims.rightW,
      dims.rightBottomH || 10,
      diffScroll,
      theme,
    );

    const describeTargetCount =
      selectedChangeIds.size || (selectedChange ? 1 : 0);
    const helpText =
      focus === "changes"
        ? buildHelpText(
            "tab ↑↓ nav",
            "space select",
            selectedChange && "e edit",
            describeTargetCount > 0 && `d describe(${describeTargetCount})`,
            selectedChange &&
              changes.length > 1 &&
              selectedIndex < changes.length - 1 &&
              "f fixup",
            selectedChange && onInsert && "i insert",
            selectedChange && onBookmark && "b bookmark",
            selectedChange && "ctrl+d drop",
          )
        : buildHelpText(
            "tab ↑↓ nav",
            files.length > 0 && "e edit",
            files.length > 0 && "d discard",
            files.length > 0 && "pgup/pgdn scroll",
          );

    cachedLines = renderSplitPanel(
      theme,
      {
        leftTitle,
        rightTitle: rightTopTitle,
        rightTopTitle,
        rightBottomTitle,
        helpText,
        leftFocus: focus === "changes",
        rightFocus: focus === "files",
        rightSplit: true,
      },
      dims,
      {
        left: changeRows,
        rightTop: fileRows,
        rightBottom: diffRows,
      },
    );

    cachedWidth = width;
    return cachedLines;
  }

  function handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q") {
      done();
      return;
    }

    if (matchesKey(data, "tab")) {
      focus = focus === "changes" ? "files" : "changes";
      invalidate();
      tui.requestRender();
      return;
    }

    if (data === "e") {
      if (focus === "files" && files[fileIndex]) {
        const file = files[fileIndex]!;
        void pi.exec("code", [path.join(cwd, file.path)]);
      } else if (focus === "changes" && selectedChange) {
        void executeAction("edit");
      }
      return;
    }

    if (data === "d" && focus === "changes") {
      if (selectedChange || selectedChangeIds.size > 0) {
        void executeAction("describe");
      }
      return;
    }

    if (data === " " && focus === "changes") {
      if (selectedChange) {
        if (selectedChangeIds.has(selectedChange.changeId)) {
          selectedChangeIds.delete(selectedChange.changeId);
        } else {
          selectedChangeIds.add(selectedChange.changeId);
        }
        invalidate();
        tui.requestRender();
      }
      return;
    }

    if (data === "f") {
      if (
        selectedChange &&
        changes.length > 1 &&
        selectedIndex < changes.length - 1
      ) {
        void executeAction("squash");
      }
      return;
    }

    if (focus === "changes" && matchesKey(data, "ctrl+d")) {
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

    if (data === "b" && focus === "changes") {
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

    if (focus === "changes") {
      if (matchesKey(data, "up")) {
        if (selectedIndex > 0) {
          selectedIndex--;
          selectedChange = changes[selectedIndex] || null;
          if (selectedChange) {
            void loadFilesAndDiff(selectedChange);
          }
          invalidate();
          tui.requestRender();
        }
      } else if (matchesKey(data, "down")) {
        if (selectedIndex < changes.length - 1) {
          selectedIndex++;
          selectedChange = changes[selectedIndex] || null;
          if (selectedChange) {
            void loadFilesAndDiff(selectedChange);
          }
          invalidate();
          tui.requestRender();
        }
      }
    } else if (focus === "files") {
      if (data === "d" && selectedChange && files[fileIndex]) {
        const file = files[fileIndex]!;
        void (async () => {
          await restoreFile(pi, cwd, selectedChange!.changeId, file.path);
          changeCache.delete(selectedChange!.changeId);
          await loadFilesAndDiff(selectedChange!);
        })();
        return;
      }

      if (matchesKey(data, "up")) {
        if (fileIndex > 0) {
          fileIndex--;
          if (selectedChange) {
            void loadDiff(selectedChange, files[fileIndex]?.path);
          }
          invalidate();
          tui.requestRender();
        }
      } else if (matchesKey(data, "down")) {
        if (fileIndex < files.length - 1) {
          fileIndex++;
          if (selectedChange) {
            void loadDiff(selectedChange, files[fileIndex]?.path);
          }
          invalidate();
          tui.requestRender();
        }
      }
    }

    if (matchesKey(data, "pageDown") || matchesKey(data, "pageUp")) {
      const direction = matchesKey(data, "pageDown") ? "down" : "up";
      diffScroll = calculateDiffScroll(
        direction,
        diffScroll,
        diffContent.length,
        tui.terminal.rows,
        cachedWidth,
      );
      invalidate();
      tui.requestRender();
    }
  }

  function dispose(): void {
    // Cleanup if needed
  }

  void loadChanges();

  return {
    render,
    handleInput,
    invalidate,
    dispose,
  };
}
