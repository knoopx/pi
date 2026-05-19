import type { Component } from "@earendil-works/pi-tui";
import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  buildHelpFromBindings,
  filterActiveBindings,
  createKeyboardHandler,
  type KeyBinding,
} from "../../lib/keyboard/handler";
import { calculateDiffScroll } from "../../lib/split-panel/layout";
import { formatErrorMessage } from "../../lib/ui/footer";
import { WorkspaceView } from "./view";
import {
  createWorkspaceState,
  createCacheStore,
  loadWorkspacesList,
  loadDefaultWorkspace,
  loadWorkspaceFiles,
  type WorkspaceState,
  type WorkspaceCacheStore,
} from "./loading";
import {
  getGlobalBindings,
  getWorkspaceActionBindings,
  getLeftPaneBindings,
  getRightPaneBindings,
} from "./bindings";
import { calculateNavigationTarget } from "./navigation";
import {
  loadDiffForCurrentSelection,
  type DiffLoadingContext,
} from "./diff-loading";
import {
  executeAction,
  createNewWorkspace,
  deleteWorkspace,
  discardFile,
  type WorkspaceActionsContext,
} from "./actions";

export interface WorkspacesComponentOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result?: void) => void;
  ctx: ExtensionContext;
}

export interface WorkspacesComponentAPI {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
  loadWorkspaces(): Promise<void>;
  dispose(): void;
}

export function createWorkspacesComponent(
  options: WorkspacesComponentOptions,
): WorkspacesComponentAPI {
  return new WorkspaceComponent(options);
}

class WorkspaceComponent implements Component, WorkspacesComponentAPI {
  private pi: ExtensionAPI;
  private tui: { terminal: { rows: number }; requestRender: () => void };
  private theme: Theme;
  private done: (result?: void) => void;
  private ctx: ExtensionContext;
  private state: WorkspaceState;
  private cacheStore: WorkspaceCacheStore;
  private selectedIndex = 0;
  private focus: "left" | "right" = "left";
  private terminalWidth = 0;

  private leftHandler: (data: string) => void;
  private rightHandler: (data: string) => void;

  private leftPaneBindings: KeyBinding[] = [];
  private rightPaneBindings: KeyBinding[] = [];
  private globalBindings: KeyBinding[] = [];
  private actionBindings: KeyBinding[] = [];

  constructor(options: WorkspacesComponentOptions) {
    const { pi, tui, theme, keybindings: _keybindings, done, ctx } = options;
    this.pi = pi;
    this.tui = tui;
    this.theme = theme;
    this.done = done;
    this.ctx = ctx;
    this.state = createWorkspaceState();
    this.cacheStore = createCacheStore();

    const globalBindings = this.getGlobalBindings();
    const actionBindings = this.getWorkspaceActionBindings();
    const leftBindings = getLeftPaneBindings(this.getBindingsContext());
    const rightBindings = getRightPaneBindings(this.getBindingsContext());

    this.globalBindings = globalBindings;
    this.actionBindings = actionBindings;
    this.leftPaneBindings = leftBindings;
    this.rightPaneBindings = rightBindings;

    this.leftHandler = createKeyboardHandler({
      bindings: [
        ...globalBindings,
        ...actionBindings,
        ...leftBindings,
      ] as KeyBinding[],
    });
    this.rightHandler = createKeyboardHandler({
      bindings: [
        ...globalBindings,
        ...actionBindings,
        ...rightBindings,
      ] as KeyBinding[],
    });

    void this.loadWorkspaces();
  }

  private getBindingsContext() {
    return {
      focus: this.focus,
      hasWorkspace: () => this.hasWorkspace(),
      isDefaultWs: () => this.isDefaultWs(),
      isRunningWs: () => this.isRunningWs(),
      hasFile: () => this.hasFile(),
      selectedWorkspaceFileStats:
        this.state.selectedWorkspace?.fileStats ?? undefined,
      terminalRows: this.tui.terminal.rows,
      terminalWidth: this.terminalWidth,
      diffScroll: this.state.diffScroll,
      diffContentLength: this.state.diffContent.length,
      onTab: () => {
        this.focus = this.focus === "left" ? "right" : "left";
        this.invalidate();
      },
      onDone: () => this.done(),
      onNew: () => void this.createNewWorkspace(),
      onAttach: () => void this.executeAction("attach"),
      onRebase: () => void this.executeAction("rebase"),
      onEdit: () => void this.executeAction("edit"),
      onTerminal: () => void this.executeAction("terminal"),
      onDeleteWorkspace: () => void this.deleteWorkspace(),
      onNavigateWorkspace: (direction: "up" | "down" | "pageUp" | "pageDown") =>
        this.navigateWorkspace(direction),
      onNavigateFile: (direction: "up" | "down" | "pageUp" | "pageDown") =>
        void this.navigateFile(direction),
      onDiscardFile: () => void this.discardFile(),
      onScrollDiff: (direction: "up" | "down") => this.scrollDiff(direction),
    };
  }

  invalidate(): void {
    this.tui.requestRender();
  }

  async loadWorkspaces(): Promise<void> {
    try {
      this.state.workspaces = await loadWorkspacesList(this.pi);
      this.state.loading = false;
      if (this.state.workspaces.length > 0) {
        this.state.selectedWorkspace = this.state.workspaces[0];
        await this.loadFilesAndDiff(this.state.selectedWorkspace);
      } else {
        this.state.diffContent = ["No workspaces found"];
      }
      this.invalidate();
    } catch (error) {
      this.state.loading = false;
      const msg = formatErrorMessage(error);
      this.state.diffContent = [`Error: ${msg}`];
      this.invalidate();
    }
  }

  private async loadFilesAndDiff(
    ws: import("../../types").AgentWorkspace,
  ): Promise<void> {
    const isDefault = ws.name === "default";
    try {
      if (isDefault) {
        await loadDefaultWorkspace(this.pi, ws, this.state, this.cacheStore);
      } else {
        await loadWorkspaceFiles(this.pi, ws, this.state, this.cacheStore);
      }
    } catch (error) {
      const msg = formatErrorMessage(error);
      this.state.files = [];
      this.state.changes = [];
      this.state.diffContent = [`Error loading: ${msg}`];
      this.invalidate();
    }
  }

  private getActionsContext(): WorkspaceActionsContext {
    return {
      pi: this.pi,
      ctx: this.ctx,
      state: this.state,
      cacheStore: this.cacheStore,
      onDone: () => this.done(),
      onSendTask: (task: string) => this.pi.sendUserMessage(task),
      refresh: () => this.loadWorkspaces(),
      loadFilesAndDiff: (ws) => this.loadFilesAndDiff(ws),
      invalidate: () => this.invalidate(),
    };
  }

  private getDiffLoadingContext(): DiffLoadingContext {
    return {
      pi: this.pi,
      state: this.state,
      cacheStore: this.cacheStore,
      setDiffContent: (content) => {
        this.state.diffContent = content;
        this.invalidate();
      },
      invalidate: () => this.invalidate(),
    };
  }

  private async executeAction(action: string): Promise<void> {
    await executeAction(this.getActionsContext(), action);
  }

  private async createNewWorkspace(): Promise<void> {
    await createNewWorkspace(this.getActionsContext());
  }

  private async deleteWorkspace(): Promise<void> {
    await deleteWorkspace(
      this.getActionsContext(),
      this.isDefaultWs(),
      this.isRunningWs(),
    );
  }

  private async discardFile(): Promise<void> {
    await discardFile(this.getActionsContext(), this.canDiscardFile());
  }

  private isLeftFocus(): boolean {
    return this.focus === "left";
  }

  private hasWorkspace(): boolean {
    return this.state.selectedWorkspace !== null;
  }

  private isDefaultWs(): boolean {
    return this.state.selectedWorkspace?.name === "default";
  }

  private isRunningWs(): boolean {
    return this.state.selectedWorkspace?.status === "running";
  }

  private hasFile(): boolean {
    return this.state.files[this.state.fileIndex] !== undefined;
  }

  private canDiscardFile(): boolean {
    return !!(
      this.state.selectedWorkspace &&
      !this.isDefaultWs() &&
      this.hasFile()
    );
  }

  private navigateWorkspace(
    direction: "up" | "down" | "pageUp" | "pageDown",
  ): void {
    const pageOffset = Math.max(1, this.availableListHeight - 1);
    const maxIndex = this.state.workspaces.length - 1;
    const newIndex = calculateNavigationTarget(
      this.selectedIndex,
      maxIndex,
      direction,
      pageOffset,
    );
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.state.selectedWorkspace = this.state.workspaces[this.selectedIndex];
      this.state.fileIndex = 0;
      this.state.diffScroll = 0;
      this.state.diffContent = ["Loading..."];
      void this.loadFilesAndDiff(this.state.selectedWorkspace);
      this.invalidate();
    }
  }

  private get availableListHeight(): number {
    return Math.max(1, this.tui.terminal.rows - 6);
  }

  private async navigateFile(
    direction: "up" | "down" | "pageUp" | "pageDown",
  ): Promise<void> {
    if (!this.state.selectedWorkspace) return;
    const isDefault = this.isDefaultWs();
    const maxIndex = isDefault
      ? this.state.changes.length - 1
      : this.state.files.length - 1;
    const pageOffset = Math.max(1, this.availableListHeight - 1);
    const newIndex = calculateNavigationTarget(
      this.state.fileIndex,
      maxIndex,
      direction,
      pageOffset,
    );
    if (newIndex !== this.state.fileIndex) {
      this.state.fileIndex = newIndex;
      this.state.diffScroll = 0;
      this.state.diffContent = ["Loading..."];
      this.invalidate();
      await loadDiffForCurrentSelection(this.getDiffLoadingContext());
    }
  }

  private scrollDiff(direction: "up" | "down"): void {
    this.state.diffScroll = calculateDiffScroll({
      direction,
      currentScroll: this.state.diffScroll,
      contentLength: this.state.diffContent.length,
      terminalRows: this.tui.terminal.rows,
      cachedWidth: this.terminalWidth,
    });
    this.invalidate();
  }

  private getGlobalBindings(): KeyBinding[] {
    return getGlobalBindings(this.getBindingsContext());
  }

  private getWorkspaceActionBindings(): KeyBinding[] {
    return getWorkspaceActionBindings(this.getBindingsContext());
  }

  private buildHelpText(): string {
    const bindings =
      this.focus === "left"
        ? [
            ...this.globalBindings,
            ...this.actionBindings,
            ...this.leftPaneBindings,
          ]
        : [
            ...this.globalBindings,
            ...this.actionBindings,
            ...this.rightPaneBindings,
          ];
    const activeBindings = filterActiveBindings(bindings);
    return buildHelpFromBindings(activeBindings);
  }

  render(width: number): string[] {
    this.terminalWidth = width;
    const helpText = this.buildHelpText();
    const view = new WorkspaceView(
      {
        workspaces: this.state.workspaces,
        selectedWorkspace: this.state.selectedWorkspace,
        files: this.state.files,
        changes: this.state.changes,
        fileIndex: this.state.fileIndex,
        diffContent: this.state.diffContent,
        diffScroll: this.state.diffScroll,
        focus: this.focus,
        selectedIndex: this.selectedIndex,
        loading: this.state.loading,
        helpText,
      },
      this.tui,
      this.theme,
    );
    return view.render(width);
  }

  handleInput(data: string): void {
    if (this.isLeftFocus()) this.leftHandler(data);
    else this.rightHandler(data);
  }

  dispose(): void {}
}
