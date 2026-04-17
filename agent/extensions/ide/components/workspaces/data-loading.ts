import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AgentWorkspace, FileChange, Change } from "../../types";
import {
  getRepoRoot,
  getCurrentChangeId,
  loadAgentWorkspaces,
} from "../../workspace";
import { loadChanges, loadChangedFiles, getRawDiff } from "../../jj";
import { getTheme, renderDiffWithShiki } from "../../tools/diff";
import { formatErrorMessage } from "../formatting-utils";

export interface WorkspaceState {
  workspaces: AgentWorkspace[];
  selectedWorkspace: AgentWorkspace | null;
  files: FileChange[];
  changes: Change[];
  fileIndex: number;
  diffContent: string[];
  diffScroll: number;
  loading: boolean;
}

interface WorkspaceCache {
  files: FileChange[];
  changes: Change[];
  diffs: Map<string, string[]>;
}

export function createWorkspaceState(): WorkspaceState {
  return {
    workspaces: [],
    selectedWorkspace: null,
    files: [],
    changes: [],
    fileIndex: 0,
    diffContent: [],
    diffScroll: 0,
    loading: true,
  };
}

export interface WorkspaceCacheStore {
  get(name: string): WorkspaceCache | undefined;
  set(name: string, cache: WorkspaceCache): void;
  delete(name: string): void;
}

export function createCacheStore(): WorkspaceCacheStore {
  const store = new Map<string, WorkspaceCache>();
  return {
    get: (name) => store.get(name),
    set: (name, cache) => store.set(name, cache),
    delete: (name) => store.delete(name),
  };
}

function invalidate(
  state: WorkspaceState,
  tui: { requestRender: () => void },
): void {
  // Caller manages cachedLines/cachedWidth via state if needed
  tui.requestRender();
}

export async function loadWorkspacesList(
  pi: ExtensionAPI,
): Promise<AgentWorkspace[]> {
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
  return [rootWorkspace, ...keenWorkspaces];
}

async function loadChangeDiff(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  changeId: string,
  cache: WorkspaceCache,
): Promise<string[]> {
  const cachedDiff = cache.diffs.get(changeId);
  if (cachedDiff) return cachedDiff;

  try {
    const { diff } = await getRawDiff(pi, ws.path, changeId);
    const thm = await getTheme(pi, ws.path);
    const content = await renderDiffWithShiki(diff, thm);
    cache.diffs.set(changeId, content);
    return content;
  } catch (error) {
    return [`Error: ${formatErrorMessage(error)}`];
  }
}

async function loadFileDiff(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  filePath: string | undefined,
  cache: WorkspaceCache,
): Promise<string[]> {
  const diffKey = filePath ?? "";
  const cachedDiff = cache.diffs.get(diffKey);
  if (cachedDiff) return cachedDiff;

  try {
    const { diff } = await getRawDiff(pi, ws.path, "@", filePath);
    const thm = await getTheme(pi, ws.path);
    const content = await renderDiffWithShiki(diff, thm);
    cache.diffs.set(diffKey, content);
    return content;
  } catch (error) {
    return [`Error: ${formatErrorMessage(error)}`];
  }
}

export async function loadDefaultWorkspace(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  state: WorkspaceState,
  cacheStore: WorkspaceCacheStore,
): Promise<void> {
  const cache = cacheStore.get(ws.name);

  if (cache && cache.changes.length > 0) {
    state.files = [];
    state.changes = cache.changes;
    state.fileIndex = 0;
    const diffKey = state.changes[0]?.changeId ?? "";
    const cachedDiff = cache.diffs.get(diffKey);
    if (cachedDiff) {
      state.diffContent = cachedDiff;
      state.diffScroll = 0;
      return;
    }
  }

  if (!cache || cache.changes.length === 0) {
    state.changes = await loadChanges(pi, ws.path);
    state.files = [];
    const newCache: WorkspaceCache = {
      files: [],
      changes: state.changes,
      diffs: new Map(),
    };
    cacheStore.set(ws.name, newCache);
  }

  state.fileIndex = 0;
  state.diffContent = await loadChangeDiff(
    pi,
    ws,
    state.changes[0]?.changeId,
    cacheStore.get(ws.name)!,
  );
}

export async function loadWorkspaceFiles(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  state: WorkspaceState,
  cacheStore: WorkspaceCacheStore,
): Promise<void> {
  const cache = cacheStore.get(ws.name);

  if (cache && cache.files.length > 0) {
    state.files = cache.files;
    state.changes = [];
    state.fileIndex = 0;
    const diffKey = state.files[0]?.path ?? "";
    const cachedDiff = cache.diffs.get(diffKey);
    if (cachedDiff) {
      state.diffContent = cachedDiff;
      state.diffScroll = 0;
      return;
    }
  }

  if (!cache || cache.files.length === 0) {
    state.files = await loadChangedFiles(pi, ws.path, ws.changeId);
    state.changes = [];
    const newCache: WorkspaceCache = {
      files: state.files,
      changes: [],
      diffs: new Map(),
    };
    cacheStore.set(ws.name, newCache);
  }

  state.fileIndex = 0;
  state.diffContent = await loadFileDiff(
    pi,
    ws,
    state.files[0]?.path,
    cacheStore.get(ws.name)!,
  );
}
