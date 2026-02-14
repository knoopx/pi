import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import { pad, ensureWidth, truncateAnsi, buildHelpText } from "./utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderDiffRows,
  renderFileChangeRows,
  renderChangeRows,
  calculateDiffScroll,
  formatErrorMessage,
} from "./split-panel";
import type {
  AgentWorkspace,
  WorkspaceStatus,
  FileChange,
  MutableChange,
} from "../types";
import { formatFileStats } from "../types";
import {
  getRepoRoot,
  getCurrentChangeId,
  loadAgentWorkspaces,
  getWorkspaceDiff,
  forgetWorkspace,
  killTmuxSession,
  loadFiles,
  createWorkspace,
  generateWorkspaceName,
} from "../workspace";
import { loadMutableChanges, getDiff } from "../jj";

const STATUS_TEXT: Record<WorkspaceStatus, string> = {
  running: "running",
  completed: "done",
  failed: "failed",
  idle: "",
};

interface WorkspaceCache {
  files: FileChange[];
  changes: MutableChange[];
  diffs: Map<string, string[]>;
}

export function createWorkspacesComponent(
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: void) => void,
) {
  let workspaces: AgentWorkspace[] = [];
  let selectedIndex = 0;
  let selectedWorkspace: AgentWorkspace | null = null;
  let files: FileChange[] = [];
  let changes: MutableChange[] = [];
  let fileIndex = 0;
  let diffContent: string[] = [];
  let diffScroll = 0;
  let focus: "workspaces" | "files" = "workspaces";
  let loading = true;
  let cachedLines: string[] = [];
  let cachedWidth = 0;
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
        selectedWorkspace = workspaces[0]!;
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
      let cache = workspaceCache.get(ws.name);

      if (isDefault) {
        // For default workspace, show mutable changes
        if (cache) {
          changes = cache.changes;
          files = [];
          fileIndex = 0;
          const diffKey = changes[0]?.changeId || "";
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
          changes = await loadMutableChanges(pi, ws.path);
          files = [];
          cache = { files: [], changes, diffs: new Map() };
          workspaceCache.set(ws.name, cache);
        }

        fileIndex = 0;
        await loadChangeDiff(ws, changes[0]?.changeId);
      } else {
        // For other workspaces, show files
        if (cache) {
          files = cache.files;
          changes = [];
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
          files = await loadFiles(pi, ws.path, ws.changeId);
          changes = [];
          cache = { files, changes: [], diffs: new Map() };
          workspaceCache.set(ws.name, cache);
        }

        fileIndex = 0;
        await loadDiff(ws, files[0]?.path);
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

  async function loadChangeDiff(
    ws: AgentWorkspace,
    changeId?: string,
  ): Promise<void> {
    if (!changeId) {
      diffContent = ["No changes"];
      invalidate();
      tui.requestRender();
      return;
    }

    const cache = workspaceCache.get(ws.name);
    if (cache) {
      const cachedDiff = cache.diffs.get(changeId);
      if (cachedDiff) {
        diffContent = cachedDiff;
        diffScroll = 0;
        invalidate();
        tui.requestRender();
        return;
      }
    }

    try {
      diffContent = await getDiff(pi, ws.path, changeId);
      diffScroll = 0;

      if (cache) {
        cache.diffs.set(changeId, diffContent);
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

  async function loadDiff(
    ws: AgentWorkspace,
    filePath?: string,
  ): Promise<void> {
    const diffKey = filePath || "";

    const cache = workspaceCache.get(ws.name);
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
      const diff = await getWorkspaceDiff(pi, ws.path, filePath);
      diffContent = diff.split("\n");
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

  async function executeAction(action: string): Promise<void> {
    if (!selectedWorkspace) return;
    const ws = selectedWorkspace;

    try {
      switch (action) {
        case "attach":
          done();
          await pi.exec("tmux", ["attach", "-t", ws.name]);
          break;

        case "rebase": {
          done();
          const task = `Integrate changes from workspace "${ws.name}":

1. List changed files: \`jj diff --summary -r ${ws.name}@\`
2. Review specific files if needed: \`jj diff -r ${ws.name}@ <file>\`
3. Rebase onto current: \`jj rebase -s ${ws.name}@ -d @\`
4. Squash into parent: \`jj squash -r ${ws.name}@\`
5. Set description: \`jj desc -m "type(scope): <icon> description"\`

Types: feat, fix, docs, style, refactor, perf, test, chore
Icons: ✨ feat | 🐛 fix | 📚 docs | 💄 style | ♻️ refactor | ⚡ perf | 🧪 test | 🔧 chore`;
          pi.sendUserMessage(task);
          return;
        }

        case "vscode":
          await pi.exec("code", [ws.path]);
          break;

        case "terminal":
          await pi.exec("wezterm", ["start", "--cwd", ws.path]);
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
      const ws = workspaces[i]!;
      const isSelected = i === selectedIndex && focus === "workspaces";
      const stats = formatFileStats(ws);
      const status =
        ws.name !== "default" && STATUS_TEXT[ws.status]
          ? ` (${STATUS_TEXT[ws.status]})`
          : "";
      const text = ` ${ws.name} ${stats}${status}`;
      const truncated = truncateAnsi(text, width);
      const final = ensureWidth(truncated, width);
      const styled = isSelected ? theme.fg("accent", theme.bold(final)) : final;
      rows.push(styled);
    }

    return rows;
  }

  function getFileRows(width: number, height: number): string[] {
    const isDefault = selectedWorkspace?.name === "default";

    if (isDefault) {
      // Show mutable changes for default workspace
      return renderChangeRows(
        changes,
        width,
        height,
        fileIndex,
        focus === "files",
        theme,
        " No mutable changes",
      );
    } else {
      // Show files for other workspaces
      return renderFileChangeRows(
        files,
        width,
        height,
        fileIndex,
        focus === "files",
        theme,
      );
    }
  }

  function render(width: number): string[] {
    if (cachedWidth === width && cachedLines.length > 0) {
      return cachedLines;
    }

    const dims = calculateDimensions(tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: focus === "workspaces",
      rightFocus: focus === "files",
      rightSplit: true,
      rightTopRatio: 0.3,
    });

    const leftTitle = " Workspaces";
    const isDefault = selectedWorkspace?.name === "default";
    const rightTopTitle = isDefault ? " Changes" : " Files";
    const rightBottomTitle = selectedWorkspace
      ? isDefault
        ? ` Diff: ${changes[fileIndex]?.changeId?.slice(0, 8) || "none"}`
        : ` Diff: ${files[fileIndex]?.path || "all"}`
      : " Diff";

    const leftRows = getLeftRows(dims.leftW, dims.contentH);
    const fileRows = getFileRows(dims.rightW, dims.rightTopH || 5);
    const diffRows = renderDiffRows(
      diffContent,
      dims.rightW,
      dims.rightBottomH || 10,
      diffScroll,
      theme,
    );

    const wsForHelp = selectedWorkspace;
    const isDefaultWs = wsForHelp?.name === "default";
    const isRunningWs = wsForHelp?.status === "running";
    const hasWsChanges =
      wsForHelp?.fileStats &&
      (wsForHelp.fileStats.added > 0 ||
        wsForHelp.fileStats.modified > 0 ||
        wsForHelp.fileStats.deleted > 0);

    const helpText =
      focus === "workspaces"
        ? buildHelpText(
            "tab ↑↓ nav",
            "n new",
            wsForHelp && !isDefaultWs && isRunningWs && "a attach",
            wsForHelp && !isDefaultWs && hasWsChanges && "r rebase",
            wsForHelp && "e edit",
            wsForHelp && "t term",
            wsForHelp && !isDefaultWs && "x delete",
          )
        : buildHelpText(
            "tab ↑↓ nav",
            !isDefaultWs && files.length > 0 && "d discard",
            "pgup/pgdn scroll",
          );

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

  function handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      done();
      return;
    }

    if (data === "q") {
      done();
      return;
    }

    if (matchesKey(data, "tab")) {
      focus = focus === "workspaces" ? "files" : "workspaces";
      invalidate();
      tui.requestRender();
      return;
    }

    // Create new workspace hotkey
    if (data === "n") {
      void (async () => {
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
          await pi.exec("wezterm", [
            "start",
            "--cwd",
            workspacePath,
            "--",
            "pi",
          ]);
          workspaceCache.delete(workspaceName);
          await loadWorkspaces();
        } catch {
          // Silently fail
        }
      })();
      return;
    }

    // Hotkeys for workspace actions
    if (selectedWorkspace) {
      const ws = selectedWorkspace;
      const isDefault = ws.name === "default";
      const isRunning = ws.status === "running";

      if (data === "a" && !isDefault && isRunning) {
        void executeAction("attach");
        return;
      }
      if (data === "r" && !isDefault && ws.fileStats) {
        void executeAction("rebase");
        return;
      }
      if (data === "e") {
        void executeAction("vscode");
        return;
      }
      if (data === "t") {
        void executeAction("terminal");
        return;
      }
      if (data === "x" && !isDefault) {
        // Kill and forget in one action
        if (isRunning) {
          void killTmuxSession(pi, ws.name).then(() => executeAction("forget"));
        } else {
          void executeAction("forget");
        }
        return;
      }
    }

    if (focus === "workspaces") {
      if (matchesKey(data, "up")) {
        if (selectedIndex > 0) {
          selectedIndex--;
          selectedWorkspace = workspaces[selectedIndex] || null;
          if (selectedWorkspace) {
            void loadFilesAndDiff(selectedWorkspace);
          }
          invalidate();
          tui.requestRender();
        }
      } else if (matchesKey(data, "down")) {
        if (selectedIndex < workspaces.length - 1) {
          selectedIndex++;
          selectedWorkspace = workspaces[selectedIndex] || null;
          if (selectedWorkspace) {
            void loadFilesAndDiff(selectedWorkspace);
          }
          invalidate();
          tui.requestRender();
        }
      }
    } else if (focus === "files") {
      const isDefault = selectedWorkspace?.name === "default";
      const maxIndex = isDefault ? changes.length - 1 : files.length - 1;

      // Discard file changes
      if (data === "d" && !isDefault && files[fileIndex]) {
        const file = files[fileIndex]!;
        void (async () => {
          await pi.exec("jj", ["restore", file.path], {
            cwd: selectedWorkspace!.path,
          });
          workspaceCache.delete(selectedWorkspace!.name);
          await loadFilesAndDiff(selectedWorkspace!);
        })();
        return;
      }

      if (matchesKey(data, "up")) {
        if (fileIndex > 0) {
          fileIndex--;
          if (selectedWorkspace) {
            if (isDefault) {
              void loadChangeDiff(
                selectedWorkspace,
                changes[fileIndex]?.changeId,
              );
            } else {
              void loadDiff(selectedWorkspace, files[fileIndex]?.path);
            }
          }
          invalidate();
          tui.requestRender();
        }
      } else if (matchesKey(data, "down")) {
        if (fileIndex < maxIndex) {
          fileIndex++;
          if (selectedWorkspace) {
            if (isDefault) {
              void loadChangeDiff(
                selectedWorkspace,
                changes[fileIndex]?.changeId,
              );
            } else {
              void loadDiff(selectedWorkspace, files[fileIndex]?.path);
            }
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

  void loadWorkspaces();

  return {
    render,
    handleInput,
    invalidate,
    dispose,
  };
}
