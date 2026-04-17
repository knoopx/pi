import type { Component } from "@mariozechner/pi-tui";
import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  ACTION_KEYS,
  createKeyboardHandler,
  buildHelpFromBindings,
  filterActiveBindings,
  type KeyBinding,
} from "../../keyboard";
import { calculateDiffScroll } from "../split-panel";
import { formatErrorMessage } from "../formatting-utils";
import { WorkspaceView } from "./workspace-view";
import {
  createWorkspaceState,
  createCacheStore,
  loadWorkspacesList,
  loadDefaultWorkspace,
  loadWorkspaceFiles,
  type WorkspaceState,
  type WorkspaceCacheStore,
} from "./data-loading";
import { notifyMutation } from "../../jj";
import {
  forgetWorkspace,
  killTmuxSession,
  createWorkspace,
  generateWorkspaceName,
} from "../../workspace";

export function createWorkspacesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result?: void) => void,
): WorkspacesComponentAPI {
  const component = new WorkspaceComponent(pi, tui, theme, _keybindings, done);
  return component as unknown as WorkspacesComponentAPI;
}

interface WorkspacesComponentAPI {
  render(width: number): string[];
  handleInput(data: string): void;
  invalidate(): void;
  loadWorkspaces(): Promise<void>;
  dispose(): void;
}

class WorkspaceComponent implements Component {
  private state: WorkspaceState;
  private cacheStore: WorkspaceCacheStore;
  private selectedIndex = 0;
  private focus: "left" | "right" = "left";
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private availableListHeight = 0;

  private leftHandler: (data: string) => void;
  private rightHandler: (data: string) => void;

  constructor(
    private pi: ExtensionAPI,
    private tui: { terminal: { rows: number }; requestRender: () => void },
    private theme: Theme,
    _keybindings: KeybindingsManager,
    private done: (result?: void) => void,
  ) {
    this.state = createWorkspaceState();
    this.cacheStore = createCacheStore();

    const globalBindings = this.getGlobalBindings();
    const workspaceActionBindings = this.getWorkspaceActionBindings();
    const leftPaneBindings = this.getLeftPaneBindings();
    const rightPaneBindings = this.getRightPaneBindings();

    this.leftHandler = createKeyboardHandler({
      bindings: [
        ...globalBindings,
        ...workspaceActionBindings,
        ...leftPaneBindings,
      ] as KeyBinding[],
    });
    this.rightHandler = createKeyboardHandler({
      bindings: [
        ...globalBindings,
        ...workspaceActionBindings,
        ...rightPaneBindings,
      ] as KeyBinding[],
    });

    void this.loadWorkspaces();
  }

  invalidate(): void {
    this.cachedLines = [];
    this.cachedWidth = 0;
    this.tui.requestRender();
  }

  private async loadWorkspaces(): Promise<void> {
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

  private async executeAction(action: string): Promise<void> {
    if (!this.state.selectedWorkspace) return;
    try {
      await this.handleWorkspaceAction(action, this.state.selectedWorkspace);
    } catch (error) {
      const msg = formatErrorMessage(error);
      this.state.diffContent = [`Error: ${msg}`];
    }
    this.invalidate();
  }

  private async handleWorkspaceAction(
    action: string,
    ws: import("../../types").AgentWorkspace,
  ): Promise<void> {
    switch (action) {
      case "attach":
        await this.handleAttach(ws);
        break;
      case "rebase":
        this.handleRebase(ws);
        break;
      case "edit":
        await this.pi.exec("editor", [ws.path]);
        break;
      case "terminal":
        await this.pi.exec("terminal", [ws.path]);
        break;
      case "kill":
        await this.handleKill(ws);
        break;
      case "forget":
        await this.handleForget(ws);
        break;
    }
  }

  private async handleAttach(
    ws: import("../../types").AgentWorkspace,
  ): Promise<void> {
    this.done();
    if (process.env.TMUX) {
      await this.pi.exec("tmux", ["switch-client", "-t", ws.name]);
      return;
    }
    const terminalResult = await this.pi.exec("wezterm", [
      "start",
      "--",
      "tmux",
      "attach",
      "-t",
      ws.name,
    ]);
    if (terminalResult.code !== 0) {
      await this.pi.exec("tmux", ["attach", "-t", ws.name]);
    }
  }

  private handleRebase(ws: import("../../types").AgentWorkspace): void {
    this.done();
    const task = `Integrate changes from workspace "${ws.name}":
1. List changed files: \`jj diff --summary -r ${ws.name}@\`
2. Review specific files if needed: \`jj diff -r ${ws.name}@ <file>\`
3. Rebase onto current: \`jj rebase -s ${ws.name}@ -d @\`
4. Squash into parent: \`jj squash -r ${ws.name}@\`
5. Set description: \`jj desc -m "type(scope): description"\`
Types: feat, fix, docs, style, refactor, perf, test, chore`;
    this.pi.sendUserMessage(task);
  }

  private async handleKill(
    ws: import("../../types").AgentWorkspace,
  ): Promise<void> {
    await killTmuxSession(this.pi, ws.name);
    this.cacheStore.delete(ws.name);
    await this.loadWorkspaces();
  }

  private async handleForget(
    ws: import("../../types").AgentWorkspace,
  ): Promise<void> {
    await forgetWorkspace(this.pi, ws.name);
    this.cacheStore.delete(ws.name);
    await this.loadWorkspaces();
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

  private async createNewWorkspace(): Promise<void> {
    try {
      const { getRepoRoot, getCurrentChangeId } =
        await import("../../workspace");
      const repoRootPath = await getRepoRoot(this.pi);
      const parentChangeId = await getCurrentChangeId(this.pi, repoRootPath);
      const workspaceName = generateWorkspaceName();
      const workspacePath = await createWorkspace(
        this.pi,
        workspaceName,
        "New workspace",
        parentChangeId,
      );
      await this.pi.exec("wezterm", [
        "start",
        "--cwd",
        workspacePath,
        "--",
        "pi",
      ]);
      this.cacheStore.delete(workspaceName);
      await this.loadWorkspaces();
    } catch (error) {
      this.pi.sendUserMessage(`Error: Failed to create workspace: ${error}`);
    }
  }

  private async deleteWorkspace(): Promise<void> {
    if (!this.state.selectedWorkspace || this.isDefaultWs()) return;
    if (this.isRunningWs()) {
      await killTmuxSession(this.pi, this.state.selectedWorkspace.name);
    }
    await this.executeAction("forget");
  }

  private async discardFile(): Promise<void> {
    if (!this.state.selectedWorkspace || this.isDefaultWs() || !this.hasFile())
      return;
    const file = this.state.files[this.state.fileIndex];
    const restoreResult = await this.pi.exec("jj", ["restore", file.path], {
      cwd: this.state.selectedWorkspace.path,
    });
    this.cacheStore.delete(this.state.selectedWorkspace.name);
    await this.loadFilesAndDiff(this.state.selectedWorkspace);
    const msg = `Restored file ${file.path} in workspace ${this.state.selectedWorkspace.name}`;
    notifyMutation(this.pi, msg, restoreResult.stderr || restoreResult.stdout);
  }

  private navigateWorkspace(
    direction: "up" | "down" | "pageUp" | "pageDown",
  ): void {
    const pageOffset = Math.max(1, this.availableListHeight - 1);
    const newIndex =
      direction === "up"
        ? Math.max(0, this.selectedIndex - 1)
        : direction === "pageUp"
          ? Math.max(0, this.selectedIndex - pageOffset)
          : direction === "pageDown"
            ? Math.min(
                this.state.workspaces.length - 1,
                this.selectedIndex + pageOffset,
              )
            : Math.min(
                this.state.workspaces.length - 1,
                this.selectedIndex + 1,
              );
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.state.selectedWorkspace = this.state.workspaces[this.selectedIndex];
      void this.loadFilesAndDiff(this.state.selectedWorkspace);
      this.invalidate();
    }
  }

  private navigateFile(direction: "up" | "down" | "pageUp" | "pageDown"): void {
    if (!this.state.selectedWorkspace) return;
    const isDefault = this.isDefaultWs();
    const maxIndex = isDefault
      ? this.state.changes.length - 1
      : this.state.files.length - 1;
    const pageOffset = Math.max(1, this.availableListHeight - 1);
    const newIndex =
      direction === "up"
        ? Math.max(0, this.state.fileIndex - 1)
        : direction === "pageUp"
          ? Math.max(0, this.state.fileIndex - pageOffset)
          : direction === "pageDown"
            ? Math.min(maxIndex, this.state.fileIndex + pageOffset)
            : Math.min(maxIndex, this.state.fileIndex + 1);
    if (newIndex !== this.state.fileIndex) {
      this.state.fileIndex = newIndex;
      this.invalidate();
    }
  }

  private getGlobalBindings(): KeyBinding[] {
    return [
      {
        key: "tab",
        label: "nav",
        handler: () => {
          this.focus = this.focus === "left" ? "right" : "left";
          this.invalidate();
        },
      },
      { key: "escape", handler: () => this.done() },
      { key: "q", handler: () => this.done() },
      {
        key: "n",
        label: "new",
        handler: () => {
          void this.createNewWorkspace();
        },
      },
    ];
  }

  private getWorkspaceActionBindings(): KeyBinding[] {
    return [
      {
        key: "a",
        label: "attach",
        when: () =>
          this.hasWorkspace() && !this.isDefaultWs() && this.isRunningWs(),
        handler: () => {
          void this.executeAction("attach");
        },
      },
      {
        key: "r",
        label: "rebase",
        when: () =>
          this.hasWorkspace() &&
          !this.isDefaultWs() &&
          this.state.selectedWorkspace?.fileStats !== undefined,
        handler: () => {
          void this.executeAction("rebase");
        },
      },
      {
        key: "e",
        label: "edit",
        when: () => this.hasWorkspace(),
        handler: () => {
          void this.executeAction("edit");
        },
      },
      {
        key: "t",
        label: "term",
        when: () => this.hasWorkspace(),
        handler: () => {
          void this.executeAction("terminal");
        },
      },
      {
        key: ACTION_KEYS.delete,
        label: "delete",
        when: () => this.hasWorkspace() && !this.isDefaultWs(),
        handler: () => {
          void this.deleteWorkspace();
        },
      },
    ];
  }

  private getLeftPaneBindings(): KeyBinding[] {
    return [
      { key: "up", handler: () => this.navigateWorkspace("up") },
      { key: "down", handler: () => this.navigateWorkspace("down") },
      { key: "pageUp", handler: () => this.navigateWorkspace("pageUp") },
      { key: "pageDown", handler: () => this.navigateWorkspace("pageDown") },
    ];
  }

  private getRightPaneBindings(): KeyBinding[] {
    return [
      { key: "up", handler: () => this.navigateFile("up") },
      { key: "down", handler: () => this.navigateFile("down") },
      { key: "pageUp", handler: () => this.navigateFile("pageUp") },
      { key: "pageDown", handler: () => this.navigateFile("pageDown") },
      {
        key: "d",
        label: "discard",
        when: () =>
          this.hasWorkspace() && !this.isDefaultWs() && this.hasFile(),
        handler: () => {
          void this.discardFile();
        },
      },
      {
        key: "shift+pageUp",
        label: "scroll",
        handler: () => {
          this.state.diffScroll = calculateDiffScroll(
            "up",
            this.state.diffScroll,
            this.state.diffContent.length,
            this.tui.terminal.rows,
            this.cachedWidth,
          );
          this.invalidate();
        },
      },
      {
        key: "shift+pageDown",
        handler: () => {
          this.state.diffScroll = calculateDiffScroll(
            "down",
            this.state.diffScroll,
            this.state.diffContent.length,
            this.tui.terminal.rows,
            this.cachedWidth,
          );
          this.invalidate();
        },
      },
    ];
  }

  render(width: number): string[] {
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
      },
      this.tui,
      this.theme,
    );
    const result = view.render(width);
    this.cachedLines = result;
    this.cachedWidth = width;
    return result;
  }

  handleInput(data: string): void {
    if (this.isLeftFocus()) this.leftHandler(data);
    else this.rightHandler(data);
  }

  dispose(): void {}
}
