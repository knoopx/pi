import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import {
  buildHelpFromBindings,
  filterActiveBindings,
  createKeyboardHandler,
  type KeyBinding,
} from "../../lib/keyboard/handler";
import { formatErrorMessage } from "../../lib/ui/footer";
import {
  createStatusNotifier,
  type StatusMessageState,
} from "../../lib/ui/status";
import type { Change } from "../../types";

import { renderDiffWithShiki } from "../../tools/diff";
import { THEME } from "../../tools/shiki/constants";

import { DataService } from "./service";
import { ChangesState } from "./state";
import { Navigation } from "./navigation";
import type { NavigationCallbacks } from "./navigation";
import { Renderer } from "./renderer";
import {
  REVISION_FILTERS,
  type ChangesComponentFactory,
  type ChangesComponentAPI,
} from "./types";
import { buildKeyboardBindings, getBindingsForPane } from "./keyboard";
import { createOperations } from "./operations/create";
import { createDataLoading } from "./loading";
import { openEditor } from "../../lib/open-editor";

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
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private helpText = "";

  private leftHandler: (data: string) => void = () => {};
  private rightHandler: (data: string) => void = () => {};
  private moveHandler: (data: string) => void = () => {};

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

    this.navigation = this.createNavigation(tui);
    this.renderer = new Renderer(this.state, tui, theme);
    this.renderer.setStatusMsg(null);

    const notify: (msg: string, type?: string) => void = (msg, _type) => {
      this.notify(msg);
    };
    this.dataLoading = this.createDataLoading(tui);
    this.operations = this.createOperations(pi, init.ctx.cwd, notify, tui);

    this.initKeyboardHandlers();
    void this.dataLoading.reloadChanges();
    this.startAutoRefresh();
  }

  private createNavigation(tui: { requestRender: () => void }): Navigation {
    const navigationCallbacks: NavigationCallbacks = {
      onChangeSelected: async (_changeId) => {
        const change =
          this.state.changes[this.state.selectionState.selectedIndex];
        if (!change) return;
        this.state.selectedChange = change;
        await this.dataLoading.loadFilesAndDiff(change);
      },
      onFileSelected: async (filePath) => {
        if (!this.state.selectedChange) return;
        await this.dataLoading.loadDiff(this.state.selectedChange, filePath);
      },
      onSwitchFocus: () => {
        tui.requestRender();
      },
    };
    return new Navigation(this.state, tui, navigationCallbacks);
  }

  private createDataLoading(tui: { requestRender: () => void }) {
    return createDataLoading(this.state, {
      loadChanges: (revision) => this.service.loadChanges(revision),
      getCurrentChangeIdShort: () => this.service.getCurrentChangeIdShort(),
      ...this.serviceCallbacks,
      getRawDiff: (changeId, filePath) =>
        this.service.getRawDiff(changeId, filePath),
      renderDiffWithShiki: (diff) => renderDiffWithShiki(diff, THEME),
      requestRender: () => tui.requestRender(),
    });
  }

  private createOperations(
    pi: ExtensionAPI,
    cwd: string,
    notify: (msg: string, type?: string) => void,
    tui: { requestRender: () => void },
  ) {
    return createOperations({
      pi,
      cwd,
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
        return this.dataLoading.loadFilesAndDiff(change);
      },
      ...this.serviceCallbacks,
      getRawDiff: (changeId, filePath) =>
        this.service.getRawDiff(changeId, filePath),
      renderDiffWithShiki: (diff) => renderDiffWithShiki(diff, THEME),
      loadChanges: (revision) => this.service.loadChanges(revision),
    });
  }

  private initKeyboardHandlers(): void {
    const { moveBindings, leftBindings, rightBindings, globalBindings } =
      buildKeyboardBindings(this.state, this.navigation, {
        cycleFilter: (direction) => this.cycleFilter(direction),
        handleNew: () => void this.operations.newChange(),
        handleEdit: () => void this.operations.editChange(),
        handleRevert: () => void this.operations.revertChange(),
        handleDescribe: () => void this.operations.describeChanges(),
        handleSplit: () => void this.operations.splitChange(),
        handleInspectChange: () => void this.operations.inspectChange(),
        handleSquash: () => void this.operations.squashChange(),
        handleDrop: () => void this.operations.dropChange(),
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
        requestRender: () => this.tui.requestRender(),
      });

    this.leftHandler = createKeyboardHandler({
      bindings: [...globalBindings, ...leftBindings] as KeyBinding[],
    });
    this.rightHandler = createKeyboardHandler({
      bindings: [...globalBindings, ...rightBindings] as KeyBinding[],
    });
    this.moveHandler = createKeyboardHandler({ bindings: moveBindings });
  }

  private async refreshAfterMutation(): Promise<void> {
    await this.dataLoading.refreshAfterMutation();
  }

  private async restoreSelectionAndDiff(prevIndex: number): Promise<void> {
    await this.dataLoading.restoreSelectionAndDiff(prevIndex);
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
