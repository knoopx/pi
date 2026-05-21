import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AgentWorkspace, FileChange, Change } from "../../types";
import {
  getCurrentChangeId,
  loadAgentWorkspaces,
} from "../../workspace/manager";
import { getRepoRoot, loadChangedFiles, getRawDiff } from "../../jj/files";
import { renderDiffWithShiki } from "../../tools/diff";
import { THEME } from "../../lib/shiki/constants";
import { formatErrorMessage } from "../../lib/ui/footer";
import { loadChanges } from "../../jj/changes";
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
export interface WorkspaceCache {
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
    const content = await renderDiffWithShiki(diff, THEME);
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
    const content = await renderDiffWithShiki(diff, THEME);
    cache.diffs.set(diffKey, content);
    return content;
  } catch (error) {
    return [`Error: ${formatErrorMessage(error)}`];
  }
}
function applyCacheHit(state: WorkspaceState, diffContent: string[]): void {
  state.diffContent = diffContent;
  state.diffScroll = 0;
}
function ensureCache(
  wsName: string,
  cache: WorkspaceCache | undefined,
  cacheStore: WorkspaceCacheStore,
): WorkspaceCache {
  if (cache) return cache;
  const newCache: WorkspaceCache = {
    files: [],
    changes: [],
    diffs: new Map(),
  };
  cacheStore.set(wsName, newCache);
  return newCache;
}
function findFirstChangeDiff(
  cache: WorkspaceCache,
  state: WorkspaceState,
): string[] | null {
  const changeId = state.changes[0]?.changeId ?? "";
  return cache.diffs.get(changeId) ?? null;
}

function tryChangesCacheHit(
  state: WorkspaceState,
  cache: WorkspaceCache | undefined,
): boolean {
  if (!cache || !cache.changes.length) return false;
  applyCachedChanges(state, cache);
  const cachedDiff = findFirstChangeDiff(cache, state);
  if (!cachedDiff) return false;
  applyCacheHit(state, cachedDiff);
  return true;
}

function resolveFirstChangeId(state: WorkspaceState): string {
  return state.changes[0]?.changeId ?? "";
}

export async function loadDefaultWorkspace(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  state: WorkspaceState,
  cacheStore: WorkspaceCacheStore,
): Promise<void> {
  const existingCache = cacheStore.get(ws.name);

  if (tryChangesCacheHit(state, existingCache)) return;

  const cache = ensureCache(ws.name, existingCache, cacheStore);
  if (!hasCachedChanges(cache)) {
    const changes = await loadChanges(pi, ws.path);
    state.changes = changes;
    state.files = [];
    cache.changes = changes;
  }

  state.fileIndex = 0;
  state.diffContent = await loadChangeDiff(
    pi,
    ws,
    resolveFirstChangeId(state),
    cache,
  );
}
function tryFilesCacheHit(
  state: WorkspaceState,
  cache: WorkspaceCache,
): boolean {
  applyCachedFiles(state, cache);
  const cachedDiff = cache.diffs.get(state.files[0]?.path ?? "");
  if (cachedDiff) {
    applyCacheHit(state, cachedDiff);
    return true;
  }
  return false;
}

function resolveFirstFilePath(state: WorkspaceState): string {
  return state.files[0]?.path ?? "";
}

export async function loadWorkspaceFiles(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  state: WorkspaceState,
  cacheStore: WorkspaceCacheStore,
): Promise<void> {
  const existing = cacheStore.get(ws.name);
  if (tryExistingCacheHit(state, existing)) return;

  let cache = ensureCache(ws.name, existing, cacheStore);
  if (!hasCachedFiles(cache)) {
    cache = await refreshFileCache(pi, ws, state, cache);
  }

  state.fileIndex = 0;
  state.diffContent = await loadFileDiff(
    pi,
    ws,
    resolveFirstFilePath(state),
    cache,
  );
}

function tryExistingCacheHit(
  state: WorkspaceState,
  cache: WorkspaceCache | undefined,
): boolean {
  return !!(cache && hasCachedFiles(cache) && tryFilesCacheHit(state, cache));
}

async function refreshFileCache(
  pi: ExtensionAPI,
  ws: AgentWorkspace,
  state: WorkspaceState,
  cache: WorkspaceCache,
): Promise<WorkspaceCache> {
  const files = await loadChangedFiles(pi, ws.path, ws.changeId);
  state.files = files;
  state.changes = [];
  cache.files = files;
  return cache;
}
function hasCachedChanges(cache: WorkspaceCache | undefined): boolean {
  return !!cache && cache.changes.length > 0;
}
function hasCachedFiles(cache: WorkspaceCache | undefined): boolean {
  return !!cache && cache.files.length > 0;
}
function applyCachedChanges(
  state: WorkspaceState,
  cache: WorkspaceCache,
): void {
  state.changes = cache.changes;
  state.files = [];
  state.fileIndex = 0;
}
function applyCachedFiles(state: WorkspaceState, cache: WorkspaceCache): void {
  state.files = cache.files;
  state.changes = [];
  state.fileIndex = 0;
}
