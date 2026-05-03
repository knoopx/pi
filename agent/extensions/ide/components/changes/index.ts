import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import {
  buildHelpFromBindings,
  filterActiveBindings,
  createKeyboardHandler,
  type KeyBinding,
} from "../../keyboard";
import { formatErrorMessage } from "../../lib/footer";
import {
  createStatusNotifier,
  type StatusMessageState,
} from "../../lib/ui/status";
import type { Change } from "../../lib/types";

import { renderDiffWithShiki } from "../../tools/diff";
import { THEME } from "../../tools/shiki-constants";

import { DataService } from "./service";
import { ChangesState } from "./state";
import { Navigation } from "./navigation";
import type { NavigationCallbacks } from "./navigation";
import { Renderer } from "./renderer";
import { createActionHandlers } from "./actions";
import {
  REVISION_FILTERS,
  type ChangesComponentFactory,
  type ChangesComponentAPI,
} from "./types";
import { buildKeyboardBindings, getBindingsForPane } from "./keyboard";
import { createOperations } from "./operations";
import { createDataLoading } from "./data-loading";
import { openEditor } from "../../lib/editor-utils";

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
  return new ChangesComponent(options);
}

class ChangesComponent implements Component, ChangesComponentAPI {
  private service: DataService;
  private state: ChangesState;
  private statusState: StatusMessageState;
  private notify: (message: string, type?: "info" | "error") => void;
  private tui: { requestRender: () => void };
  private pi: ExtensionAPI;
  private ctx: ExtensionContext;

  private navigation: Navigation;
  private renderer: Renderer;
  private actions: ReturnType<typeof createActionHandlers>;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private helpText = "";

  private leftHandler: (data: string) => void;
  private rightHandler: (data: string) => void;
  private moveHandler: (data: string) => void;

  private moveBindings: KeyBinding[] = [];
  private leftPaneBindings: KeyBinding[] = [];
  private rightPaneBindings: KeyBinding[] = [];
  private globalBindings: KeyBinding[] = [];

  private dataLoading: ReturnType<typeof createDataLoading>;
  private operations: ReturnType<typeof createOperations>;

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

  private get serviceCallbacks() {
    return {
      loadBookmarksForChanges: (changes: Change[]) =>
        this.service.getBookmarksForChanges(changes),
      loadChangedFiles: (changeId: string) =>
        this.service.loadChangedFiles(changeId),
    };
  }

  constructor(private options: ChangesComponentOptions) {
    const init = this.options.init;
    const { pi, tui, theme } = init;
    this.pi = pi;
    this.tui = tui;
    this.ctx = init.ctx;

    this.service = new DataService(pi, init.ctx.cwd);
    this.state = new ChangesState();
    this.statusState = { message: null, timeout: null };
    this.notify = createStatusNotifier(this.statusState, () => {
      tui.requestRender();
    });

    const navigationCallbacks: NavigationCallbacks = {
      onChangeSelected: async (_changeId) => {
        const change =
          this.state.changes[this.state.selectionState.selectedIndex];
        if (!change) return;
        this.state.selectedChange = change;
        await this.loadFilesAndDiff(change);
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
      restoreSelection: (prevIndex: number) =>
        this.restoreSelectionAndDiff(prevIndex),
      notify,
      onBookmark: this.onBookmark,
      onFileCmAction: this.onFileCmAction,
    });

    this.dataLoading = createDataLoading(this.state, {
      loadChanges: (revision) => this.service.loadChanges(revision),
      getCurrentChangeIdShort: () => this.service.getCurrentChangeIdShort(),
      ...this.serviceCallbacks,
      getRawDiff: (changeId, filePath) =>
        this.service.getRawDiff(changeId, filePath),
      renderDiffWithShiki: (diff) => renderDiffWithShiki(diff, THEME),
      requestRender: () => tui.requestRender(),
    });

    this.operations = createOperations({
      pi,
      cwd: init.ctx.cwd,
      state: this.state,
      finish: this.finish,
      refreshAfterMutation: () => this.refreshAfterMutation(),
      restoreSelection: (prevIndex) => this.restoreSelectionAndDiff(prevIndex),
      notify,
      onBookmark: this.onBookmark,
      onFileCmAction: this.onFileCmAction,
      requestRender: () => tui.requestRender(),
      cancelMoveMode: () => {
        this.navigation.cancelMoveMode();
        tui.requestRender();
      },
      navigateMove: (direction) => this.navigateMove(direction),
      onChangeSelected: (_changeId) => {
        const change =
          this.state.changes[this.state.selectionState.selectedIndex];
        if (!change) return;
        this.state.selectedChange = change;
        return this.loadFilesAndDiff(change);
      },
      ...this.serviceCallbacks,
      getRawDiff: (changeId, filePath) =>
        this.service.getRawDiff(changeId, filePath),
      renderDiffWithShiki: (diff) => renderDiffWithShiki(diff, THEME),
      loadChanges: (revision) => this.service.loadChanges(revision),
    });

    const { moveBindings, leftBindings, rightBindings, globalBindings } =
      buildKeyboardBindings(this.state, this.navigation, {
        cycleFilter: (direction) => this.cycleFilter(direction),
        handleNew: () => void this.actions.handleNew(),
        handleEdit: () => void this.actions.handleEdit(),
        handleRevert: () => void this.actions.handleRevert(),
        handleDescribe: () => void this.actions.handleDescribe(),
        handleSplit: () => void this.actions.handleSplit(),
        handleInspectChange: () => void this.actions.handleInspectChange(),
        handleSquash: () => void this.actions.handleSquash(),
        handleDrop: () => void this.actions.handleDrop(),
        setBookmark: () => void this.operations.setBookmark(),
        pushBookmarks: () => void this.operations.pushBookmarks(),
        splitFile: () => void this.operations.splitFile(),
        discardFile: () => void this.operations.discardFile(),
        applyMoveMode: () => void this.operations.applyMoveMode(),
        navigateMove: (direction) => this.navigateMove(direction),
        openEditor: (path) => openEditor(this.pi, this.ctx, path),
        onInsert: this.onInsert,
        onBookmark: this.onBookmark,
        onFileCmAction: this.onFileCmAction,
        finish: this.finish,
        requestRender: () => tui.requestRender(),
      });

    this.leftHandler = createKeyboardHandler({
      bindings: [...globalBindings, ...leftBindings] as KeyBinding[],
    });
    this.rightHandler = createKeyboardHandler({
      bindings: [...globalBindings, ...rightBindings] as KeyBinding[],
    });
    this.moveHandler = createKeyboardHandler({ bindings: moveBindings });

    void this.dataLoading.reloadChanges();
    this.startAutoRefresh();
  }

  private async refreshAfterMutation(): Promise<void> {
    await this.dataLoading.refreshAfterMutation();
  }

  private async restoreSelectionAndDiff(prevIndex: number): Promise<void> {
    await this.dataLoading.restoreSelectionAndDiff(prevIndex);
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

  private cycleFilter(direction: 1 | -1): void {
    this.navigation.cycleFilter(direction, REVISION_FILTERS.length);
    this.state.selectionState.selectedIndex = 0;
    this.state.selectionState.fileIndex = 0;
    this.state.selectionState.diffScroll = 0;
    this.state.changeCache.clear();
    void this.dataLoading.reloadChanges();
  }

  private navigateMove(direction: "up" | "down"): void {
    try {
      this.navigation.moveChange(direction);
      const change =
        this.state.changes[this.state.selectionState.selectedIndex];
      if (change) {
        this.state.selectedChange = change;
        const result = this.navigation.onChangeSelected(change.changeId);
        if (result instanceof Promise) {
          void result.catch((error) => {
            this.notify(
              `onChangeSelected failed: ${formatErrorMessage(error)}`,
              "error",
            );
          });
        }
      }
    } catch (error) {
      this.notify(
        `Changes component update failed: ${formatErrorMessage(error)}`,
        "error",
      );
    }
    this.tui.requestRender();
  }

  render(width: number): string[] {
    this.helpText = this.buildHelpText();
    return this.renderer.render(width, this.helpText);
  }

  private buildHelpText(): string {
    const bindings = this.getBindingsForModeOrPane();
    const activeBindings = filterActiveBindings(bindings);
    return buildHelpFromBindings(activeBindings);
  }

  private getBindingsForModeOrPane(): KeyBinding[] {
    return getBindingsForPane(
      this.state,
      this.moveBindings,
      this.leftPaneBindings,
      this.rightPaneBindings,
      this.globalBindings,
    );
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

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => {
      if (this.state.mode === "normal") {
        void this.dataLoading.reloadChanges();
      }
    }, REFRESH_INTERVAL_MS);
  }

  dispose(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  invalidate(): void {}
}
