import type { Component } from "@mariozechner/pi-tui";
import { Key } from "@mariozechner/pi-tui";
import {
  ACTION_KEYS,
  createKeyboardHandler,
  buildHelpFromBindings,
  filterActiveBindings,
  type KeyBinding,
} from "../keyboard";
import { formatErrorMessage } from "./formatting-utils";
import { createStatusNotifier, type StatusMessageState } from "./ui/status";
import type { Change, FileChange } from "../types";
import {
  loadChangedFiles,
  getRawDiff,
  restoreFile,
  getCurrentChangeIdShort,
  notifyMutation,
} from "../jj";
import path from "node:path";

import { getTheme, renderDiffWithShiki } from "../tools/diff";
import { calculateGraphLayout } from "./graph";

import { DataService } from "./changes/service";
import { ChangesState } from "./changes/state";
import { Navigation, type NavigationCallbacks } from "./changes/navigation";
import { Renderer } from "./changes/renderer";
import { createActionHandlers } from "./changes/actions";
import {
  REVISION_FILTERS,
  type ChangesComponentFactory,
  type ChangesComponentAPI,
} from "./changes/types";

const REFRESH_INTERVAL_MS = 2000;

export function createChangesComponent(
  init: Parameters<NonNullable<ChangesComponentFactory>>[0],
  finish: () => void,
  onInsert?: (text: string) => void,
  onBookmark?: (changeId: string) => Promise<string | null>,
  onFileCmAction?: (
    path: string,
    action: "inspect" | "deps" | "used-by",
  ) => void,
): ChangesComponentAPI {
  const component = new ChangesComponent(
    init,
    finish,
    onInsert,
    onBookmark,
    onFileCmAction,
  );
  return component as unknown as ChangesComponentAPI;
}

class ChangesComponent implements Component {
  private service: DataService;
  private state: ChangesState;
  private statusState: StatusMessageState;
  private notify: (message: string, type?: "info" | "error") => void;
  private tui: { requestRender: () => void };
  private pi: any;
  private cwd: string;

  private navigation: Navigation;
  private renderer: Renderer;
  private actions: ReturnType<typeof createActionHandlers>;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private helpText = "";

  private leftHandler: (data: string) => void;
  private rightHandler: (data: string) => void;
  private moveHandler: (data: string) => void;

  constructor(
    init: Parameters<NonNullable<ChangesComponentFactory>>[0],
    private finish: () => void,
    private onInsert?: (text: string) => void,
    private onBookmark?: (changeId: string) => Promise<string | null>,
    private onFileCmAction?: (
      path: string,
      action: "inspect" | "deps" | "used-by",
    ) => void,
  ) {
    const { pi, tui, theme } = init;
    this.pi = pi;
    this.tui = tui;
    this.cwd = init.cwd;

    // Infrastructure
    this.service = new DataService(pi, init.cwd);
    this.state = new ChangesState();
    this.statusState = { message: null, timeout: null };
    this.notify = createStatusNotifier(this.statusState, () => {
      this.state.loadingState.cachedLines = [];
      this.state.loadingState.cachedWidth = 0;
      tui.requestRender();
    });

    // Navigation
    const navigationCallbacks: NavigationCallbacks = {
      onChangeSelected: async (changeId) => {
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
        this.state.loadingState.cachedLines = [];
        tui.requestRender();
      },
    };
    this.navigation = new Navigation(this.state, tui, navigationCallbacks);

    this.renderer = new Renderer(this.state, tui, theme);
    this.renderer.setStatusMsg(null);

    const notify: (msg: string, type?: string) => void = (msg, _type) =>
      this.notify(msg);
    this.actions = createActionHandlers(
      pi,
      init.cwd,
      this.state,
      finish,
      () => this.refreshAfterMutation(),
      (prevIndex: number) => this.restoreSelection(prevIndex),
      (change: Change) => this.loadFilesAndDiff(change),
      notify,
      onBookmark,
      onFileCmAction,
    );

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
      this.state.loadingState.cachedLines = [];
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
    this.state.loadingState.cachedLines = [];
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
      this.state.loadingState.cachedLines = [];
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
      const themeInstance = await getTheme(this.pi, this.cwd);
      this.state.diffContent = await renderDiffWithShiki(diff, themeInstance);
      if (!options?.preserveScroll) this.state.selectionState.diffScroll = 0;
      this.state.loadingState.cachedLines = [];
      this.tui.requestRender();
    } catch (error) {
      const msg = formatErrorMessage(error);
      this.state.diffContent = [`Error: ${msg}`];
      this.state.loadingState.cachedLines = [];
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

  private async restoreSelection(prevIndex: number): Promise<void> {
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

  private getSelectedFile(): import("../types").FileChange | undefined {
    if (!this.state.selectedChange) return undefined;
    return this.state.files[this.state.selectionState.fileIndex];
  }

  private async discardFile(): Promise<void> {
    const file = this.getSelectedFile();
    if (!file || !this.state.selectedChange) return;
    try {
      const restoreOutput = await restoreFile(
        this.pi,
        this.cwd,
        this.state.selectedChange.changeId,
        file.path,
      );
      this.state.changeCache.delete(this.state.selectedChange.changeId);
      await this.loadFilesAndDiff(this.state.selectedChange);
      const msg = `Restored file ${file.path} in change ${this.state.selectedChange!.changeId.slice(0, 8)}`;
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
    if (!file) return;
    try {
      const msg = `Moved ${file.path} from change ${this.state.selectedChange!.changeId.slice(0, 8)} to a new change`;
      const splitResult = await this.pi.exec(
        "jj",
        [
          "split",
          "-m",
          msg,
          "-r",
          this.state.selectedChange!.changeId,
          "--insert-after",
          this.state.selectedChange!.changeId,
          file.path,
        ],
        { cwd: this.cwd },
      );
      const prevChangeId = this.state.selectedChange!.changeId;
      const prevFileIndex = this.state.selectionState.fileIndex;
      const prevFileCount = this.state.files.length;
      this.state.changeCache.clear();
      await this.reloadChanges();
      const restoredIndex = this.state.changes.findIndex(
        (c) => c.changeId === prevChangeId,
      );
      if (restoredIndex < 0) return;
      this.state.selectionState.selectedIndex = restoredIndex;
      this.state.selectedChange = this.state.changes[restoredIndex];
      this.state.selectionState.fileIndex = Math.min(
        prevFileIndex,
        this.state.files.length - 1,
      );
      this.state.selectionState.diffScroll = 0;
      await this.loadFilesAndDiff(this.state.selectedChange);
      this.state.loadingState.cachedLines = [];
      this.tui.requestRender();
      notifyMutation(this.pi, msg, splitResult.stderr || splitResult.stdout);
    } catch (error) {
      this.notify(
        `Failed to split file: ${formatErrorMessage(error)}`,
        "error",
      );
    }
  }

  private async pushBookmarks(): Promise<void> {
    if (!this.state.selectedChange) return;
    const bookmarks =
      this.state.bookmarksByChange.get(this.state.selectedChange.changeId) ??
      [];
    if (bookmarks.length === 0) return;

    try {
      const outputs: string[] = [];
      for (const bookmark of bookmarks) {
        const r = await this.pi.exec("jj", ["git", "push", "-b", bookmark], {
          cwd: this.cwd,
        });
        outputs.push(r.stderr || r.stdout);
      }
      await this.reloadChanges();
      const msg = `Pushed bookmark${bookmarks.length > 1 ? "s" : ""}: ${bookmarks.join(", ")}`;
      notifyMutation(this.pi, msg, outputs.join("\n"));
    } catch (error) {
      this.notify(`Failed to push: ${formatErrorMessage(error)}`, "error");
    }
  }

  private async setBookmark(): Promise<void> {
    if (!this.state.selectedChange || !this.onBookmark) return;
    try {
      const bookmarkName = await this.onBookmark(
        this.state.selectedChange.changeId,
      );
      if (!bookmarkName) return;
      await this.reloadBookmarks();
      const msg = `Updated bookmark '${bookmarkName}' to ${this.state.selectedChange.changeId}`;
      notifyMutation(
        this.pi,
        msg,
        `Set bookmark '${bookmarkName}' to ${this.state.selectedChange.changeId.slice(0, 8)}`,
      );
    } catch (error) {
      this.notify(
        `Failed to update bookmark: ${formatErrorMessage(error)}`,
        "error",
      );
    }
  }

  private async applyMoveMode(): Promise<void> {
    if (this.state.mode !== "move") {
      return;
    }

    const currentIndex = this.state.selectionState.selectedIndex;
    if (currentIndex === this.state.moveOriginalIndex) {
      this.state.mode = "normal";
      this.state.loadingState.cachedLines = [];
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
    const changeToMove = this.state.selectedChange;
    if (!changeToMove) return;
    const currentIndex = this.state.selectionState.selectedIndex;
    let result: { stderr?: string; stdout?: string };
    let targetChange: Change | null = null;

    if (currentIndex < this.state.moveOriginalIndex) {
      targetChange = this.state.changes[currentIndex + 1];
      if (!targetChange) return;
      result = await this.pi.exec(
        "jj",
        [
          "rebase",
          "-r",
          changeToMove.changeId,
          "--after",
          targetChange.changeId,
        ],
        { cwd: this.cwd },
      );
    } else {
      targetChange = this.state.changes[currentIndex - 1];
      if (!targetChange) return;
      result = await this.pi.exec(
        "jj",
        [
          "rebase",
          "-r",
          changeToMove.changeId,
          "--before",
          targetChange.changeId,
        ],
        { cwd: this.cwd },
      );
    }

    const msg = `Moved change ${changeToMove.changeId.slice(0, 8)} after ${targetChange.changeId.slice(0, 8)}`;
    notifyMutation(this.pi, msg, result.stderr ?? result.stdout ?? "");
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
      // Ignore errors — state is still valid, just skip async file loading.
    }
    this.tui.requestRender();
  }

  private getMoveModeBindings(): KeyBinding[] {
    return [
      {
        key: "up",
        label: "move",
        handler: () => this.navigateMove("up"),
      },
      {
        key: "down",
        handler: () => this.navigateMove("down"),
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
          this.state.loadingState.cachedLines = [];
          this.tui.requestRender();
        },
      },
    ];
  }

  private getLeftPaneBindings(): KeyBinding[] {
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
          this.state.loadingState.cachedLines = [];
          this.tui.requestRender();
        },
      },
      {
        key: "space",
        label: "select",
        when: () => !!this.state.selectedChange,
        handler: () => {
          if (this.state.selectedChange) this.navigation.toggleSelection();
          this.state.loadingState.cachedLines = [];
          this.tui.requestRender();
        },
      },
      {
        key: "n",
        label: "new",
        when: () => !!this.state.selectedChange,
        handler: () => {
          void this.actions.handleNew();
        },
      },
      {
        key: "e",
        label: "edit",
        when: () => !!this.state.selectedChange,
        handler: () => {
          void this.actions.handleEdit();
        },
      },
      {
        key: "r",
        label: "revert",
        when: () => !!this.state.selectedChange,
        handler: () => {
          void this.actions.handleRevert();
        },
      },
      {
        key: "d",
        label: "describe",
        when: () =>
          !!this.state.selectedChange || this.state.selectedChangeIds.size > 0,
        handler: () => {
          void this.actions.handleDescribe();
        },
      },
      {
        key: "s",
        label: "split",
        when: () => !!this.state.selectedChange,
        handler: () => {
          void this.actions.handleSplit();
        },
      },
      {
        key: "f",
        label: "fixup",
        when: () =>
          !!this.state.selectedChange &&
          this.state.changes.length > 1 &&
          this.state.selectionState.selectedIndex <
            this.state.changes.length - 1,
        handler: () => {
          void this.actions.handleSquash();
        },
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
          this.state.loadingState.cachedLines = [];
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
        when: () =>
          !!this.state.selectedChange && this.onBookmark !== undefined,
        handler: () => {
          void this.setBookmark();
        },
      },
      {
        key: "i",
        label: "inspect",
        when: () => !!this.state.selectedChange,
        handler: () => {
          void this.actions.handleInspectChange();
        },
      },
      {
        key: Key.ctrl("p"),
        label: "push",
        when: () =>
          !!this.state.selectedChange &&
          this.state.bookmarksByChange.get(this.state.selectedChange.changeId)
            ?.length !== undefined,
        handler: () => {
          void this.pushBookmarks();
        },
      },
      {
        key: ACTION_KEYS.delete,
        label: "drop",
        when: () => !!this.state.selectedChange,
        handler: () => {
          void this.actions.handleDrop();
        },
      },
    ];
  }

  private getRightPaneBindings(): KeyBinding[] {
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
          if (file)
            void this.pi.exec("editor", [path.join(this.cwd, file.path)]);
        },
      },
      {
        key: "s",
        label: "split",
        when: () =>
          !!this.state.selectedChange &&
          this.state.files[this.state.selectionState.fileIndex] !== undefined,
        handler: () => {
          void this.splitFile();
        },
      },
      {
        key: "d",
        label: "discard",
        when: () =>
          !!this.state.selectedChange &&
          this.state.files[this.state.selectionState.fileIndex] !== undefined,
        handler: () => {
          void this.discardFile();
        },
      },
      ...this.getFileActionBindings(),
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
          this.state.loadingState.cachedLines = [];
          this.tui.requestRender();
        },
      },
      {
        key: "shift+pageDown",
        handler: () => {
          this.navigation.scrollDiff("down");
          this.state.loadingState.cachedLines = [];
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
          this.state.loadingState.cachedLines = [];
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
        this.state.loadingState.cachedLines = [];
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

  invalidate(): void {
    this.state.loadingState.cachedLines = [];
    this.state.loadingState.cachedWidth = 0;
  }
}
