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
} from "../keyboard";
import { pad, renderListRow } from "./text-utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderDiffRows,
  renderFileChangeRows,
  renderChangeRows,
  calculateDiffScroll,
} from "./split-panel";
import { formatErrorMessage } from "./formatting-utils";
import { isRenderCacheValid } from "./state/factories";
import type {
  AgentWorkspace,
  WorkspaceStatus,
  FileChange,
  Change,
} from "../types";
import { formatFileStats } from "../types";
import {
  getRepoRoot,
  getCurrentChangeId,
  loadAgentWorkspaces,
  forgetWorkspace,
  killTmuxSession,
  createWorkspace,
  generateWorkspaceName,
} from "../workspace";
import {
  loadChanges,
  loadChangedFiles,
  notifyMutation,
  getRawDiff,
} from "../jj";
import { getTheme, renderDiffWithShiki } from "../tools/diff";
const STATUS_TEXT: Record<WorkspaceStatus, string> = {
  running: "running",
  completed: "done",
  failed: "failed",
  idle: "",
};
interface WorkspaceCache {
  files: FileChange[];
  changes: Change[];
  diffs: Map<string, string[]>;
}
export function createWorkspacesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result?: void) => void,
) {
  let workspaces: AgentWorkspace[] = [];
  let selectedIndex = 0;
  let selectedWorkspace: AgentWorkspace | null = null;
  let files: FileChange[] = [];
  let changes: Change[] = [];
  let fileIndex = 0;
  let diffContent: string[] = [];
  let diffScroll = 0;
  let focus: "workspaces" | "files" = "workspaces";
  let loading = true;
  let cachedLines: string[] = [];
  let cachedWidth = 0;
  let availableListHeight = 0;
  const workspaceCache = new Map<string, WorkspaceCache>();
  async function loadWorkspaces(): Promise<void> {
    try {
      const repoRoot = await getRepoRoot(pi);
      const rootChangeId = await getCurrentChangeId(pi, repoRoot);
      const rootWorkspace: AgentWorkspace = {
        name: "default",
        path: repoRoot,
        description: "(root workspace)",
        status: "idle",
        changeId: rootChangeId,
        parentChangeId: "",
        createdAt: 0,
        fileStats: undefined,
      };
      const keenWorkspaces = await loadAgentWorkspaces(pi);
      workspaces = [rootWorkspace, ...keenWorkspaces];
      loading = false;
      if (workspaces.length > 0) {
        selectedWorkspace = workspaces[0];
        await loadFilesAndDiff(selectedWorkspace);
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
  async function loadFilesAndDiff(ws: AgentWorkspace): Promise<void> {
    const isDefault = ws.name === "default";
    try {
      const cache = workspaceCache.get(ws.name);
      if (isDefault) await loadDefaultWorkspace(ws, cache);
      else {
        await loadWorkspaceFiles(ws, cache);
      }
    } catch (error) {
      const msg = formatErrorMessage(error);
      files = [];
      changes = [];
      diffContent = [`Error loading: ${msg}`];
      invalidate();
      tui.requestRender();
    }
  }
  async function loadDefaultWorkspace(
    ws: AgentWorkspace,
    cache: WorkspaceCache | undefined,
  ): Promise<void> {
    if (cache) {
      changes = cache.changes;
      files = [];
      fileIndex = 0;
      const diffKey = changes[0]?.changeId ?? "";
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
      changes = await loadChanges(pi, ws.path);
      files = [];
      cache = { files: [], changes, diffs: new Map() };
      workspaceCache.set(ws.name, cache);
    }
    fileIndex = 0;
    await loadChangeDiff(ws, changes[0]?.changeId);
  }
  async function loadWorkspaceFiles(
    ws: AgentWorkspace,
    cache: WorkspaceCache | undefined,
  ): Promise<void> {
    if (cache) {
      files = cache.files;
      changes = [];
      fileIndex = 0;
      const diffKey = files[0]?.path ?? "";
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
      files = await loadChangedFiles(pi, ws.path, ws.changeId);
      changes = [];
      cache = { files, changes: [], diffs: new Map() };
      workspaceCache.set(ws.name, cache);
    }
    fileIndex = 0;
    await loadDiff(ws, files[0]?.path);
  }
  async function loadChangeDiff(
    ws: AgentWorkspace,
    changeId?: string,
  ): Promise<void> {
    if (!changeId) {
      setDiffContent(["No changes"]);
      return;
    }
    const cache = workspaceCache.get(ws.name);
    const cachedDiff = cache?.diffs.get(changeId);
    if (cachedDiff) {
      setDiffContent(cachedDiff);
      return;
    }
    try {
      const { diff } = await getRawDiff(pi, ws.path, changeId);
      const theme = await getTheme(pi, ws.path);
      const content = await renderDiffWithShiki(diff, theme);
      cache?.diffs.set(changeId, content);
      setDiffContent(content);
    } catch (error) {
      setDiffContent([`Error: ${formatErrorMessage(error)}`]);
    }
  }
  async function loadDiff(
    ws: AgentWorkspace,
    filePath?: string,
  ): Promise<void> {
    const diffKey = filePath ?? "";
    const cache = workspaceCache.get(ws.name);
    const cachedDiff = cache?.diffs.get(diffKey);
    if (cachedDiff) {
      setDiffContent(cachedDiff);
      return;
    }
    try {
      const { diff } = await getRawDiff(pi, ws.path, "@", filePath);
      const theme = await getTheme(pi, ws.path);
      const content = await renderDiffWithShiki(diff, theme);
      cache?.diffs.set(diffKey, content);
      setDiffContent(content);
    } catch (error) {
      setDiffContent([`Error: ${formatErrorMessage(error)}`]);
    }
  }
  async function executeAction(action: string): Promise<void> {
    if (!selectedWorkspace) return;
    const ws = selectedWorkspace;
    try {
      switch (action) {
        case "attach": {
          done();
          if (process.env.TMUX) {
            await pi.exec("tmux", ["switch-client", "-t", ws.name]);
            break;
          }
          const terminalResult = await pi.exec("wezterm", [
            "start",
            "--",
            "tmux",
            "attach",
            "-t",
            ws.name,
          ]);
          if (terminalResult.code !== 0)
            await pi.exec("tmux", ["attach", "-t", ws.name]);
          break;
        }
        case "rebase": {
          done();
          const task = `Integrate changes from workspace "${ws.name}":
1. List changed files: \`jj diff --summary -r ${ws.name}@\`
2. Review specific files if needed: \`jj diff -r ${ws.name}@ <file>\`
3. Rebase onto current: \`jj rebase -s ${ws.name}@ -d @\`
4. Squash into parent: \`jj squash -r ${ws.name}@\`
5. Set description: \`jj desc -m "type(scope): description"\`
Types: feat, fix, docs, style, refactor, perf, test, chore`;
          pi.sendUserMessage(task);
          return;
        }
        case "edit":
          await pi.exec("editor", [ws.path]);
          break;
        case "terminal":
          await pi.exec("terminal", [ws.path]);
          break;
        case "kill":
          await killTmuxSession(pi, ws.name);
          workspaceCache.delete(ws.name);
          await loadWorkspaces();
          break;
        case "forget":
          await forgetWorkspace(pi, ws.name);
          workspaceCache.delete(ws.name);
          await loadWorkspaces();
          break;
      }
    } catch (error) {
      const msg = formatErrorMessage(error);
      diffContent = [`Error: ${msg}`];
    }
    invalidate();
    tui.requestRender();
  }
  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }
  function setDiffContent(content: string[], resetScroll = true): void {
    diffContent = content;
    if (resetScroll) diffScroll = 0;
    invalidate();
    tui.requestRender();
  }
  function getLeftRows(width: number, height: number): string[] {
    const rows: string[] = [];
    if (loading) {
      rows.push(pad(" Loading...", width));
      return rows;
    }
    if (workspaces.length === 0) {
      rows.push(pad(" No workspaces", width));
      rows.push(theme.fg("dim", pad(" Use /workspace <task>", width)));
      return rows;
    }
    for (let i = 0; i < workspaces.length && i < height; i++) {
      const ws = workspaces[i];
      const isSelected = i === selectedIndex && focus === "workspaces";
      const stats = formatFileStats(ws);
      const status =
        ws.name !== "default" && STATUS_TEXT[ws.status]
          ? ` (${STATUS_TEXT[ws.status]})`
          : "";
      const text = ` ${ws.name} ${stats}${status}`;
      rows.push(renderListRow(text, width, isSelected, false, theme));
    }
    return rows;
  }
  function getFileRows(width: number, height: number): string[] {
    const isDefault = selectedWorkspace?.name === "default";
    if (isDefault) {
      const changesForRender = changes.map((c) => ({
        changeId: c.changeId,
        description: c.description,
        empty: c.empty,
      }));
      return renderChangeRows(
        changesForRender,
        width,
        height,
        fileIndex,
        focus === "files",
        theme,
        " No changes",
      );
    }
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
    if (isRenderCacheValid(width, cachedWidth, cachedLines)) return cachedLines;
    const dims = calculateDimensions(tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: focus === "workspaces",
      rightFocus: focus === "files",
      leftRatio: 0.28,
      rightSplit: true,
      rightTopRatio: 0.3,
    });

    // Capture available list height for page scrolling
    availableListHeight =
      focus === "workspaces"
        ? dims.contentH
        : (dims.rightTopH ?? dims.contentH);

    const leftTitle = " Workspaces";
    const isDefault = selectedWorkspace?.name === "default";
    const rightTopTitle = isDefault ? " Changes" : " Files";
    let rightBottomTitle: string;
    if (!selectedWorkspace) {
      rightBottomTitle = " Diff";
    } else if (isDefault) {
      rightBottomTitle = ` Diff: ${changes[fileIndex]?.changeId?.slice(0, 8) ?? "none"}`;
    } else {
      rightBottomTitle = ` Diff: ${files[fileIndex]?.path ?? "all"}`;
    }
    const leftRows = getLeftRows(dims.leftW, dims.contentH);
    const fileRows = getFileRows(dims.rightW, dims.rightTopH ?? 5);
    const diffRows = renderDiffRows(
      diffContent,
      dims.rightW,
      dims.rightBottomH ?? 10,
      diffScroll,
      theme,
    );
    const helpText = getHelpText();
    cachedLines = renderSplitPanel(
      theme,
      {
        leftTitle,
        rightTitle: rightTopTitle,
        rightTopTitle,
        rightBottomTitle,
        helpText,
        leftFocus: focus === "workspaces",
        rightFocus: focus === "files",
        rightSplit: true,
      },
      dims,
      {
        left: leftRows,
        rightTop: fileRows,
        rightBottom: diffRows,
      },
    );
    cachedWidth = width;
    return cachedLines;
  }
  const isLeftFocus = () => focus === "workspaces";
  const hasWorkspace = () => selectedWorkspace !== null;
  const isDefaultWs = () => selectedWorkspace?.name === "default";
  const isRunningWs = () => selectedWorkspace?.status === "running";
  const hasFile = () => files[fileIndex] !== undefined;
  const createNewWorkspace = async () => {
    try {
      const repoRoot = await getRepoRoot(pi);
      const parentChangeId = await getCurrentChangeId(pi, repoRoot);
      const workspaceName = generateWorkspaceName();
      const workspacePath = await createWorkspace(
        pi,
        workspaceName,
        "New workspace",
        parentChangeId,
      );
      await pi.exec("wezterm", ["start", "--cwd", workspacePath, "--", "pi"]);
      workspaceCache.delete(workspaceName);
      await loadWorkspaces();
    } catch (error) {
      pi.sendUserMessage(`Error: Failed to create workspace: ${error}`); // void`Failed to create workspace: ${error}`);
    }
  };
  const deleteWorkspace = async () => {
    if (!selectedWorkspace || isDefaultWs()) return;
    if (isRunningWs()) await killTmuxSession(pi, selectedWorkspace.name);
    await executeAction("forget");
  };
  const discardFile = async () => {
    if (!selectedWorkspace || isDefaultWs() || !files[fileIndex]) return;
    const file = files[fileIndex];
    const restoreResult = await pi.exec("jj", ["restore", file.path], {
      cwd: selectedWorkspace.path,
    });
    workspaceCache.delete(selectedWorkspace.name);
    await loadFilesAndDiff(selectedWorkspace);
    const msg = `Restored file ${file.path} in workspace ${selectedWorkspace.name}`;
    notifyMutation(pi, msg, restoreResult.stderr || restoreResult.stdout);
  };
  // Navigate workspaces
  const navigateWorkspace = (
    direction: "up" | "down" | "pageUp" | "pageDown",
  ) => {
    const pageOffset = Math.max(1, availableListHeight - 1);
    const newIndex =
      direction === "up"
        ? Math.max(0, selectedIndex - 1)
        : direction === "pageUp"
          ? Math.max(0, selectedIndex - pageOffset)
          : direction === "pageDown"
            ? Math.min(workspaces.length - 1, selectedIndex + pageOffset)
            : Math.min(workspaces.length - 1, selectedIndex + 1);
    if (newIndex !== selectedIndex) {
      selectedIndex = newIndex;
      selectedWorkspace = workspaces[selectedIndex];
      void loadFilesAndDiff(selectedWorkspace);
      invalidate();
      tui.requestRender();
    }
  };

  // Navigate files
  const navigateFile = (direction: "up" | "down" | "pageUp" | "pageDown") => {
    if (!selectedWorkspace) return;
    const isDefault = isDefaultWs();
    const maxIndex = isDefault ? changes.length - 1 : files.length - 1;
    const pageOffset = Math.max(1, availableListHeight - 1);
    const newIndex =
      direction === "up"
        ? Math.max(0, fileIndex - 1)
        : direction === "pageUp"
          ? Math.max(0, fileIndex - pageOffset)
          : direction === "pageDown"
            ? Math.min(maxIndex, fileIndex + pageOffset)
            : Math.min(maxIndex, fileIndex + 1);
    if (newIndex !== fileIndex) {
      fileIndex = newIndex;
      if (isDefault)
        void loadChangeDiff(selectedWorkspace, changes[fileIndex]?.changeId);
      else {
        void loadDiff(selectedWorkspace, files[fileIndex]?.path);
      }
      invalidate();
      tui.requestRender();
    }
  };
  const globalBindings: KeyBinding[] = [
    {
      key: "tab",
      label: "nav",
      handler() {
        focus = focus === "workspaces" ? "files" : "workspaces";
        invalidate();
        tui.requestRender();
      },
    },
    {
      key: "escape",
      handler() {
        done();
      },
    },
    {
      key: "q",
      handler() {
        done();
      },
    },
    {
      key: "n",
      label: "new",
      handler() {
        void createNewWorkspace();
      },
    },
  ];
  const workspaceActionBindings: KeyBinding[] = [
    {
      key: "a",
      label: "attach",
      when: () => hasWorkspace() && !isDefaultWs() && isRunningWs(),
      handler() {
        void executeAction("attach");
      },
    },
    {
      key: "r",
      label: "rebase",
      when: () =>
        hasWorkspace() &&
        !isDefaultWs() &&
        selectedWorkspace?.fileStats !== undefined,
      handler() {
        void executeAction("rebase");
      },
    },
    {
      key: "e",
      label: "edit",
      when: hasWorkspace,
      handler() {
        void executeAction("edit");
      },
    },
    {
      key: "t",
      label: "term",
      when: hasWorkspace,
      handler() {
        void executeAction("terminal");
      },
    },
    {
      key: ACTION_KEYS.delete,
      label: "delete",
      when: () => hasWorkspace() && !isDefaultWs(),
      handler() {
        void deleteWorkspace();
      },
    },
  ];
  const leftPaneBindings: KeyBinding[] = [
    {
      key: "up",
      handler() {
        navigateWorkspace("up");
      },
    },
    {
      key: "down",
      handler() {
        navigateWorkspace("down");
      },
    },
    {
      key: "pageUp",
      handler() {
        navigateWorkspace("pageUp");
      },
    },
    {
      key: "pageDown",
      handler() {
        navigateWorkspace("pageDown");
      },
    },
  ];
  const rightPaneBindings: KeyBinding[] = [
    {
      key: "up",
      handler() {
        navigateFile("up");
      },
    },
    {
      key: "down",
      handler() {
        navigateFile("down");
      },
    },
    {
      key: "pageUp",
      handler() {
        navigateFile("pageUp");
      },
    },
    {
      key: "pageDown",
      handler() {
        navigateFile("pageDown");
      },
    },
    {
      key: "d",
      label: "discard",
      when: () => hasWorkspace() && !isDefaultWs() && hasFile(),
      handler() {
        void discardFile();
      },
    },
    {
      key: "shift+pageUp",
      label: "scroll",
      handler() {
        diffScroll = calculateDiffScroll(
          "up",
          diffScroll,
          diffContent.length,
          tui.terminal.rows,
          cachedWidth,
        );
        invalidate();
        tui.requestRender();
      },
    },
    {
      key: "shift+pageDown",
      handler() {
        diffScroll = calculateDiffScroll(
          "down",
          diffScroll,
          diffContent.length,
          tui.terminal.rows,
          cachedWidth,
        );
        invalidate();
        tui.requestRender();
      },
    },
  ];
  function getHelpText(): string {
    const bindings =
      focus === "workspaces"
        ? [...globalBindings, ...workspaceActionBindings, ...leftPaneBindings]
        : [...globalBindings, ...rightPaneBindings];
    const activeBindings = filterActiveBindings(bindings as any, undefined);
    return buildHelpFromBindings(activeBindings as any);
  }
  const leftHandler = createKeyboardHandler({
    bindings: [
      ...(globalBindings as any),
      ...(workspaceActionBindings as any),
      ...(leftPaneBindings as any),
    ],
  });
  const rightHandler = createKeyboardHandler({
    bindings: [
      ...(globalBindings as any),
      ...(workspaceActionBindings as any),
      ...(rightPaneBindings as any),
    ],
  });
  function handleInput(data: string): void {
    if (isLeftFocus()) leftHandler(data);
    else {
      rightHandler(data);
    }
  }
  function dispose(): void {}
  void loadWorkspaces();
  return {
    render,
    handleInput,
    invalidate,
    loadWorkspaces,
    dispose,
  };
}
