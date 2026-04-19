import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Key } from "@mariozechner/pi-tui";
import {
  ACTION_KEYS,
  createKeyboardHandler,
  buildHelpFromBindings,
  filterActiveBindings,
  type KeyBinding,
} from "../../keyboard";
import { formatErrorMessage } from "../../lib/footer";
import {
  createStatusNotifier,
  type StatusMessageState,
} from "../../lib/ui/status";
import type { Change, FileChange } from "../../lib/types";
import { getRepoRoot } from "../../jj/files";

import { renderDiffWithShiki } from "../../tools/diff";
import { THEME } from "../../tools/shiki-constants";
import { calculateGraphLayout } from "../../lib/graph";
import { openEditor } from "../../lib/editor-utils";

import { DataService } from "./service";
import { ChangesState } from "./state";
import { Navigation, type NavigationCallbacks } from "./navigation";
import { Renderer } from "./renderer";
import { createActionHandlers } from "./actions";
import {
  REVISION_FILTERS,
  type ChangesComponentFactory,
  type ChangesComponentAPI,
} from "./types";
import { notifyMutation } from "../../jj/core";
import { restoreFile } from "../../jj/files";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

const REFRESH_INTERVAL_MS = 2000;

export interface ChangesComponentOptions {
  init: Parameters<NonNullable<ChangesComponentFactory>>[0];
  finish: () => void;
  onInsert?: (text: string) => void;
  onBookmark?: (changeId: string) => Promise<string | null>;
  onFileCmAction?: (
    path: string,
    action: "inspect" | "deps" | "used-by",
  ) => void;
}

export function createChangesComponent(
  options: ChangesComponentOptions,
): ChangesComponentAPI {
  const component = new ChangesComponent(options);
  return component as unknown as ChangesComponentAPI;
}

class ChangesComponent implements Component {
  private service: DataService;
  private state: ChangesState;
  private statusState: StatusMessageState;
  private notify: (message: string, type?: "info" | "error") => void;
  private tui: { requestRender: () => void };
  private pi: ExtensionAPI;
  private ctx!: ExtensionContext;

  private navigation: Navigation;
  private renderer: Renderer;
  private actions: ReturnType<typeof createActionHandlers>;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private helpText = "";

  private leftHandler: (data: string) => void;
  private rightHandler: (data: string) => void;
  private moveHandler: (data: string) => void;

  private get finish() {
    return this.options.finish;
  }

  private get onInsert() {
    return this.options.onInsert;
  }

  private get onBookmark() {
    return this.options.onBookmark;
  }

  private get onFileCmAction() {
    return this.options.onFileCmAction;
  }

  constructor(private options: ChangesComponentOptions) {
    const init = this.options.init;
    const { pi, tui, theme } = init;
    this.pi = pi;
    this.tui = tui;
    this.ctx = init.ctx;

    // Infrastructure
    this.service = new DataService(pi, init.ctx.cwd);
    this.state = new ChangesState();
    this.statusState = { message: null, timeout: null };
    this.notify = createStatusNotifier(this.statusState, () => {
      tui.requestRender();
    });

    // Navigation
    const navigationCallbacks: NavigationCallbacks = {
      onChangeSelected: async (_changeId) => {
        const change =
          this.state.changes[this.state.selectionState.selectedIndex];
        if (!change) return;
        this.state.selectedChange = change;
        await this.loadFilesAndDiff(change).catch(() => {});
      },
      onFileSelected: async (filePath) => {
        if (!this.state.selectedChange) return;
        await this.loadDiff(this.state.selectedChange, filePath);
      },
      onSwitchFocus: () => {
        tui.requestRender();
      },
    };
    this.navigation = new Navigation(this.state, tui, navigationCallbacks);

    this.renderer = new Renderer(this.state, tui, theme);
    this.renderer.setStatusMsg(null);

    const notify: (msg: string, type?: string) => void = (msg, _type) => {
      this.notify(msg);
    };
    this.actions = createActionHandlers({
      pi,
      cwd: init.ctx.cwd,
      state: this.state,
      finish: this.finish,
      refreshAfterMutation: () => this.refreshAfterMutation(),
      restoreSelection: async (prevIndex: number) => {
        this.restoreSelection(prevIndex);
      },
      loadFilesAndDiff: (change: Change) => this.loadFilesAndDiff(change),
      notify,
      onBookmark: this.onBookmark,
      onFileCmAction: this.onFileCmAction,
    });

    const globalBindings = this.getGlobalBindings();
    const leftPaneBindings = this.getLeftPaneBindings();
    const rightPaneBindings = this.getRightPaneBindings();
    const moveModeBindings = this.getMoveModeBindings();

    this.leftHandler = createKeyboardHandler({
      bindings: [...globalBindings, ...leftPaneBindings] as KeyBinding[],
    });
    this.rightHandler = createKeyboardHandler({
      bindings: [...globalBindings, ...rightPaneBindings] as KeyBinding[],
    });
    this.moveHandler = createKeyboardHandler({ bindings: moveModeBindings });

    void this.reloadChanges();
    this.startAutoRefresh();
  }

  // ── Data loading ────────────────────────────────────────────────────────

  private buildGraphInput(): {
    id: string;
    parentIds: string[];
    isWorkingCopy: boolean;
  }[] {
    const changeIdSet = new Set(this.state.changes.map((c) => c.changeId));
    return this.state.changes.map((c) => ({
      id: c.changeId,
      parentIds: (c.parentIds ?? []).filter((pid) => changeIdSet.has(pid)),
      isWorkingCopy:
        this.state.currentChangeId !== null &&
        c.changeId === this.state.currentChangeId,
    }));
  }

  private reloadGraphLayout(): void {
    const input = this.buildGraphInput();
    this.state.graphLayout = calculateGraphLayout(input);
  }

  private async reloadBookmarks(): Promise<void> {
    const bookmarksByChange = await this.service.getBookmarksForChanges(
      this.state.changes,
    );
    this.state.bookmarksByChange.clear();
    for (const [changeId, bookmarks] of bookmarksByChange) {
      this.state.bookmarksByChange.set(changeId, bookmarks);
    }
  }

  private async reloadChanges(): Promise<void> {
    const previousSelectedChangeId =
      this.state.selectedChange?.changeId ?? null;
    try {
      await this.reloadChangesImpl(previousSelectedChangeId);
    } catch (error) {
      this.state.loadingState.loading = false;
      const msg = formatErrorMessage(error);
      this.state.diffContent = [`Error: ${msg}`];
      this.tui.requestRender();
    }
  }

  private async reloadChangesImpl(
    previousSelectedChangeId: string | null,
  ): Promise<void> {
    const filter = REVISION_FILTERS[this.state.currentFilterIndex];
    this.state.changes = await this.service.loadChanges(filter.revision);
    this.state.currentChangeId = await this.service.getCurrentChangeIdShort();
    await this.reloadBookmarks();

    this.state.loadingState.loading = false;

    if (this.state.changes.length > 0) {
      if (this.state.selectedChange?.changeId) {
        await this.handleSelectedChange();
      } else {
        await this.handleNewSelection(previousSelectedChangeId);
      }
    } else {
      this.state.selectionState.selectedIndex = 0;
      this.state.selectedChange = null;
      this.state.files = [];
      this.state.diffContent = [];
      this.state.graphLayout = null;
    }

    this.reloadGraphLayout();
    this.tui.requestRender();
  }

  private async handleSelectedChange(): Promise<void> {
    const matchedIndex = this.state.changes.findIndex(
      (c) => c.changeId === this.state.selectedChange?.changeId,
    );
    if (matchedIndex < 0) {
      this.state.selectionState.selectedIndex = 0;
      this.state.selectedChange = this.state.changes[0];
      await this.loadFilesAndDiff(this.state.selectedChange);
      return;
    }
    this.state.selectionState.selectedIndex = matchedIndex;
    this.state.selectedChange = this.state.changes[matchedIndex];
    this.state.files = await this.service.loadChangedFiles(
      this.state.selectedChange.changeId,
    );
    this.state.selectionState.fileIndex = Math.min(
      this.state.selectionState.fileIndex,
      this.state.files.length - 1,
    );
    const file = this.state.files[this.state.selectionState.fileIndex];
    if (file) {
      await this.loadDiff(this.state.selectedChange, file.path, {
        preserveScroll: true,
      });
    }
  }

  private async handleNewSelection(
    previousSelectedChangeId: string | null,
  ): Promise<void> {
    const preferredChangeId =
      this.state.currentChangeId ?? previousSelectedChangeId;
    const matchedIndex = preferredChangeId
      ? this.state.changes.findIndex((c) => c.changeId === preferredChangeId)
      : -1;
    this.state.selectionState.selectedIndex =
      matchedIndex >= 0 ? matchedIndex : 0;
    this.state.selectedChange =
      this.state.changes[this.state.selectionState.selectedIndex];
    await this.loadFilesAndDiff(this.state.selectedChange);
  }

  private async loadFilesAndDiff(change: Change): Promise<void> {
    if (!this.state.selectedChange) return;
    try {
      this.state.files = await this.service.loadChangedFiles(change.changeId);
      this.state.selectionState.fileIndex = 0;
      await this.loadDiff(change, this.state.files[0]?.path);
    } catch (error) {
      const msg = formatErrorMessage(error);
      this.state.files = [];
      this.state.diffContent = [`Error loading files: ${msg}`];
      this.tui.requestRender();
    }
  }

  private async loadDiff(
    change: Change,
    filePath?: string,
    options?: { preserveScroll?: boolean },
  ): Promise<void> {
    try {
      const diff = await this.service.getRawDiff(change.changeId, filePath);
      this.state.diffContent = await renderDiffWithShiki(diff, THEME);
      if (!options?.preserveScroll) this.state.selectionState.diffScroll = 0;
      this.tui.requestRender();
    } catch (error) {
      const msg = formatErrorMessage(error);
      this.state.diffContent = [`Error: ${msg}`];
      this.tui.requestRender();
    }
  }

  private getCachedFileCache(changeId: string): {
    hit: boolean;
    files?: FileChange[];
    cachedDiff?: string[] | undefined;
  } {
    const cache = this.state.changeCache.get(changeId);
    if (!cache) return { hit: false };
    const files = cache.files;
    const diffKey = files[0]?.path ?? "";
    return { hit: true, files, cachedDiff: cache.diffs.get(diffKey) };
  }

  // ── Action helpers ──────────────────────────────────────────────────────

  private async refreshAfterMutation(): Promise<void> {
    await this.reloadChanges();
  }

  private restoreSelection(prevIndex: number): void {
    if (this.state.changes.length > 0) {
      this.state.selectionState.selectedIndex = Math.min(
        prevIndex,
        this.state.changes.length - 1,
      );
      this.state.selectedChange =
        this.state.changes[this.state.selectionState.selectedIndex];
    } else {
      this.state.selectionState.selectedIndex = 0;
      this.state.selectedChange = null;
      this.state.files = [];
      this.state.diffContent = [];
    }
  }

  private getSelectedFile(): FileChange | undefined {
    if (!this.state.selectedChange) return undefined;
    return this.state.files[this.state.selectionState.fileIndex];
  }

  private async discardFile(): Promise<void> {
    const file = this.getSelectedFile();
    if (!file || !this.state.selectedChange) return;
    try {
      const restoreOutput = await restoreFile(
        this.pi,
        this.ctx.cwd,
        this.state.selectedChange.changeId,
        file.path,
      );
      this.state.changeCache.delete(this.state.selectedChange.changeId);
      await this.loadFilesAndDiff(this.state.selectedChange);
      const msg = `Restored file ${file.path} in change ${this.state.selectedChange.changeId.slice(0, 8)}`;
      notifyMutation(this.pi, msg, restoreOutput);
    } catch (error) {
      this.notify(
        `Failed to discard file: ${formatErrorMessage(error)}`,
        "error",
      );
    }
  }

  private async splitFile(): Promise<void> {
    const file = this.getSelectedFile();
    if (!file || !this.state.selectedChange) return;
    try {
      const msg = buildSplitMessage(file, this.state.selectedChange);
      const repoRoot = await getRepoRoot(this.pi, this.ctx.cwd);
      const splitResult = await this.executeSplit(repoRoot, file, msg);
      await this.restoreSelectionAfterSplit(splitResult, msg);
    } catch (error) {
      this.notify(
        `Failed to split file: ${formatErrorMessage(error)}`,
        "error",
      );
    }
  }

  private executeSplit(
    repoRoot: string,
    file: { path: string },
    msg: string,
  ): Promise<{ code: number; stdout: string; stderr: string }> {
    const changeId = this.state.selectedChange?.changeId;
    if (!changeId) throw new Error("No selected change");
    return this.pi.exec(
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

  private capturePreviousState(): {
    changeId: string;
    fileIndex: number;
  } | null {
    const selectedChange = this.state.selectedChange;
    if (!selectedChange) return null;
    return {
      changeId: selectedChange.changeId,
      fileIndex: this.state.selectionState.fileIndex,
    };
  }

  private async finalizeRestoration(
    splitResult: { stderr: string; stdout: string },
    msg: string,
  ): Promise<void> {
    const currentSelected = this.state.selectedChange;
    if (currentSelected) await this.loadFilesAndDiff(currentSelected);
    this.tui.requestRender();
    notifyMutation(this.pi, msg, splitResult.stderr || splitResult.stdout);
  }

  private async restoreSelectionAfterSplit(
    splitResult: { stderr: string; stdout: string },
    msg: string,
  ): Promise<void> {
    const previous = this.capturePreviousState();
    if (!previous) return;

    this.state.changeCache.clear();
    await this.reloadChanges();
    const restoredIndex = this.findRestoredChangeIndex(previous.changeId);
    if (restoredIndex < 0) return;

    this.applyRestoredSelection(restoredIndex, previous.fileIndex);
    await this.finalizeRestoration(splitResult, msg);
  }

  private findRestoredChangeIndex(prevChangeId: string): number {
    return this.state.changes.findIndex((c) => c.changeId === prevChangeId);
  }

  private applyRestoredSelection(
    restoredIndex: number,
    prevFileIndex: number,
  ): void {
    this.state.selectionState.selectedIndex = restoredIndex;
    this.state.selectedChange = this.state.changes[restoredIndex];
    this.state.selectionState.fileIndex = Math.min(
      prevFileIndex,
      this.state.files.length - 1,
    );
    this.state.selectionState.diffScroll = 0;
  }

  private async pushBookmarks(): Promise<void> {
    if (!this.state.selectedChange) return;
    const bookmarks = this.getBookmarksForSelectedChange();
    if (bookmarks.length === 0) return;

    try {
      const outputs = await this.pushBookmarksToRemote(bookmarks);
      await this.reloadChanges();
      const msg = `Pushed bookmark${pluralize(bookmarks.length, "", "s")}: ${bookmarks.join(", ")}`;
      notifyMutation(this.pi, msg, outputs.join("\n"));
    } catch (error) {
      this.notify(`Failed to push: ${formatErrorMessage(error)}`, "error");
    }
  }

  private getBookmarksForSelectedChange(): string[] {
    if (!this.state.selectedChange) return [];
    return (
      this.state.bookmarksByChange.get(this.state.selectedChange.changeId) ?? []
    );
  }

  private async pushBookmarksToRemote(bookmarks: string[]): Promise<string[]> {
    const outputs: string[] = [];
    for (const bookmark of bookmarks) {
      const r = await this.pi.exec("jj", ["git", "push", "-b", bookmark], {
        cwd: this.ctx.cwd,
      });
      outputs.push(r.stderr || r.stdout);
    }
    return outputs;
  }

  private async setBookmark(): Promise<void> {
    if (!this.canSetBookmark()) return;
    try {
      const result = await this.promptAndApplyBookmark();
      if (!result) return;
      await this.reloadBookmarks();
      this.notifyBookmarkSet(result.bookmarkName, result.changeId);
    } catch (error) {
      this.notify(
        `Failed to update bookmark: ${formatErrorMessage(error)}`,
        "error",
      );
    }
  }

  private canSetBookmark(): boolean {
    return !!(this.state.selectedChange && this.onBookmark);
  }

  private async promptAndApplyBookmark(): Promise<{
    bookmarkName: string;
    changeId: string;
  } | null> {
    const change = this.state.selectedChange;
    if (!change || !this.onBookmark) return null;
    const bookmarkName = await this.onBookmark(change.changeId);
    if (!bookmarkName) return null;
    return { bookmarkName, changeId: change.changeId };
  }

  private notifyBookmarkSet(bookmarkName: string, changeId: string): void {
    const msg = `Updated bookmark '${bookmarkName}' to ${changeId}`;
    notifyMutation(
      this.pi,
      msg,
      `Set bookmark '${bookmarkName}' to ${changeId.slice(0, 8)}`,
    );
  }

  private async applyMoveMode(): Promise<void> {
    if (this.state.mode !== "move") {
      return;
    }

    const currentIndex = this.state.selectionState.selectedIndex;
    if (currentIndex === this.state.moveOriginalIndex) {
      this.state.mode = "normal";
      this.tui.requestRender();
      return;
    }

    try {
      await this.performRebase();
      this.state.mode = "normal";
      this.state.changeCache.clear();
      await this.reloadChanges();
    } catch (error) {
      this.notify(`Failed to move: ${formatErrorMessage(error)}`, "error");
      this.navigation.cancelMoveMode();
    }
  }

  private async performRebase(): Promise<void> {
    if (!this.state.selectedChange) return;
    const plan = this.resolveRebasePlan();
    if (!plan) return;

    const change = this.state.selectedChange;
    const result = await this.pi.exec(
      "jj",
      ["rebase", "-r", change.changeId, plan.flag, plan.targetChangeId],
      { cwd: this.ctx.cwd },
    );

    notifyMutation(
      this.pi,
      `Moved change ${change.changeId.slice(0, 8)} after ${plan.targetChangeId}`,
      pickOutput(result.stderr, result.stdout),
    );
  }

  private resolveRebasePlan(): {
    targetChangeId: string;
    flag: string;
  } | null {
    const { currentIndex, originalIndex } = this.getRebaseOffsets();
    const { targetChange, flag } = this.resolveRebaseTarget(
      currentIndex,
      originalIndex,
    );
    if (!targetChange) return null;
    return { targetChangeId: targetChange.changeId.slice(0, 8), flag };
  }

  private getRebaseOffsets(): {
    currentIndex: number;
    originalIndex: number;
  } {
    return {
      currentIndex: this.state.selectionState.selectedIndex,
      originalIndex: this.state.moveOriginalIndex,
    };
  }

  private resolveRebaseTarget(
    currentIndex: number,
    originalIndex: number,
  ): { targetChange: Change | null; flag: string } {
    const goingUp = currentIndex < originalIndex;
    const target =
      this.state.changes[goingUp ? currentIndex + 1 : currentIndex - 1];
    return {
      targetChange: target ?? null,
      flag: goingUp ? "--after" : "--before",
    };
  }

  private cycleFilter(direction: 1 | -1): void {
    this.state.currentFilterIndex =
      (this.state.currentFilterIndex + direction + REVISION_FILTERS.length) %
      REVISION_FILTERS.length;
    this.state.selectionState.selectedIndex = 0;
    this.state.selectionState.fileIndex = 0;
    this.state.selectionState.diffScroll = 0;
    this.state.changeCache.clear();
    void this.reloadChanges();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(width: number): string[] {
    this.helpText = this.buildHelpText();
    return this.renderer.render(width, this.helpText);
  }

  private buildHelpText(): string {
    const bindings = this.getBindingsForModeOrPane();
    const activeBindings = filterActiveBindings(bindings);
    return buildHelpFromBindings(activeBindings);
  }

  // ── Keyboard input ────────────────────────────────────────────────────────

  private navigateMove(direction: "up" | "down"): void {
    try {
      this.navigation.moveChange(direction);
      const change =
        this.state.changes[this.state.selectionState.selectedIndex];
      if (change) {
        this.state.selectedChange = change;
        const result = this.navigation.onChangeSelected(change.changeId);
        if (result instanceof Promise) {
          void result.catch(() => {});
        }
      }
    } catch {
      // Silently ignore - render will show error state if needed
    }
    this.tui.requestRender();
  }

  private getMoveModeBindings(): KeyBinding[] {
    return [
      {
        key: "up",
        label: "move",
        handler: () => {
          this.navigateMove("up");
        },
      },
      {
        key: "down",
        handler: () => {
          this.navigateMove("down");
        },
      },
      {
        key: "enter",
        label: "apply",
        handler: () => {
          void this.applyMoveMode();
        },
      },
      {
        key: "escape",
        label: "cancel",
        handler: () => {
          this.navigation.cancelMoveMode();
          this.tui.requestRender();
        },
      },
    ];
  }

  private getLeftPaneBindings(): KeyBinding[] {
    return [...this.getChangeNavBindings(), ...this.getChangeActionBindings()];
  }

  private getChangeNavBindings(): KeyBinding[] {
    return [
      {
        key: "up",
        handler: () => {
          this.navigation.navigateChanges("up");
        },
      },
      {
        key: "down",
        handler: () => {
          this.navigation.navigateChanges("down");
        },
      },
      {
        key: "pageUp",
        label: "scroll",
        handler: () => {
          this.navigation.navigateChanges("pageUp");
        },
      },
      {
        key: "pageDown",
        handler: () => {
          this.navigation.navigateChanges("pageDown");
        },
      },
      {
        key: Key.ctrl("/"),
        label: "filter",
        handler: () => {
          this.cycleFilter(1);
          this.tui.requestRender();
        },
      },
      {
        key: "space",
        label: "select",
        when: () => !!this.state.selectedChange,
        handler: () => {
          if (this.state.selectedChange) this.navigation.toggleSelection();
          this.tui.requestRender();
        },
      },
    ];
  }

  private getChangeActionBindings(): KeyBinding[] {
    return [
      ...this.getBasicChangeActions(),
      ...this.getAdvancedChangeActions(),
    ];
  }

  private getBasicChangeActions(): KeyBinding[] {
    const hasSelection = () => !!this.state.selectedChange;
    return [
      {
        key: "n",
        label: "new",
        when: hasSelection,
        handler: () => void this.actions.handleNew(),
      },
      {
        key: "e",
        label: "edit",
        when: hasSelection,
        handler: () => void this.actions.handleEdit(),
      },
      {
        key: "r",
        label: "revert",
        when: hasSelection,
        handler: () => void this.actions.handleRevert(),
      },
      {
        key: "d",
        label: "describe",
        when: () =>
          !!this.state.selectedChange || this.state.selectedChangeIds.size > 0,
        handler: () => void this.actions.handleDescribe(),
      },
      {
        key: "s",
        label: "split",
        when: hasSelection,
        handler: () => void this.actions.handleSplit(),
      },
      {
        key: "i",
        label: "inspect",
        when: hasSelection,
        handler: () => void this.actions.handleInspectChange(),
      },
    ];
  }

  private getAdvancedChangeActions(): KeyBinding[] {
    const hasSelection = () => !!this.state.selectedChange;
    return [
      {
        key: "f",
        label: "fixup",
        when: () =>
          !!this.state.selectedChange &&
          this.state.changes.length > 1 &&
          this.state.selectionState.selectedIndex <
            this.state.changes.length - 1,
        handler: () => void this.actions.handleSquash(),
      },
      {
        key: Key.ctrl("m"),
        label: "move",
        when: () =>
          !!this.state.selectedChange &&
          this.state.changes.length > 1 &&
          this.state.currentChangeId !== this.state.selectedChange?.changeId,
        handler: () => {
          this.navigation.enterMoveMode();
          this.tui.requestRender();
        },
      },
      {
        key: Key.ctrl("i"),
        label: "insert",
        when: () => !!this.state.selectedChange && this.onInsert !== undefined,
        handler: () => {
          if (this.state.selectedChange && this.onInsert)
            this.onInsert(this.state.selectedChange.changeId);
          this.finish();
        },
      },
      {
        key: "b",
        label: "bookmark",
        when: () => hasSelection() && this.onBookmark !== undefined,
        handler: () => void this.setBookmark(),
      },
      {
        key: Key.ctrl("p"),
        label: "push",
        when: () =>
          !!this.state.selectedChange &&
          this.state.bookmarksByChange.get(this.state.selectedChange.changeId)
            ?.length !== undefined,
        handler: () => void this.pushBookmarks(),
      },
      {
        key: ACTION_KEYS.delete,
        label: "drop",
        when: hasSelection,
        handler: () => void this.actions.handleDrop(),
      },
    ];
  }

  private getRightPaneBindings(): KeyBinding[] {
    return [
      ...this.getFileNavBindings(),
      ...this.getFileActionBindings(),
      ...this.getDiffScrollBindings(),
    ];
  }

  private getFileNavBindings(): KeyBinding[] {
    return [
      {
        key: "up",
        handler: () => {
          this.navigation.navigateFiles("up");
        },
      },
      {
        key: "down",
        handler: () => {
          this.navigation.navigateFiles("down");
        },
      },
      {
        key: "pageUp",
        label: "scroll",
        handler: () => {
          this.navigation.navigateFiles("pageUp");
        },
      },
      {
        key: "pageDown",
        label: "scroll",
        handler: () => {
          this.navigation.navigateFiles("pageDown");
        },
      },
      {
        key: "e",
        label: "edit",
        when: () =>
          this.state.files[this.state.selectionState.fileIndex] !== undefined,
        handler: () => {
          const file = this.state.files[this.state.selectionState.fileIndex];
          if (file) void openEditor(this.pi, this.ctx, file.path);
        },
      },
      {
        key: "s",
        label: "split",
        when: () =>
          !!this.state.selectedChange &&
          this.state.files[this.state.selectionState.fileIndex] !== undefined,
        handler: () => void this.splitFile(),
      },
      {
        key: "d",
        label: "discard",
        when: () =>
          !!this.state.selectedChange &&
          this.state.files[this.state.selectionState.fileIndex] !== undefined,
        handler: () => void this.discardFile(),
      },
    ];
  }

  private getDiffScrollBindings(): KeyBinding[] {
    return [
      {
        key: Key.ctrl("i"),
        label: "insert",
        when: () => !!this.state.selectedChange && this.state.files.length > 0,
        handler: () => {
          const file = this.state.files[this.state.selectionState.fileIndex];
          if (!file || !this.onInsert) return;
          this.onInsert(file.path);
          this.finish();
        },
      },
      {
        key: "shift+pageUp",
        label: "scroll",
        handler: () => {
          this.navigation.scrollDiff("up");
          this.tui.requestRender();
        },
      },
      {
        key: "shift+pageDown",
        handler: () => {
          this.navigation.scrollDiff("down");
          this.tui.requestRender();
        },
      },
    ];
  }

  private getFileActionBindings(): KeyBinding[] {
    const makeBinding = (
      ctrlKey: "t" | "d" | "u",
      label: string,
      action: "inspect" | "deps" | "used-by",
    ): KeyBinding => ({
      key: Key.ctrl(ctrlKey),
      label,
      when: () => !!this.state.selectedChange && this.state.files.length > 0,
      handler: () => {
        const file = this.state.files[this.state.selectionState.fileIndex];
        if (!file || !this.onFileCmAction) return;
        this.onFileCmAction(file.path, action);
      },
    });
    return [
      makeBinding("t", "inspect", "inspect"),
      makeBinding("d", "deps", "deps"),
      makeBinding("u", "used-by", "used-by"),
    ];
  }

  private getGlobalBindings(): KeyBinding[] {
    return [
      {
        key: "tab",
        label: "pane",
        handler: () => {
          this.navigation.switchFocus();
          this.tui.requestRender();
        },
      },
      {
        key: "escape",
        handler: () => {
          this.finish();
        },
      },
      {
        key: "q",
        handler: () => {
          this.finish();
        },
      },
    ];
  }

  private getBindingsForModeOrPane(): KeyBinding[] {
    if (this.state.mode === "move") return this.getMoveModeBindings();
    if (this.state.selectionState.focus === "left")
      return [...this.getGlobalBindings(), ...this.getLeftPaneBindings()];
    return [...this.getGlobalBindings(), ...this.getRightPaneBindings()];
  }

  handleInput(data: string): void {
    if (this.state.mode === "move") {
      this.moveHandler(data);
      return;
    }
    const handler =
      this.state.selectionState.focus === "left"
        ? this.leftHandler
        : this.rightHandler;
    handler(data);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      if (this.state.mode === "normal") {
        void this.reloadChanges();
      }
    }, REFRESH_INTERVAL_MS);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private dispose(): void {
    this.stopAutoRefresh();
  }

  invalidate(): void {}
}

function buildSplitMessage(
  file: { path: string },
  change: { changeId: string },
): string {
  return `Moved ${file.path} from change ${change.changeId.slice(0, 8)} to a new change`;
}

function pickOutput(stderr: string, stdout: string): string {
  if (stderr) return stderr;
  return stdout || "";
}
